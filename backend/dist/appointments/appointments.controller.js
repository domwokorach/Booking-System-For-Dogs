var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards, } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { availableAppointmentsQuerySchema, createAppointmentSchema, rescheduleAppointmentSchema, updateAppointmentSchema, } from "./dto/appointments.schemas.js";
import { AppointmentsService } from "./appointments.service.js";
let AppointmentAvailabilityController = class AppointmentAvailabilityController {
    appointmentsService;
    constructor(appointmentsService) {
        this.appointmentsService = appointmentsService;
    }
    available(query) {
        const { date } = availableAppointmentsQuerySchema.parse(query);
        return this.appointmentsService.available(date);
    }
};
__decorate([
    Get("available"),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AppointmentAvailabilityController.prototype, "available", null);
AppointmentAvailabilityController = __decorate([
    Controller("api/appointments"),
    __metadata("design:paramtypes", [AppointmentsService])
], AppointmentAvailabilityController);
export { AppointmentAvailabilityController };
let AppointmentsController = class AppointmentsController {
    appointmentsService;
    constructor(appointmentsService) {
        this.appointmentsService = appointmentsService;
    }
    listMine(user) {
        return this.appointmentsService.listMine(user);
    }
    create(user, body) {
        return this.appointmentsService.create(user, createAppointmentSchema.parse(body));
    }
    update(user, id, body) {
        return this.appointmentsService.update(user, id, updateAppointmentSchema.parse(body));
    }
    reschedule(user, id, body) {
        return this.appointmentsService.reschedule(user, id, rescheduleAppointmentSchema.parse(body));
    }
    confirm(user, id) {
        return this.appointmentsService.confirm(user, id);
    }
    cancel(user, id) {
        return this.appointmentsService.cancel(user, id);
    }
    delete(user, id, approvalToken) {
        return this.appointmentsService.delete(user, id, approvalToken);
    }
    requestDeletion(user, id) {
        return this.appointmentsService.requestDeletion(user, id);
    }
    sendConfirmation(user, id) {
        return this.appointmentsService.sendConfirmation(user, id);
    }
    sendUpdate(user, id) {
        return this.appointmentsService.sendUpdate(user, id);
    }
    sendCancellation(user, id) {
        return this.appointmentsService.sendCancellation(user, id);
    }
};
__decorate([
    Get("mine"),
    __param(0, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "listMine", null);
__decorate([
    Post(),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "create", null);
__decorate([
    Patch(":id"),
    __param(0, CurrentUser()),
    __param(1, Param("id")),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "update", null);
__decorate([
    Patch(":id/reschedule"),
    __param(0, CurrentUser()),
    __param(1, Param("id")),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "reschedule", null);
__decorate([
    Patch(":id/confirm"),
    __param(0, CurrentUser()),
    __param(1, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "confirm", null);
__decorate([
    Patch(":id/cancel"),
    __param(0, CurrentUser()),
    __param(1, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "cancel", null);
__decorate([
    Delete(":id"),
    __param(0, CurrentUser()),
    __param(1, Param("id")),
    __param(2, Headers("x-delete-approval-token")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "delete", null);
__decorate([
    Post(":id/delete-request"),
    HttpCode(HttpStatus.OK),
    __param(0, CurrentUser()),
    __param(1, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "requestDeletion", null);
__decorate([
    Post(":id/email/confirmation"),
    HttpCode(HttpStatus.OK),
    __param(0, CurrentUser()),
    __param(1, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "sendConfirmation", null);
__decorate([
    Post(":id/email/update"),
    HttpCode(HttpStatus.OK),
    __param(0, CurrentUser()),
    __param(1, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "sendUpdate", null);
__decorate([
    Post(":id/email/cancellation"),
    HttpCode(HttpStatus.OK),
    __param(0, CurrentUser()),
    __param(1, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "sendCancellation", null);
AppointmentsController = __decorate([
    Controller("api/appointments"),
    UseGuards(JwtAuthGuard),
    __metadata("design:paramtypes", [AppointmentsService])
], AppointmentsController);
export { AppointmentsController };
