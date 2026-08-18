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
import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';
import { loginSchema } from '../auth/dto/auth.schemas.js';
let AdminAuthController = class AdminAuthController {
    authService;
    constructor(authService) {
        this.authService = authService;
    }
    async login(body) {
        const loginData = loginSchema.parse(body);
        const result = await this.authService.login(loginData);
        if (!['ADMIN', 'STAFF'].includes(result.user.role)) {
            throw new HttpException('Access denied: Admin or Staff role required', HttpStatus.FORBIDDEN);
        }
        return result;
    }
};
__decorate([
    Post('login'),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminAuthController.prototype, "login", null);
AdminAuthController = __decorate([
    Controller('api/admin'),
    __metadata("design:paramtypes", [AuthService])
], AdminAuthController);
export { AdminAuthController };
