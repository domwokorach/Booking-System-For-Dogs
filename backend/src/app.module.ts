import { Module } from "@nestjs/common";

import { AppController } from "./app.controller.js";
import { AppointmentsModule } from "./appointments/appointments.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { BookingsModule } from "./bookings/bookings.module.js";
import { ServicesModule } from "./catalog/services.module.js";
import { FilesModule } from "./files/files.module.js";
import { NotificationsModule } from "./notifications/notifications.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { RealtimeModule } from "./realtime/realtime.module.js";
import { ReviewsModule } from "./reviews/reviews.module.js";
import { SchedulingModule } from "./scheduling/scheduling.module.js";
import { SlotsModule } from "./slots/slots.module.js";
import { UsersModule } from "./users/users.module.js";

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    SchedulingModule,
    AuthModule,
    RealtimeModule,
    ReviewsModule,
    UsersModule,
    ServicesModule,
    SlotsModule,
    FilesModule,
    BookingsModule,
    AppointmentsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
