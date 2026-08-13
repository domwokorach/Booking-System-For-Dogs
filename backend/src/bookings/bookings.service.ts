import { createHash, randomBytes } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { AppointmentStatus, PaymentStatus, Prisma } from "@prisma/client";

import type { AuthUser } from "../auth/auth.types.js";
import { env } from "../config/env.js";
import { EmailService } from "../notifications/email.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { PaymentsService } from "../payments/payments.service.js";
import { RealtimeGateway } from "../realtime/realtime.gateway.js";
import { AppointmentSlotsService } from "../scheduling/appointment-slots.service.js";
import {
  parseSlotId,
  formatTime,
  toApiStatus,
  toBookingDto,
  toBookingMutationResponse,
} from "./booking-mappers.js";
import type {
  CreateBookingInput,
  RescheduleBookingInput,
  RescheduleBookingSlotsQuery,
} from "./dto/bookings.schemas.js";

const bookingUserSelect = {
  id: true,
  firstName: true,
  surname: true,
  email: true,
  address: true,
  mobileNumber: true,
} as const;

const RETAINED_PAYMENT_STATUSES = [
  PaymentStatus.Pending,
  PaymentStatus.Paid,
  PaymentStatus.RefundPending,
  PaymentStatus.Refunded,
  PaymentStatus.RefundFailed,
] as const;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appointmentSlots: AppointmentSlotsService,
    private readonly email: EmailService,
    private readonly realtime: RealtimeGateway,
    private readonly payments: PaymentsService,
  ) {}

  async createAndConfirm(user: AuthUser, body: CreateBookingInput) {
    const slot = parseSlotId(body.slotId);
    if (slot.serviceId !== body.serviceId) {
      throw new BadRequestException("Slot does not match selected service.");
    }

    const service = await this.resolveActiveService(body.serviceId);
    let appointment;
    try {
      appointment = await this.appointmentSlots.withAvailableSlot(
        {
          dateTime: slot.dateTime,
          durationMinutes: service.durationMinutes,
          conflictMessage:
            "Sorry, this appointment has already been booked.",
        },
        (transaction) =>
          transaction.appointment.create({
            data: {
              userId: user.id,
              dateTime: slot.dateTime,
              serviceId: service.id,
              service: service.name,
              durationMinutes: service.durationMinutes,
              status: AppointmentStatus.Pending,
            },
            include: { user: { select: bookingUserSelect } },
          }),
      );
    } catch (error) {
      this.rethrowSlotConflict(error);
    }

    this.realtime.emitToUser(user.id, "appointments:created", {
      appointmentId: appointment.id,
      dateTime: appointment.dateTime,
      status: appointment.status,
    });
    try {
      const checkout = await this.payments.createCheckout({
        appointmentId: appointment.id,
        userId: appointment.userId,
        customerEmail: appointment.user.email,
        customerName: `${appointment.user.firstName} ${appointment.user.surname}`,
        serviceId: service.id,
        serviceName: service.name,
        amountPence: service.pricePence,
        appointmentDateTime: appointment.dateTime,
      });
      return {
        ...toBookingMutationResponse(
          appointment,
          "Appointment reserved. Complete payment to confirm.",
        ),
        ...checkout,
      };
    } catch (error) {
      await this.prisma.appointment.updateMany({
        where: { id: appointment.id, status: AppointmentStatus.Pending },
        data: { status: AppointmentStatus.Cancelled, cancelledAt: new Date() },
      });
      throw error;
    }
  }

  async listMine(user: AuthUser) {
    const appointments = await this.prisma.appointment.findMany({
      where: { userId: user.id },
      orderBy: { dateTime: "asc" },
      include: { serviceRef: { select: { name: true } } },
    });

    return { bookings: appointments.map(toBookingDto) };
  }

  async getOne(user: AuthUser, id: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, userId: user.id },
      include: { serviceRef: { select: { name: true } } },
    });

    if (!appointment) {
      throw new NotFoundException("Booking not found.");
    }

    return { booking: toBookingDto(appointment) };
  }

  async availableForReschedule(
    user: AuthUser,
    id: string,
    query: RescheduleBookingSlotsQuery,
  ) {
    const existing = await this.findOwnedWithUser(user.id, id);
    if (
      existing.status === AppointmentStatus.Cancelled ||
      existing.status === AppointmentStatus.CancellationPending
    ) {
      throw new BadRequestException(
        "Cancelled bookings and pending cancellation requests cannot be rescheduled.",
      );
    }

    const service = await this.resolveActiveService(query.serviceId);
    const availableTimes = await this.appointmentSlots.getAvailableTimes(
      query.date,
      service.durationMinutes,
      existing.id,
    );

    return {
      bookingId: existing.id,
      serviceId: service.id,
      date: query.date,
      slots: availableTimes.map((isoDateTime) => {
        const startAt = new Date(isoDateTime);
        return {
          id: `${service.id}|${isoDateTime}`,
          serviceId: service.id,
          date: query.date,
          time: formatTime(startAt),
          startAt: isoDateTime,
          endAt: new Date(
            startAt.getTime() + service.durationMinutes * 60_000,
          ).toISOString(),
          active: true,
        };
      }),
    };
  }

  async confirm(user: AuthUser, id: string) {
    const existing = await this.findOwnedWithUser(user.id, id);
    if (
      existing.status === AppointmentStatus.Cancelled ||
      existing.status === AppointmentStatus.CancellationPending
    ) {
      throw new BadRequestException(
        "Cancelled appointments and pending cancellation requests cannot be confirmed.",
      );
    }

    if (existing.status === AppointmentStatus.Confirmed) {
      return toBookingMutationResponse(
        existing,
        "Appointment confirmed successfully",
      );
    }
    if (existing.status === AppointmentStatus.Pending) {
      if (!existing.serviceId) {
        throw new BadRequestException(
          "This appointment does not have a payable service.",
        );
      }
      const service = await this.resolveActiveService(existing.serviceId);
      const checkout = await this.payments.createCheckout({
        appointmentId: existing.id,
        userId: existing.userId,
        customerEmail: existing.user.email,
        customerName: `${existing.user.firstName} ${existing.user.surname}`,
        serviceId: service.id,
        serviceName: service.name,
        amountPence: service.pricePence,
        appointmentDateTime: existing.dateTime,
      });
      return {
        ...toBookingMutationResponse(
          existing,
          "Complete payment to confirm this appointment.",
        ),
        ...checkout,
      };
    }

    const updated = await this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.appointment.updateMany({
        where: {
          id,
          userId: user.id,
          status: existing.status,
          dateTime: existing.dateTime,
          updatedAt: existing.updatedAt,
        },
        data: {
          status: AppointmentStatus.Confirmed,
          confirmedAt: new Date(),
        },
      });

      if (changed.count !== 1) {
        throw new ConflictException("The booking state changed. Please retry.");
      }

      return this.findOwnedWithUser(user.id, id, transaction);
    });
    this.realtime.emitToUser(user.id, "appointments:confirmed", {
      appointmentId: updated.id,
      dateTime: updated.dateTime,
      status: updated.status,
    });
    const emailDelivered = await this.email.sendBookingConfirmation({
      to: updated.user.email,
      firstName: updated.user.firstName,
      bookingId: updated.id,
      service: updated.service,
      appointmentDateTime: updated.dateTime,
      status: toApiStatus(updated.status),
    });
    return {
      ...toBookingMutationResponse(
        updated,
        "Appointment confirmed successfully",
      ),
      notificationRecipient: updated.user.email,
      emailDelivered,
    };
  }

  async reschedule(
    user: AuthUser,
    id: string,
    body: RescheduleBookingInput,
  ) {
    const slot = parseSlotId(body.slotId);
    const service = await this.resolveActiveService(slot.serviceId);
    const existing = await this.findOwnedWithUser(user.id, id);

    if (
      existing.status === AppointmentStatus.Cancelled ||
      existing.status === AppointmentStatus.CancellationPending
    ) {
      throw new BadRequestException(
        "Cancelled bookings and pending cancellation requests cannot be rescheduled.",
      );
    }

    let updated;
    try {
      updated = await this.appointmentSlots.withAvailableSlot(
        {
          dateTime: slot.dateTime,
          durationMinutes: service.durationMinutes,
          excludeAppointmentId: id,
          conflictMessage:
            "Sorry, this appointment has already been booked.",
        },
        async (transaction) => {
          const changed = await transaction.appointment.updateMany({
            where: {
              id,
              userId: user.id,
              status: existing.status,
              dateTime: existing.dateTime,
              updatedAt: existing.updatedAt,
            },
            data: {
              dateTime: slot.dateTime,
              serviceId: service.id,
              service: service.name,
              durationMinutes: service.durationMinutes,
              status: AppointmentStatus.Rescheduled,
              rescheduledFrom: existing.dateTime,
            },
          });

          if (changed.count !== 1) {
            throw new ConflictException(
              "The booking state changed. Please retry.",
            );
          }

          return this.findOwnedWithUser(user.id, id, transaction);
        },
      );
    } catch (error) {
      this.rethrowSlotConflict(error);
    }

    this.realtime.emitToUser(user.id, "appointments:rescheduled", {
      appointmentId: updated.id,
      dateTime: updated.dateTime,
      status: updated.status,
    });
    await this.email.sendBookingUpdate({
      to: updated.user.email,
      firstName: updated.user.firstName,
      appointmentDateTime: updated.dateTime,
      status: toApiStatus(updated.status),
    });
    return toBookingMutationResponse(
      updated,
      "Appointment rescheduled successfully",
    );
  }

  async cancel(user: AuthUser, id: string) {
    return this.payments.requestCancellation(user, id);
  }

  async requestDeletion(user: AuthUser, id: string) {
    const administratorEmail = env.BOOKING_EMAIL_TO.trim();
    if (!administratorEmail) {
      throw new ServiceUnavailableException(
        "Deletion approval is unavailable because the administrator email is not configured.",
      );
    }

    const existing = await this.findOwnedWithUser(user.id, id);
    if (existing.status === AppointmentStatus.CancellationPending) {
      throw new ConflictException(
        "This booking cannot be deleted while cancellation approval is pending.",
      );
    }
    const unresolvedRefund = await this.prisma.payment.count({
      where: {
        appointmentId: id,
        status: {
          in: [...RETAINED_PAYMENT_STATUSES],
        },
      },
    });
    if (unresolvedRefund > 0) {
      throw new ConflictException(
        "This booking cannot be deleted because its payment record must be retained. Cancel any paid booking through the refund workflow.",
      );
    }
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = this.hashAppointmentDeletionToken(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const updated = await this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.appointment.updateMany({
        where: { id, userId: user.id },
        data: { deleteRequestedAt: new Date() },
      });
      if (changed.count !== 1) {
        throw new ConflictException("The booking state changed. Please retry.");
      }

      await transaction.appointmentDeletionRequest.upsert({
        where: { appointmentId: id },
        update: { tokenHash, expiresAt, createdAt: new Date() },
        create: { appointmentId: id, tokenHash, expiresAt },
      });

      return this.findOwnedWithUser(user.id, id, transaction);
    });
    this.realtime.emitToUser(user.id, "appointments:updated", {
      appointmentId: updated.id,
      dateTime: updated.dateTime,
      status: updated.status,
    });
    const approvalUrl = `${env.FRONTEND_URL.replace(/\/$/, "")}/?deleteAppointmentToken=${rawToken}`;
    const emailDelivered = await this.email.sendDeletionRequest({
      to: updated.user.email,
      firstName: updated.user.firstName,
      bookingId: updated.id,
      service: updated.service,
      appointmentDateTime: updated.dateTime,
      status: toApiStatus(updated.status),
      approvalUrl,
      adminRecipient: administratorEmail,
    });
    return {
      success: true,
      bookingId: updated.id,
      status: toApiStatus(updated.status),
      expiresAt,
      emailDelivered,
      message: emailDelivered
        ? "Deletion approval link sent to the administrator."
        : "Deletion request created, but the approval email could not be delivered.",
    };
  }

  private async resolveActiveService(id: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, active: true },
      select: { id: true, name: true, durationMinutes: true, pricePence: true },
    });
    if (!service) {
      throw new NotFoundException("Service not found.");
    }
    return service;
  }

  private async findOwnedWithUser(
    userId: string,
    id: string,
    client: Pick<Prisma.TransactionClient, "appointment"> = this.prisma,
  ) {
    const appointment = await client.appointment.findFirst({
      where: { id, userId },
      include: { user: { select: bookingUserSelect } },
    });
    if (!appointment) {
      throw new NotFoundException("Booking not found.");
    }
    return appointment;
  }

  private hashAppointmentDeletionToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private rethrowSlotConflict(error: unknown): never {
    if (
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002") ||
      (error instanceof Prisma.PrismaClientUnknownRequestError &&
        error.message.includes("Appointment_no_active_time_overlap"))
    ) {
      throw new ConflictException(
        "Sorry, this appointment has already been booked.",
      );
    }
    throw error;
  }
}
