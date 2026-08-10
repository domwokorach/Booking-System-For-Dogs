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
  Query,
  UseGuards,
} from "@nestjs/common";

import type { AuthUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import {
  availableAppointmentsQuerySchema,
  createAppointmentSchema,
  rescheduleAppointmentSchema,
  updateAppointmentSchema,
} from "./dto/appointments.schemas.js";
import { AppointmentsService } from "./appointments.service.js";

@Controller("api/appointments")
export class AppointmentAvailabilityController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get("available")
  available(@Query() query: Record<string, unknown>) {
    const { date } = availableAppointmentsQuerySchema.parse(query);
    return this.appointmentsService.available(date);
  }
}

@Controller("api/appointments")
@UseGuards(JwtAuthGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get("mine")
  listMine(@CurrentUser() user: AuthUser) {
    return this.appointmentsService.listMine(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.appointmentsService.create(
      user,
      createAppointmentSchema.parse(body),
    );
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.appointmentsService.update(
      user,
      id,
      updateAppointmentSchema.parse(body),
    );
  }

  @Patch(":id/reschedule")
  reschedule(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.appointmentsService.reschedule(
      user,
      id,
      rescheduleAppointmentSchema.parse(body),
    );
  }

  @Patch(":id/confirm")
  confirm(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.appointmentsService.confirm(user, id);
  }

  @Patch(":id/cancel")
  cancel(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.appointmentsService.cancel(user, id);
  }

  @Delete(":id")
  delete(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Headers("x-delete-approval-token") approvalToken?: string,
  ) {
    return this.appointmentsService.delete(user, id, approvalToken);
  }

  @Post(":id/delete-request")
  @HttpCode(HttpStatus.OK)
  requestDeletion(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.appointmentsService.requestDeletion(user, id);
  }

  @Post(":id/email/confirmation")
  @HttpCode(HttpStatus.OK)
  sendConfirmation(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.appointmentsService.sendConfirmation(user, id);
  }

  @Post(":id/email/update")
  @HttpCode(HttpStatus.OK)
  sendUpdate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.appointmentsService.sendUpdate(user, id);
  }

  @Post(":id/email/cancellation")
  @HttpCode(HttpStatus.OK)
  sendCancellation(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.appointmentsService.sendCancellation(user, id);
  }
}
