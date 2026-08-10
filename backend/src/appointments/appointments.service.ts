import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AppointmentStatus, Prisma } from "@prisma/client";

import type { AuthUser } from "../auth/auth.types.js";
import { env } from "../config/env.js";
import { EmailService } from "../notifications/email.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { RealtimeGateway } from "../realtime/realtime.gateway.js";
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

  listMine(user: AuthUser) {
    return this.prisma.appointment.findMany({
      where: { userId: user.id },
      orderBy: { dateTime: "asc" },
    });
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

    await this.email.sendBookingConfirmation({
      to: appointment.user.email,
      firstName: appointment.user.firstName,
      bookingId: appointment.id,
      service: appointment.serviceRef?.name ?? appointment.service,
      appointmentDateTime: appointment.dateTime,
      status: appointment.status,
    });
    this.realtime.emitToUser(user.id, "appointments:created", {
      appointmentId: appointment.id,
      dateTime: appointment.dateTime,
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
    await this.email.sendBookingUpdate({
      to: updated.user.email,
      firstName: updated.user.firstName,
      appointmentDateTime: updated.dateTime,
      status: updated.status,
    });
    this.realtime.emitToUser(user.id, "appointments:updated", {
      appointmentId: updated.id,
      dateTime: updated.dateTime,
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

    await this.email.sendBookingUpdate({
      to: updated.user.email,
      firstName: updated.user.firstName,
      appointmentDateTime: updated.dateTime,
      status: updated.status,
    });
    this.realtime.emitToUser(user.id, "appointments:rescheduled", {
      appointmentId: updated.id,
      dateTime: updated.dateTime,
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
    await this.email.sendBookingConfirmation({
      to: updated.user.email,
      firstName: updated.user.firstName,
      bookingId: updated.id,
      service: updated.serviceRef?.name ?? updated.service,
      appointmentDateTime: updated.dateTime,
      status: updated.status,
    });
    this.realtime.emitToUser(user.id, "appointments:confirmed", {
      appointmentId: updated.id,
      dateTime: updated.dateTime,
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
    await this.email.sendBookingCancellation({
      to: updated.user.email,
      firstName: updated.user.firstName,
      bookingId: updated.id,
      service: updated.serviceRef?.name ?? updated.service,
      appointmentDateTime: updated.dateTime,
      status: updated.status,
    });
    this.realtime.emitToUser(user.id, "appointments:cancelled", {
      appointmentId: updated.id,
      dateTime: updated.dateTime,
      status: updated.status,
    });
    return updated;
  }

  async delete(user: AuthUser, id: string, approvalToken?: string) {
    this.assertDeletionApproved(approvalToken);
    const existing = await this.findOwned(user.id, id);
    if (!existing.deleteRequestedAt) {
      throw new BadRequestException("Deletion request not found.");
    }

    const deleted = await this.prisma.appointment.deleteMany({
      where: {
        id,
        userId: user.id,
        deleteRequestedAt: { not: null },
      },
    });
    if (deleted.count !== 1) {
      throw new ConflictException("The deletion request is no longer valid.");
    }

    await this.email.sendBookingCancellation({
      to: existing.user.email,
      firstName: existing.user.firstName,
      bookingId: existing.id,
      service: existing.serviceRef?.name ?? existing.service,
      appointmentDateTime: existing.dateTime,
      status: existing.status,
    });
    this.realtime.emitToUser(user.id, "appointments:deleted", {
      appointmentId: existing.id,
    });
    return { message: "Appointment deleted successfully" };
  }

  async requestDeletion(user: AuthUser, id: string) {
    const existing = await this.findOwned(user.id, id);
    if (existing.deleteRequestedAt) {
      return { message: "Deletion request already sent." };
    }

    const updated = await this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.appointment.updateMany({
        where: { id, userId: user.id, deleteRequestedAt: null },
        data: { deleteRequestedAt: new Date() },
      });
      if (changed.count !== 1) {
        return null;
      }
      return this.findOwned(user.id, id, transaction);
    });
    if (!updated) {
      return { message: "Deletion request already sent." };
    }
    await this.email.sendDeletionRequest({
      to: updated.user.email,
      firstName: updated.user.firstName,
      bookingId: updated.id,
      service: updated.serviceRef?.name ?? updated.service,
      appointmentDateTime: updated.dateTime,
      status: updated.status,
    });
    this.realtime.emitToUser(user.id, "appointments:updated", {
      appointmentId: updated.id,
      dateTime: updated.dateTime,
      status: updated.status,
    });
    return { message: "Deletion request sent for approval." };
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

  private assertDeletionApproved(approvalToken?: string): void {
    const expected = env.DELETE_APPROVAL_TOKEN.trim();
    if (!approvalToken?.trim() || !expected || approvalToken.trim() !== expected) {
      throw new ForbiddenException("Deletion approval required.");
    }
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
