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
import { Controller, Get, UseGuards, Post, Param } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
let AdminController = class AdminController {
    adminService;
    constructor(adminService) {
        this.adminService = adminService;
    }
    async getCustomers() {
        return this.adminService.getCustomers();
    }
    async getBookings() {
        return this.adminService.getBookings();
    }
    async approveCancellation(appointmentId) {
        return this.adminService.approveCancellation(appointmentId);
    }
    async approveRequest(id) {
        return this.adminService.approveRequest(id);
    }
};
__decorate([
    Get('customers'),
    Roles('ADMIN', 'STAFF'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getCustomers", null);
__decorate([
    Get('bookings'),
    Roles('ADMIN', 'STAFF'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getBookings", null);
__decorate([
    Post('bookings/:appointmentId/approve-cancellation'),
    Roles('ADMIN', 'STAFF'),
    __param(0, Param('appointmentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "approveCancellation", null);
__decorate([
    Post('requests/:id/approve'),
    Roles('ADMIN', 'STAFF'),
    __param(0, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "approveRequest", null);
AdminController = __decorate([
    Controller('api/admin'),
    UseGuards(JwtAuthGuard, RolesGuard),
    __metadata("design:paramtypes", [AdminService])
], AdminController);
export { AdminController };
