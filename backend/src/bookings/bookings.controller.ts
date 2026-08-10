import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";

import type { AuthUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import {
  createBookingSchema,
  rescheduleBookingSchema,
} from "./dto/bookings.schemas.js";
import { BookingsService } from "./bookings.service.js";

@Controller("api/bookings")
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post("confirm")
  createAndConfirm(
    @CurrentUser() user: AuthUser,
    @Body() body: unknown,
  ) {
    return this.bookingsService.createAndConfirm(
      user,
      createBookingSchema.parse(body),
    );
  }

  @Get("me")
  listMine(@CurrentUser() user: AuthUser) {
    return this.bookingsService.listMine(user);
  }

  @Get(":id")
  getOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.bookingsService.getOne(user, id);
  }

  @Patch(":id/confirm")
  confirm(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.bookingsService.confirm(user, id);
  }

  @Patch(":id/reschedule")
  reschedule(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.bookingsService.reschedule(
      user,
      id,
      rescheduleBookingSchema.parse(body),
    );
  }

  @Patch(":id/cancel")
  cancel(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.bookingsService.cancel(user, id);
  }

  @Delete(":id")
  delete(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Headers("x-delete-approval-token") approvalToken?: string,
  ) {
    return this.bookingsService.delete(user, id, approvalToken);
  }

  @Post(":id/delete-request")
  @HttpCode(HttpStatus.OK)
  requestDeletion(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.bookingsService.requestDeletion(user, id);
  }
}
