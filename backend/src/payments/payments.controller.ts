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

  @Get("session/:sessionId")
  @UseGuards(JwtAuthGuard)
  getSessionStatus(
    @CurrentUser() user: AuthUser,
    @Param("sessionId") sessionId: string,
  ) {
    return this.payments.getSessionStatus(user, sessionId);
  }

  @Post("appointments/:appointmentId/cancel")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  cancelPendingPayment(
    @CurrentUser() user: AuthUser,
    @Param("appointmentId") appointmentId: string,
  ) {
    return this.payments.cancelPendingPayment(user, appointmentId);
  }
}
