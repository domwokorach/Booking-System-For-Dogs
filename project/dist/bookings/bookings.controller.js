"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingsController = void 0;
const common_1 = require("@nestjs/common");
const get_user_decorator_1 = require("../common/get-user.decorator");
const jwt_auth_guard_1 = require("../common/jwt-auth.guard");
const create_booking_dto_1 = require("./create-booking/create-booking.dto");
const change_booking_date_dto_1 = require("./edit-booking/change-booking-date.dto");
const change_booking_time_dto_1 = require("./edit-booking/change-booking-time.dto");
const edit_booking_dto_1 = require("./edit-booking/edit-booking.dto");
const reschedule_booking_dto_1 = require("./reschedule-booking/reschedule-booking.dto");
const bookings_service_1 = require("./bookings.service");
let BookingsController = class BookingsController {
    constructor(bookingsService) {
        this.bookingsService = bookingsService;
    }
    createBooking(user, dto) {
        return this.bookingsService.createBooking(user.userId, dto);
    }
    listMyBookings(user) {
        return this.bookingsService.listMyBookings(user.userId);
    }
    viewBooking(user, id) {
        return this.bookingsService.viewBooking(user.userId, id);
    }
    confirmBooking(user, id) {
        return this.bookingsService.confirmBooking(user.userId, id);
    }
    editBooking(user, id, dto) {
        return this.bookingsService.editBooking(user.userId, id, dto);
    }
    rescheduleBooking(user, id, dto) {
        return this.bookingsService.rescheduleBooking(user.userId, id, dto);
    }
    changeBookingDate(user, id, dto) {
        return this.bookingsService.changeBookingDate(user.userId, id, dto);
    }
    changeBookingTime(user, id, dto) {
        return this.bookingsService.changeBookingTime(user.userId, id, dto);
    }
    cancelBooking(user, id) {
        return this.bookingsService.cancelBooking(user.userId, id);
    }
};
exports.BookingsController = BookingsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_booking_dto_1.CreateBookingDto]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "createBooking", null);
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "listMyBookings", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "viewBooking", null);
__decorate([
    (0, common_1.Patch)(':id/confirm'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "confirmBooking", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, edit_booking_dto_1.EditBookingDto]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "editBooking", null);
__decorate([
    (0, common_1.Patch)(':id/reschedule'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reschedule_booking_dto_1.RescheduleBookingDto]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "rescheduleBooking", null);
__decorate([
    (0, common_1.Patch)(':id/change-date'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, change_booking_date_dto_1.ChangeBookingDateDto]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "changeBookingDate", null);
__decorate([
    (0, common_1.Patch)(':id/change-time'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, change_booking_time_dto_1.ChangeBookingTimeDto]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "changeBookingTime", null);
__decorate([
    (0, common_1.Patch)(':id/cancel'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "cancelBooking", null);
exports.BookingsController = BookingsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('bookings'),
    __metadata("design:paramtypes", [bookings_service_1.BookingsService])
], BookingsController);
