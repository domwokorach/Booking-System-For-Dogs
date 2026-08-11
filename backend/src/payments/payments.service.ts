import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { AppointmentStatus, PaymentStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";
import Stripe from "stripe";

import type { AuthUser } from "../auth/auth.types.js";
import { env } from "../config/env.js";
import { EmailService } from "../notifications/email.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { RealtimeGateway } from "../realtime/realtime.gateway.js";

type CheckoutInput = {
  appointmentId: string;
  userId: string;
  customerEmail: string;
  customerName: string;
  serviceId: string;
  serviceName: string;
  amountPence: number;
  appointmentDateTime: Date;
};

const CHECKOUT_EXPIRY_SECONDS = 30 * 60;

@Injectable()
export class PaymentsService {
  private readonly stripe = env.STRIPE_SECRET_KEY.trim()
    ? new Stripe(env.STRIPE_SECRET_KEY.trim())
    : null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async createCheckout(input: CheckoutInput) {
    const stripe = this.requireStripe();
    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        appointmentId: input.appointmentId,
        userId: input.userId,
        status: PaymentStatus.Pending,
        stripeCheckoutSessionId: { not: null },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingPayment?.stripeCheckoutSessionId) {
      const existingSession = await stripe.checkout.sessions.retrieve(
        existingPayment.stripeCheckoutSessionId,
      );
      if (existingSession.status === "open" && existingSession.url) {
        return this.checkoutResponse(existingSession);
      }
      if (
        existingSession.status === "complete" ||
        existingSession.payment_status !== "unpaid"
      ) {
        throw new ConflictException(
          "Stripe is already processing this payment. Please wait for confirmation.",
        );
      }
      if (existingSession.status === "expired") {
        await this.prisma.payment.updateMany({
          where: {
            id: existingPayment.id,
            status: PaymentStatus.Pending,
          },
          data: { status: PaymentStatus.Expired, failedAt: new Date() },
        });
      }
    }

    const payment = await this.prisma.payment.create({
      data: {
        appointmentId: input.appointmentId,
        userId: input.userId,
        serviceId: input.serviceId,
        amountPence: input.amountPence,
        currency: env.STRIPE_CURRENCY.toLowerCase(),
      },
    });

    try {
      const frontendUrl = env.FRONTEND_URL.replace(/\/$/, "");
      const expiresAt = Math.floor(Date.now() / 1000) + CHECKOUT_EXPIRY_SECONDS;
      const metadata = {
        appointmentId: input.appointmentId,
        bookingId: input.appointmentId,
        paymentId: payment.id,
        userId: input.userId,
      };
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        integration_identifier: `pawside_checkout_${randomLetterSuffix()}`,
        client_reference_id: input.appointmentId,
        customer_email: input.customerEmail,
        invoice_creation: { enabled: true },
        billing_address_collection: "required",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: env.STRIPE_CURRENCY.toLowerCase(),
              unit_amount: input.amountPence,
              product_data: {
                name: `${input.serviceName} appointment`,
                description: `Appointment for ${input.customerName}`,
              },
            },
          },
        ],
        metadata,
        payment_intent_data: { metadata },
        success_url: `${frontendUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/payment-cancelled?appointmentId=${encodeURIComponent(input.appointmentId)}`,
        expires_at: expiresAt,
        submit_type: "book",
      });

      if (!session.url) {
        throw new Error("Stripe did not return a Checkout URL.");
      }

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          stripeCheckoutSessionId: session.id,
          checkoutExpiresAt: new Date(session.expires_at * 1000),
        },
      });
      return this.checkoutResponse(session);
    } catch (error) {
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.Pending },
        data: { status: PaymentStatus.Failed, failedAt: new Date() },
      });
      throw new BadGatewayException(
        error instanceof Error
          ? `Unable to start Stripe Checkout: ${error.message}`
          : "Unable to start Stripe Checkout.",
      );
    }
  }

  async createCheckoutForAppointment(user: AuthUser, appointmentId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, userId: user.id },
      include: { user: true, serviceRef: true },
    });
    if (!appointment) {
      throw new NotFoundException("Appointment not found.");
    }
    if (appointment.status !== AppointmentStatus.Pending) {
      throw new BadRequestException(
        appointment.status === AppointmentStatus.Confirmed
          ? "This appointment is already confirmed."
          : "Only pending appointments can be paid.",
      );
    }
    if (!appointment.serviceRef) {
      throw new BadRequestException(
        "This appointment does not have a payable service.",
      );
    }

    return this.createCheckout({
      appointmentId: appointment.id,
      userId: appointment.userId,
      customerEmail: appointment.user.email,
      customerName: `${appointment.user.firstName} ${appointment.user.surname}`,
      serviceId: appointment.serviceRef.id,
      serviceName: appointment.serviceRef.name,
      amountPence: appointment.serviceRef.pricePence,
      appointmentDateTime: appointment.dateTime,
    });
  }

  async handleWebhook(rawBody: Buffer | undefined, signature?: string) {
    const stripe = this.requireStripe();
    const webhookSecret = env.STRIPE_WEBHOOK_SECRET.trim();
    if (!webhookSecret) {
      throw new ServiceUnavailableException(
        "Stripe webhook verification is not configured.",
      );
    }
    if (!rawBody || !signature) {
      throw new BadRequestException("Missing Stripe webhook signature.");
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch {
      throw new BadRequestException("Invalid Stripe webhook signature.");
    }

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object;
      if (session.payment_status !== "unpaid") {
        await this.fulfillPaidSession(session);
      }
    } else if (event.type === "checkout.session.async_payment_failed") {
      await this.markUnsuccessfulSession(event.data.object, PaymentStatus.Failed);
    } else if (event.type === "checkout.session.expired") {
      await this.markUnsuccessfulSession(event.data.object, PaymentStatus.Expired);
    } else if (
      event.type === "refund.created" ||
      event.type === "refund.updated" ||
      event.type === "refund.failed"
    ) {
      await this.updateRefundStatus(event.data.object);
    }

    return { received: true };
  }

  async getSessionStatus(user: AuthUser, sessionId: string) {
    const payment = await this.findOwnedPayment(user.id, sessionId);

    return {
      paymentStatus: payment.status.toUpperCase(),
      appointmentStatus: payment.appointment.status.toUpperCase(),
      appointmentId: payment.appointmentId,
      amountPence: payment.amountPence,
      currency: payment.currency,
    };
  }

  async cancelPendingPayment(user: AuthUser, appointmentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        appointmentId,
        userId: user.id,
        status: PaymentStatus.Pending,
      },
      orderBy: { createdAt: "desc" },
    });
    if (!payment) {
      throw new NotFoundException("Pending payment not found.");
    }

    if (payment.stripeCheckoutSessionId) {
      const stripe = this.requireStripe();
      const session = await stripe.checkout.sessions.retrieve(
        payment.stripeCheckoutSessionId,
      );
      if (session.payment_status !== "unpaid") {
        return {
          success: true,
          message:
            "Payment succeeded. Stripe webhook confirmation is being processed.",
        };
      }
      if (session.status === "open") {
        await stripe.checkout.sessions.expire(payment.stripeCheckoutSessionId);
      }
    }
    await this.cancelPendingAppointment(
      payment.id,
      appointmentId,
      payment.userId,
      PaymentStatus.Expired,
    );
    return { success: true, message: "Payment and pending appointment cancelled." };
  }

  async cancelAndRefund(user: AuthUser, appointmentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        appointmentId,
        userId: user.id,
        status: {
          in: [
            PaymentStatus.Paid,
            PaymentStatus.RefundPending,
            PaymentStatus.Refunded,
            PaymentStatus.RefundFailed,
          ],
        },
      },
      include: {
        appointment: { include: { user: true, serviceRef: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!payment) {
      return null;
    }
    if (payment.status === PaymentStatus.RefundPending) {
      return this.refundResponse(
        payment,
        "Your booking is cancelled and the refund is still processing.",
      );
    }
    if (payment.status === PaymentStatus.Refunded) {
      return this.refundResponse(
        payment,
        "Your booking is cancelled and the refund has been completed.",
      );
    }
    if (payment.status === PaymentStatus.RefundFailed) {
      return this.refundResponse(
        payment,
        "Your booking is cancelled, but Stripe could not complete the refund. Please contact us.",
      );
    }
    if (!payment.stripePaymentIntentId) {
      throw new BadRequestException(
        "The Stripe payment reference is missing. Please contact us before cancelling.",
      );
    }

    const stripe = this.requireStripe();
    let refund: Stripe.Refund;
    try {
      refund = await stripe.refunds.create(
        {
          payment_intent: payment.stripePaymentIntentId,
          reason: "requested_by_customer",
          metadata: {
            appointmentId,
            bookingId: appointmentId,
            paymentId: payment.id,
            userId: user.id,
          },
        },
        { idempotencyKey: `pawside-refund-${payment.id}` },
      );
    } catch {
      throw new BadGatewayException(
        "Unable to request the Stripe refund. Your booking has not been cancelled; please try again.",
      );
    }

    const now = new Date();
    const result = await this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.Paid },
        data: {
          status: PaymentStatus.RefundPending,
          stripeRefundId: refund.id,
          refundRequestedAt: now,
          refundFailedAt: null,
          refundFailureReason: null,
        },
      });
      const cancelled = await transaction.appointment.updateMany({
        where: {
          id: appointmentId,
          userId: user.id,
          status: { not: AppointmentStatus.Cancelled },
        },
        data: {
          status: AppointmentStatus.Cancelled,
          cancelledAt: now,
        },
      });
      const currentPayment = await transaction.payment.findUniqueOrThrow({
        where: { id: payment.id },
        include: {
          appointment: { include: { user: true, serviceRef: true } },
        },
      });
      return {
        payment: currentPayment,
        refundClaimed: claimed.count === 1,
        appointmentCancelled: cancelled.count === 1,
      };
    });

    if (result.appointmentCancelled) {
      this.realtime.emitToUser(user.id, "appointments:cancelled", {
        appointmentId,
        dateTime: result.payment.appointment.dateTime,
        status: AppointmentStatus.Cancelled,
      });
    }
    if (result.refundClaimed) {
      await this.email.sendRefundRequested({
        to: result.payment.appointment.user.email,
        firstName: result.payment.appointment.user.firstName,
        bookingId: appointmentId,
        service:
          result.payment.appointment.serviceRef?.name ??
          result.payment.appointment.service,
        appointmentDateTime: result.payment.appointment.dateTime,
        status: AppointmentStatus.Cancelled,
        amountPence: result.payment.amountPence,
        currency: result.payment.currency,
        paymentStatus: "REFUND_PENDING",
        refundId: refund.id,
      });
    }

    return this.refundResponse(
      result.payment,
      "Your booking has been cancelled and your refund has been requested.",
    );
  }

  private async fulfillPaidSession(session: Stripe.Checkout.Session) {
    const payment = await this.findPaymentForSession(session);
    if (!payment) {
      throw new BadRequestException("Stripe payment record not found.");
    }
    if (
      session.amount_total !== payment.amountPence ||
      session.currency?.toLowerCase() !== payment.currency.toLowerCase()
    ) {
      throw new BadRequestException("Stripe payment amount does not match.");
    }

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
    const invoiceId =
      typeof session.invoice === "string"
        ? session.invoice
        : session.invoice?.id;
    const result = await this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.Pending },
        data: {
          status: PaymentStatus.Paid,
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
          stripeInvoiceId: invoiceId,
          paidAt: new Date(),
          failedAt: null,
        },
      });
      if (claimed.count === 0 && invoiceId) {
        await transaction.payment.updateMany({
          where: {
            id: payment.id,
            status: PaymentStatus.Paid,
            stripeInvoiceId: null,
          },
          data: { stripeInvoiceId: invoiceId },
        });
      }
      const confirmed = await transaction.appointment.updateMany({
        where: {
          id: payment.appointmentId,
          userId: payment.userId,
          status: AppointmentStatus.Pending,
        },
        data: {
          status: AppointmentStatus.Confirmed,
          confirmedAt: new Date(),
        },
      });
      if (claimed.count === 0 && confirmed.count === 0) {
        return null;
      }

      const appointment = await transaction.appointment.findUnique({
        where: { id: payment.appointmentId },
        include: { user: true, serviceRef: true },
      });
      if (!appointment) {
        throw new BadRequestException("Appointment not found for payment.");
      }

      return { appointment, shouldNotify: confirmed.count === 1 };
    });

    if (!result?.shouldNotify) {
      return;
    }
    const { appointment } = result;
    this.realtime.emitToUser(appointment.userId, "appointments:confirmed", {
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
      amountPence: payment.amountPence,
      currency: payment.currency,
      paymentStatus: PaymentStatus.Paid.toUpperCase(),
    });
  }

  private async markUnsuccessfulSession(
    session: Stripe.Checkout.Session,
    status: PaymentStatus,
  ) {
    const payment = await this.findPaymentForSession(session);
    if (!payment || payment.status !== PaymentStatus.Pending) {
      return;
    }
    await this.cancelPendingAppointment(
      payment.id,
      payment.appointmentId,
      payment.userId,
      status,
    );
  }

  private async cancelPendingAppointment(
    paymentId: string,
    appointmentId: string,
    userId: string,
    status: PaymentStatus,
  ) {
    const cancelled = await this.prisma.$transaction(async (transaction) => {
      const changedPayment = await transaction.payment.updateMany({
        where: { id: paymentId, status: PaymentStatus.Pending },
        data: { status, failedAt: new Date() },
      });
      if (changedPayment.count !== 1) {
        return { count: 0 };
      }

      const replacementPayment = await transaction.payment.count({
        where: {
          appointmentId,
          id: { not: paymentId },
          status: { in: [PaymentStatus.Pending, PaymentStatus.Paid] },
        },
      });
      if (replacementPayment > 0) {
        return { count: 0 };
      }

      return transaction.appointment.updateMany({
        where: { id: appointmentId, status: AppointmentStatus.Pending },
        data: { status: AppointmentStatus.Cancelled, cancelledAt: new Date() },
      });
    });
    if (cancelled.count === 1) {
      this.realtime.emitToUser(userId, "appointments:cancelled", {
        appointmentId,
        status: AppointmentStatus.Cancelled,
      });
    }
  }

  private async findPaymentForSession(session: Stripe.Checkout.Session) {
    const paymentId = session.metadata?.paymentId;
    return this.prisma.payment.findFirst({
      where: {
        OR: [
          { stripeCheckoutSessionId: session.id },
          ...(paymentId ? [{ id: paymentId }] : []),
        ],
      },
    });
  }

  private async updateRefundStatus(refund: Stripe.Refund) {
    const paymentId = refund.metadata?.paymentId;
    const payment = await this.prisma.payment.findFirst({
      where: {
        OR: [
          { stripeRefundId: refund.id },
          ...(paymentId ? [{ id: paymentId }] : []),
        ],
      },
      include: {
        appointment: { include: { user: true, serviceRef: true } },
      },
    });
    if (!payment) {
      throw new BadRequestException("Stripe refund payment record not found.");
    }
    if (
      refund.amount !== payment.amountPence ||
      refund.currency.toLowerCase() !== payment.currency.toLowerCase()
    ) {
      throw new BadRequestException("Stripe refund amount does not match.");
    }

    const nextStatus =
      refund.status === "succeeded"
        ? PaymentStatus.Refunded
        : refund.status === "failed" || refund.status === "canceled"
          ? PaymentStatus.RefundFailed
          : PaymentStatus.RefundPending;
    const now = new Date();
    const changed = await this.prisma.payment.updateMany({
      where: {
        id: payment.id,
        status:
          nextStatus === PaymentStatus.Refunded
            ? { not: PaymentStatus.Refunded }
            : nextStatus === PaymentStatus.RefundFailed
              ? { notIn: [PaymentStatus.Refunded, PaymentStatus.RefundFailed] }
              : PaymentStatus.Paid,
      },
      data: {
        status: nextStatus,
        stripeRefundId: refund.id,
        refundRequestedAt: payment.refundRequestedAt ?? now,
        refundedAt: nextStatus === PaymentStatus.Refunded ? now : null,
        refundFailedAt: nextStatus === PaymentStatus.RefundFailed ? now : null,
        refundFailureReason:
          nextStatus === PaymentStatus.RefundFailed
            ? refund.failure_reason ?? "unknown"
            : null,
      },
    });
    if (changed.count !== 1) {
      return;
    }

    this.realtime.emitToUser(payment.userId, "appointments:updated", {
      appointmentId: payment.appointmentId,
      status: AppointmentStatus.Cancelled,
      paymentStatus: paymentStatusResponse(nextStatus),
    });
    const emailData = {
      to: payment.appointment.user.email,
      firstName: payment.appointment.user.firstName,
      bookingId: payment.appointmentId,
      service:
        payment.appointment.serviceRef?.name ?? payment.appointment.service,
      appointmentDateTime: payment.appointment.dateTime,
      status: AppointmentStatus.Cancelled,
      amountPence: payment.amountPence,
      currency: payment.currency,
      paymentStatus: paymentStatusResponse(nextStatus),
      refundId: refund.id,
      refundFailureReason: refund.failure_reason,
    };
    if (nextStatus === PaymentStatus.Refunded) {
      await this.email.sendRefundConfirmation(emailData);
    } else if (nextStatus === PaymentStatus.RefundFailed) {
      await this.email.sendRefundFailure(emailData);
    } else if (nextStatus === PaymentStatus.RefundPending) {
      await this.email.sendRefundRequested(emailData);
    }
  }

  private findOwnedPayment(userId: string, sessionId: string) {
    return this.prisma.payment
      .findFirst({
        where: { stripeCheckoutSessionId: sessionId, userId },
        include: { appointment: true },
      })
      .then((payment) => {
        if (!payment) {
          throw new NotFoundException("Payment not found.");
        }
        return payment;
      });
  }

  private checkoutResponse(session: Stripe.Checkout.Session) {
    return {
      checkoutUrl: session.url,
      checkoutSessionId: session.id,
      paymentStatus: "PENDING" as const,
      expiresAt: new Date(session.expires_at * 1000),
    };
  }

  private refundResponse(payment: {
    appointmentId: string;
    stripeRefundId: string | null;
    amountPence: number;
    currency: string;
    status: PaymentStatus;
  }, message: string) {
    return {
      success: true,
      appointmentId: payment.appointmentId,
      status: AppointmentStatus.Cancelled,
      paymentStatus: paymentStatusResponse(payment.status),
      refundStatus: paymentStatusResponse(payment.status),
      refundId: payment.stripeRefundId,
      refundAmountPence: payment.amountPence,
      currency: payment.currency,
      message,
    };
  }

  private requireStripe(): Stripe {
    if (!this.stripe) {
      throw new ServiceUnavailableException(
        "Stripe is not configured. Add STRIPE_SECRET_KEY to the backend environment.",
      );
    }
    return this.stripe;
  }
}

function randomLetterSuffix(): string {
  return Array.from(randomBytes(8), (byte) =>
    String.fromCharCode(97 + (byte % 26)),
  ).join("");
}

function paymentStatusResponse(status: PaymentStatus): string {
  return status.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
}
