var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
let AppModule = class AppModule {
};
AppModule = __decorate([
    Module({
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
], AppModule);
export { AppModule };
