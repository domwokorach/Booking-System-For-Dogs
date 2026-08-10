var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { AuthTokenService } from "./auth-token.service.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
let AuthModule = class AuthModule {
};
AuthModule = __decorate([
    Module({
        imports: [PrismaModule, NotificationsModule],
        controllers: [AuthController],
        providers: [AuthService, AuthTokenService, JwtAuthGuard],
        exports: [AuthService, AuthTokenService, JwtAuthGuard],
    })
], AuthModule);
export { AuthModule };
