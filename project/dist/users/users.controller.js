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
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const get_user_decorator_1 = require("../common/get-user.decorator");
const jwt_auth_guard_1 = require("../common/jwt-auth.guard");
const delete_account_dto_1 = require("./delete-account/delete-account.dto");
const edit_profile_dto_1 = require("./edit-profile/edit-profile.dto");
const change_password_dto_1 = require("./profile/change-password.dto");
const users_service_1 = require("./users.service");
let UsersController = class UsersController {
    constructor(usersService) {
        this.usersService = usersService;
    }
    getAccount(user) {
        return this.usersService.getAccount(user.userId);
    }
    editAccount(user, dto) {
        return this.usersService.editAccount(user.userId, dto);
    }
    getBookings(user) {
        return this.usersService.getBookings(user.userId);
    }
    changePassword(user, dto) {
        return this.usersService.changePassword(user.userId, dto);
    }
    deleteAccount(user, dto) {
        return this.usersService.deleteAccount(user.userId, dto);
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Get)('account'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "getAccount", null);
__decorate([
    (0, common_1.Patch)('account'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, edit_profile_dto_1.EditProfileDto]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "editAccount", null);
__decorate([
    (0, common_1.Get)('account/bookings'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "getBookings", null);
__decorate([
    (0, common_1.Patch)('account/change-password'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, change_password_dto_1.ChangePasswordDto]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "changePassword", null);
__decorate([
    (0, common_1.Delete)('account'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, delete_account_dto_1.DeleteAccountDto]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "deleteAccount", null);
exports.UsersController = UsersController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('users'),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], UsersController);
