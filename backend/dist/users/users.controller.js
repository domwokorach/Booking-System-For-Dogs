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
import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, UseGuards, } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { accountDeletionTokenSchema, changePasswordSchema, deleteAccountSchema, updateProfileSchema, } from "./dto/users.schemas.js";
import { UsersService } from "./users.service.js";
let UsersController = class UsersController {
    usersService;
    constructor(usersService) {
        this.usersService = usersService;
    }
    confirmAccountDeletion(body) {
        return this.usersService.confirmAccountDeletion(accountDeletionTokenSchema.parse(body));
    }
    cancelAccountDeletion(body) {
        return this.usersService.cancelAccountDeletion(accountDeletionTokenSchema.parse(body));
    }
    getCurrentUser(currentUser) {
        return this.usersService.getCurrentUser(currentUser);
    }
    updateCurrentUser(currentUser, body) {
        return this.usersService.updateCurrentUser(currentUser, updateProfileSchema.parse(body));
    }
    changePassword(currentUser, body) {
        return this.usersService.changePassword(currentUser, changePasswordSchema.parse(body));
    }
    requestAccountDeletion(currentUser, body) {
        return this.usersService.requestAccountDeletion(currentUser, deleteAccountSchema.parse(body));
    }
};
__decorate([
    Post("delete-account/confirm"),
    HttpCode(HttpStatus.OK),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "confirmAccountDeletion", null);
__decorate([
    Post("delete-account/cancel"),
    HttpCode(HttpStatus.OK),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "cancelAccountDeletion", null);
__decorate([
    Get("me"),
    UseGuards(JwtAuthGuard),
    __param(0, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "getCurrentUser", null);
__decorate([
    Patch("me"),
    UseGuards(JwtAuthGuard),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "updateCurrentUser", null);
__decorate([
    Patch("me/password"),
    UseGuards(JwtAuthGuard),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "changePassword", null);
__decorate([
    Post("me/delete-request"),
    UseGuards(JwtAuthGuard),
    HttpCode(HttpStatus.ACCEPTED),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "requestAccountDeletion", null);
UsersController = __decorate([
    Controller("api/users"),
    __metadata("design:paramtypes", [UsersService])
], UsersController);
export { UsersController };
