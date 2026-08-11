import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { AppointmentStatus, PaymentStatus } from "@prisma/client";
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
        checkoutExpiresAt: { gt: new Date() },
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
        paymentId: payment.id,
        userId: input.userId,
      };
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        client_reference_id: input.appointmentId,
        customer_email: input.customerEmail,
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
        success_url: `${frontendUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/?payment=cancelled&appointmentId=${encodeURIComponent(input.appointmentId)}`,
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
    }

    return { received: true };
  }

  async getSessionStatus(user: AuthUser, sessionId: string) {
    let payment = await this.findOwnedPayment(user.id, sessionId);
    if (payment.status === PaymentStatus.Pending && this.stripe) {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== "unpaid") {
        await this.fulfillPaidSession(session);
        payment = await this.findOwnedPayment(user.id, sessionId);
      }
    }

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
        await this.fulfillPaidSession(session);
        return {
          success: true,
          message: "Payment succeeded and the appointment is confirmed.",
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
    const result = await this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.payment.updateMany({
        where: { id: payment.id, status: { not: PaymentStatus.Paid } },
        data: {
          status: PaymentStatus.Paid,
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
          paidAt: new Date(),
          failedAt: null,
        },
      });
      if (claimed.count !== 1) {
        return null;
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
      if (confirmed.count !== 1) {
        return null;
      }

      return transaction.appointment.findUnique({
        where: { id: payment.appointmentId },
        include: { user: true, serviceRef: true },
      });
    });

    if (!result) {
      return;
    }
    this.realtime.emitToUser(result.userId, "appointments:confirmed", {
      appointmentId: result.id,
      dateTime: result.dateTime,
      status: result.status,
    });
    await this.email.sendBookingConfirmation({
      to: result.user.email,
      firstName: result.user.firstName,
      bookingId: result.id,
      service: result.serviceRef?.name ?? result.service,
      appointmentDateTime: result.dateTime,
      status: result.status,
    });
  }

  private async markUnsuccessfulSession(
    session: Stripe.Checkout.Session,
    status: PaymentStatus,
  ) {
    const payment = await this.findPaymentForSession(session);
    if (!payment || payment.status === PaymentStatus.Paid) {
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
      await transaction.payment.updateMany({
        where: { id: paymentId, status: PaymentStatus.Pending },
        data: { status, failedAt: new Date() },
      });
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

  private requireStripe(): Stripe {
    if (!this.stripe) {
      throw new ServiceUnavailableException(
        "Stripe is not configured. Add STRIPE_SECRET_KEY to the backend environment.",
      );
    }
    return this.stripe;
  }
}
