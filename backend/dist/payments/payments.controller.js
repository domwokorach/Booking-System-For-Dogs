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
import { Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Req, UseGuards, } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { PaymentsService } from "./payments.service.js";
let PaymentsController = class PaymentsController {
    payments;
    constructor(payments) {
        this.payments = payments;
    }
    webhook(request, signature) {
        return this.payments.handleWebhook(request.rawBody, signature);
    }
    createCheckout(user, bookingId) {
        return this.payments.createCheckoutForAppointment(user, bookingId);
    }
    getSessionStatus(user, sessionId) {
        return this.payments.getSessionStatus(user, sessionId);
    }
    async cancelPendingPayment(user, appointmentId) {
        return await this.payments.cancelPendingPayment(user, appointmentId);
    }
};
__decorate([
    Post("webhook"),
    HttpCode(HttpStatus.OK),
    __param(0, Req()),
    __param(1, Headers("stripe-signature")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "webhook", null);
__decorate([
    Post("checkout/:bookingId"),
    UseGuards(JwtAuthGuard),
    __param(0, CurrentUser()),
    __param(1, Param("bookingId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "createCheckout", null);
__decorate([
    Get("session/:sessionId"),
    UseGuards(JwtAuthGuard),
    __param(0, CurrentUser()),
    __param(1, Param("sessionId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "getSessionStatus", null);
__decorate([
    Post("appointments/:appointmentId/cancel"),
    HttpCode(HttpStatus.OK),
    UseGuards(JwtAuthGuard),
    __param(0, CurrentUser()),
    __param(1, Param("appointmentId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "cancelPendingPayment", null);
PaymentsController = __decorate([
    Controller("api/payments"),
    __metadata("design:paramtypes", [PaymentsService])
], PaymentsController);
export { PaymentsController };
