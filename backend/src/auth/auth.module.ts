import { Module } from "@nestjs/common";

import { NotificationsModule } from "../notifications/notifications.module.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { AuthTokenService } from "./auth-token.service.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [AuthController],
  providers: [AuthService, AuthTokenService, JwtAuthGuard],
  exports: [AuthService, AuthTokenService, JwtAuthGuard],
})
export class AuthModule {}
