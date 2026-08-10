import { Global, Module } from "@nestjs/common";

import { AppointmentSlotsService } from "./appointment-slots.service.js";

@Global()
@Module({
  providers: [AppointmentSlotsService],
  exports: [AppointmentSlotsService],
})
export class SchedulingModule {}
