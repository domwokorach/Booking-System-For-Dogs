import { createHash, randomBytes } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AppointmentStatus, Prisma } from "@prisma/client";

import type { AuthUser } from "../auth/auth.types.js";
import { env } from "../config/env.js";
import { EmailService } from "../notifications/email.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { RealtimeGateway } from "../realtime/realtime.gateway.js";
import { getReviewEligibility } from "../reviews/review-eligibility.js";
import { AppointmentSlotsService } from "../scheduling/appointment-slots.service.js";
import type {
  CreateAppointmentInput,
  RescheduleAppointmentInput,
  UpdateAppointmentInput,
} from "./dto/appointments.schemas.js";

const publicUserSelect = {
  id: true,
  firstName: true,
  surname: true,
  email: true,
  address: true,
  mobileNumber: true,
} as const;

const safeAppointmentInclude = {
  user: { select: publicUserSelect },
  serviceRef: true,
} as const;

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appointmentSlots: AppointmentSlotsService,
    private readonly email: EmailService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async available(date: string) {
    return {
      date,
      availableTimes: await this.appointmentSlots.getAvailableTimes(date),
    };
  }

  async listMine(user: AuthUser) {
    const appointments = await this.prisma.appointment.findMany({
      where: { userId: user.id },
      include: { review: { select: { id: true } } },
      orderBy: { dateTime: "asc" },
    });

    return appointments.map((appointment) => ({
      ...appointment,
      reviewEligibility: getReviewEligibility({
        status: appointment.status,
        dateTime: appointment.dateTime,
        durationMinutes: appointment.durationMinutes,
        hasReview: Boolean(appointment.review),
      }),
    }));
  }

  async availableForReschedule(user: AuthUser, id: string, date: string) {
    const existing = await this.findOwned(user.id, id);
    if (existing.status === AppointmentStatus.Cancelled) {
      throw new BadRequestException(
        "Cancelled appointments cannot be rescheduled.",
      );
    }

    return {
      appointmentId: existing.id,
      date,
      availableTimes: await this.appointmentSlots.getAvailableTimes(
        date,
        existing.durationMinutes,
        existing.id,
      ),
    };
  }

  async create(user: AuthUser, body: CreateAppointmentInput) {
    const service = body.service
      ? await this.resolveActiveService(body.service)
      : null;

    let appointment;
    try {
      appointment = await this.appointmentSlots.withAvailableSlot(
        {
          dateTime: body.dateTime,
          durationMinutes: service?.durationMinutes ?? 60,
          conflictMessage: "This appointment slot is already booked.",
        },
        (transaction) =>
          transaction.appointment.create({
            data: {
              userId: user.id,
              dateTime: body.dateTime,
              serviceId: service?.id,
              service: service?.name,
              durationMinutes: service?.durationMinutes ?? 60,
              notes: body.notes,
              status: AppointmentStatus.Confirmed,
              confirmedAt: new Date(),
            },
            include: safeAppointmentInclude,
          }),
      );
    } catch (error) {
      this.rethrowSlotConflict(error, "This appointment slot is already booked.");
    }

    this.realtime.emitToUser(user.id, "appointments:created", {
      appointmentId: appointment.id,
      dateTime: appointment.dateTime,
      status: appointment.status,
    });
    await this.email.sendBookingConfirmation({
      to: appointment.user.email,
      firstName: appointment.user.firstName,
      bookingId: appointment.id,
      service: appointment.serviceRef?.name ?? appointment.service,
      appointmentDateTime: appointment.dateTime,
      status: appointment.status,
    });
    return {
      ...appointment,
      notificationRecipient: this.email.resolveBookingRecipient(
        appointment.user.email,
      ),
    };
  }

  async update(user: AuthUser, id: string, body: UpdateAppointmentInput) {
    const existing = await this.findOwned(user.id, id);
    const service = body.service
      ? await this.resolveActiveService(body.service)
      : null;

    const updateAppointment = async (transaction: Prisma.TransactionClient) => {
      const changed = await transaction.appointment.updateMany({
        where: {
          id,
          userId: user.id,
          updatedAt: existing.updatedAt,
        },
        data: {
          serviceId: body.service ? service?.id : undefined,
          service: body.service ? service?.name : undefined,
          durationMinutes: body.service ? service?.durationMinutes : undefined,
          notes: body.notes,
        },
      });
      if (changed.count !== 1) {
        throw new ConflictException("The appointment changed. Please retry.");
      }

      return this.findOwned(user.id, id, transaction);
    };

    let updated;
    if (service && existing.status !== AppointmentStatus.Cancelled) {
      updated = await this.appointmentSlots.withAvailableSlot(
        {
          dateTime: existing.dateTime,
          durationMinutes: service.durationMinutes,
          excludeAppointmentId: id,
          conflictMessage:
            "The selected service does not fit this appointment slot.",
        },
        updateAppointment,
      );
    } else {
      updated = await this.prisma.$transaction(updateAppointment);
    }
    this.realtime.emitToUser(user.id, "appointments:updated", {
      appointmentId: updated.id,
      dateTime: updated.dateTime,
      status: updated.status,
    });
    await this.email.sendBookingUpdate({
      to: updated.user.email,
      firstName: updated.user.firstName,
      appointmentDateTime: updated.dateTime,
      status: updated.status,
    });
    return {
      ...updated,
      notificationRecipient: this.email.resolveBookingRecipient(
        updated.user.email,
      ),
    };
  }

  async reschedule(
    user: AuthUser,
    id: string,
    body: RescheduleAppointmentInput,
  ) {
    const existing = await this.findOwned(user.id, id);
    if (existing.status === AppointmentStatus.Cancelled) {
      throw new BadRequestException(
        "Cancelled appointments cannot be rescheduled.",
      );
    }

    let updated;
    try {
      updated = await this.appointmentSlots.withAvailableSlot(
        {
          dateTime: body.dateTime,
          durationMinutes: existing.durationMinutes,
          excludeAppointmentId: id,
          conflictMessage: "The requested time is not available.",
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
              dateTime: body.dateTime,
              rescheduledFrom: existing.dateTime,
              notes: body.notes ?? existing.notes,
              status: AppointmentStatus.Rescheduled,
            },
          });
          if (changed.count !== 1) {
            throw new ConflictException(
              "The appointment state changed. Please retry.",
            );
          }

          return this.findOwned(user.id, id, transaction);
        },
      );
    } catch (error) {
      this.rethrowSlotConflict(error, "The requested time is not available.");
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
      status: updated.status,
    });
    return {
      ...updated,
      notificationRecipient: this.email.resolveBookingRecipient(
        updated.user.email,
      ),
    };
  }

  async confirm(user: AuthUser, id: string) {
    const existing = await this.findOwned(user.id, id);
    if (existing.status === AppointmentStatus.Cancelled) {
      throw new BadRequestException(
        "Cancelled appointments cannot be confirmed.",
      );
    }
    if (existing.status === AppointmentStatus.Confirmed) {
      return existing;
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
        throw new ConflictException(
          "The appointment state changed. Please retry.",
        );
      }

      return this.findOwned(user.id, id, transaction);
    });
    this.realtime.emitToUser(user.id, "appointments:confirmed", {
      appointmentId: updated.id,
      dateTime: updated.dateTime,
      status: updated.status,
    });
    await this.email.sendBookingConfirmation({
      to: updated.user.email,
      firstName: updated.user.firstName,
      bookingId: updated.id,
      service: updated.serviceRef?.name ?? updated.service,
      appointmentDateTime: updated.dateTime,
      status: updated.status,
    });
    return updated;
  }

  async cancel(user: AuthUser, id: string) {
    const existing = await this.findOwned(user.id, id);
    if (existing.status === AppointmentStatus.Cancelled) {
      return existing;
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
          status: AppointmentStatus.Cancelled,
          cancelledAt: new Date(),
        },
      });
      if (changed.count !== 1) {
        throw new ConflictException(
          "The appointment state changed. Please retry.",
        );
      }

      return this.findOwned(user.id, id, transaction);
    });
    this.realtime.emitToUser(user.id, "appointments:cancelled", {
      appointmentId: updated.id,
      dateTime: updated.dateTime,
      status: updated.status,
    });
    await this.email.sendBookingCancellation({
      to: updated.user.email,
      firstName: updated.user.firstName,
      bookingId: updated.id,
      service: updated.serviceRef?.name ?? updated.service,
      appointmentDateTime: updated.dateTime,
      status: updated.status,
    });
    return updated;
  }

  async approveDeletion(token: string) {
    const tokenHash = this.hashAppointmentDeletionToken(token);
    const request = await this.prisma.appointmentDeletionRequest.findUnique({
      where: { tokenHash },
      include: { appointment: { include: safeAppointmentInclude } },
    });

    if (!request || request.expiresAt <= new Date()) {
      throw new BadRequestException(
        "This deletion approval link is invalid, expired, or already used.",
      );
    }

    const appointment = request.appointment;
    await this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.appointmentDeletionRequest.deleteMany({
        where: {
          id: request.id,
          tokenHash,
          expiresAt: { gt: new Date() },
        },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException(
          "This deletion approval link is invalid, expired, or already used.",
        );
      }

      const deleted = await transaction.appointment.deleteMany({
        where: {
          id: request.appointmentId,
          deleteRequestedAt: { not: null },
        },
      });
      if (deleted.count !== 1) {
        throw new ConflictException("The deletion request is no longer valid.");
      }
    });

    this.realtime.emitToUser(appointment.userId, "appointments:deleted", {
      appointmentId: appointment.id,
    });
    await this.email.sendBookingCancellation({
      to: appointment.user.email,
      firstName: appointment.user.firstName,
      bookingId: appointment.id,
      service: appointment.serviceRef?.name ?? appointment.service,
      appointmentDateTime: appointment.dateTime,
      status: appointment.status,
    });
    return {
      success: true,
      appointmentId: appointment.id,
      message: "Appointment deletion approved and completed.",
    };
  }

  async requestDeletion(user: AuthUser, id: string) {
    await this.findOwned(user.id, id);
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = this.hashAppointmentDeletionToken(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const updated = await this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.appointment.updateMany({
        where: { id, userId: user.id },
        data: { deleteRequestedAt: new Date() },
      });
      if (changed.count !== 1) {
        throw new ConflictException("The appointment state changed. Please retry.");
      }

      await transaction.appointmentDeletionRequest.upsert({
        where: { appointmentId: id },
        update: { tokenHash, expiresAt, createdAt: new Date() },
        create: { appointmentId: id, tokenHash, expiresAt },
      });

      return this.findOwned(user.id, id, transaction);
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
      service: updated.serviceRef?.name ?? updated.service,
      appointmentDateTime: updated.dateTime,
      status: updated.status,
      approvalUrl,
    });
    return {
      success: true,
      appointmentId: updated.id,
      expiresAt,
      emailDelivered,
      message: emailDelivered
        ? "Deletion approval link sent to the administrator."
        : "Deletion request created, but the approval email could not be delivered.",
    };
  }

  async sendConfirmation(user: AuthUser, id: string) {
    const appointment = await this.findOwned(user.id, id);
    await this.email.sendBookingConfirmation({
      to: appointment.user.email,
      firstName: appointment.user.firstName,
      bookingId: appointment.id,
      service: appointment.serviceRef?.name ?? appointment.service,
      appointmentDateTime: appointment.dateTime,
      status: appointment.status,
    });
    return { message: "Booking confirmation email sent." };
  }

  async sendUpdate(user: AuthUser, id: string) {
    const appointment = await this.findOwned(user.id, id);
    await this.email.sendBookingUpdate({
      to: appointment.user.email,
      firstName: appointment.user.firstName,
      appointmentDateTime: appointment.dateTime,
      status: appointment.status,
    });
    return { message: "Booking update email sent." };
  }

  async sendCancellation(user: AuthUser, id: string) {
    const appointment = await this.findOwned(user.id, id);
    await this.email.sendBookingCancellation({
      to: appointment.user.email,
      firstName: appointment.user.firstName,
      bookingId: appointment.id,
      service: appointment.serviceRef?.name ?? appointment.service,
      appointmentDateTime: appointment.dateTime,
      status: appointment.status,
    });
    return { message: "Booking cancellation email sent." };
  }

  private async resolveActiveService(id: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, active: true },
      select: { id: true, name: true, durationMinutes: true },
    });
    if (!service) {
      throw new NotFoundException("Service not found.");
    }
    return service;
  }

  private async findOwned(
    userId: string,
    id: string,
    client: Pick<Prisma.TransactionClient, "appointment"> = this.prisma,
  ) {
    const appointment = await client.appointment.findFirst({
      where: { id, userId },
      include: safeAppointmentInclude,
    });
    if (!appointment) {
      throw new NotFoundException("Appointment not found.");
    }
    return appointment;
  }

  private hashAppointmentDeletionToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private rethrowSlotConflict(error: unknown, message: string): never {
    if (
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002") ||
      (error instanceof Prisma.PrismaClientUnknownRequestError &&
        error.message.includes("Appointment_no_active_time_overlap"))
    ) {
      throw new ConflictException(message);
    }
    throw error;
  }
}
