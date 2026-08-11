import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { PaymentsModule } from "../payments/payments.module.js";
import {
  AppointmentAvailabilityController,
  AppointmentDeletionController,
  AppointmentsController,
} from "./appointments.controller.js";
import { AppointmentsService } from "./appointments.service.js";

@Module({
  imports: [AuthModule, PaymentsModule],
  controllers: [
    AppointmentAvailabilityController,
    AppointmentDeletionController,
    AppointmentsController,
  ],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}
