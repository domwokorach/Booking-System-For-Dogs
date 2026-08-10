var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Controller, Get } from "@nestjs/common";
let AppController = class AppController {
    root() {
        return {
            ok: true,
            message: "Pawside booking API is running.",
            architecture: "NestJS controllers and services with Prisma and PostgreSQL",
            endpoints: {
                health: "/health",
                auth: "/api/auth",
                appointments: "/api/appointments",
                bookings: "/api/bookings",
                services: "/api/services",
                slots: "/api/slots",
                users: "/api/users",
                files: "/api/files",
            },
        };
    }
    health() {
        return { ok: true };
    }
};
__decorate([
    Get(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "root", null);
__decorate([
    Get("health"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "health", null);
AppController = __decorate([
    Controller()
], AppController);
export { AppController };
