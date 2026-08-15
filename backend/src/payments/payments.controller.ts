import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";

import type { AuthUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { PaymentsService } from "./payments.service.js";

@Controller("api/payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature?: string,
  ) {
    return this.payments.handleWebhook(request.rawBody, signature);
  }

  @Post("checkout/:bookingId")
  @UseGuards(JwtAuthGuard)
  createCheckout(
    @CurrentUser() user: AuthUser,
    @Param("bookingId") bookingId: string,
  ) {
    return this.payments.createCheckoutForAppointment(user, bookingId);
  }

  @Get("session/:sessionId")
  @UseGuards(JwtAuthGuard)
  getSessionStatus(
    @CurrentUser() user: AuthUser,
    @Param("sessionId") sessionId: string,
  ) {
    return this.payments.getSessionStatus(user, sessionId);
  }

  @Post("appointments/:appointmentId/cancel")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async cancelPendingPayment(
    @CurrentUser() user: AuthUser,
    @Param("appointmentId") appointmentId: string,
  ) {
    return await this.payments.cancelPendingPayment(user, appointmentId);
  }
}
