import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import {
  AppointmentAvailabilityController,
  AppointmentsController,
} from "./appointments.controller.js";
import { AppointmentsService } from "./appointments.service.js";

@Module({
  imports: [AuthModule],
  controllers: [AppointmentAvailabilityController, AppointmentsController],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}
