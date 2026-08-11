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
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards, } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { createBookingSchema, rescheduleBookingSchema, rescheduleBookingSlotsQuerySchema, } from "./dto/bookings.schemas.js";
import { BookingsService } from "./bookings.service.js";
let BookingsController = class BookingsController {
    bookingsService;
    constructor(bookingsService) {
        this.bookingsService = bookingsService;
    }
    createAndConfirm(user, body) {
        return this.bookingsService.createAndConfirm(user, createBookingSchema.parse(body));
    }
    listMine(user) {
        return this.bookingsService.listMine(user);
    }
    availableForReschedule(user, id, query) {
        return this.bookingsService.availableForReschedule(user, id, rescheduleBookingSlotsQuerySchema.parse(query));
    }
    getOne(user, id) {
        return this.bookingsService.getOne(user, id);
    }
    confirm(user, id) {
        return this.bookingsService.confirm(user, id);
    }
    reschedule(user, id, body) {
        return this.bookingsService.reschedule(user, id, rescheduleBookingSchema.parse(body));
    }
    cancel(user, id) {
        return this.bookingsService.cancel(user, id);
    }
    requestDeletion(user, id) {
        return this.bookingsService.requestDeletion(user, id);
    }
};
__decorate([
    Post("confirm"),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "createAndConfirm", null);
__decorate([
    Get("me"),
    __param(0, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "listMine", null);
__decorate([
    Get(":id/slots"),
    __param(0, CurrentUser()),
    __param(1, Param("id")),
    __param(2, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "availableForReschedule", null);
__decorate([
    Get(":id"),
    __param(0, CurrentUser()),
    __param(1, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "getOne", null);
__decorate([
    Patch(":id/confirm"),
    __param(0, CurrentUser()),
    __param(1, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "confirm", null);
__decorate([
    Patch(":id/reschedule"),
    __param(0, CurrentUser()),
    __param(1, Param("id")),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "reschedule", null);
__decorate([
    Patch(":id/cancel"),
    __param(0, CurrentUser()),
    __param(1, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "cancel", null);
__decorate([
    Post(":id/delete-request"),
    HttpCode(HttpStatus.OK),
    __param(0, CurrentUser()),
    __param(1, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "requestDeletion", null);
BookingsController = __decorate([
    Controller("api/bookings"),
    UseGuards(JwtAuthGuard),
    __metadata("design:paramtypes", [BookingsService])
], BookingsController);
export { BookingsController };
