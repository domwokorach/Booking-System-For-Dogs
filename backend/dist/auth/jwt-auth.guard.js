var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { HttpException, HttpStatus, Injectable, } from "@nestjs/common";
import { AuthTokenService } from "./auth-token.service.js";
let JwtAuthGuard = class JwtAuthGuard {
    authTokenService;
    constructor(authTokenService) {
        this.authTokenService = authTokenService;
    }
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const authorization = request.headers.authorization;
        if (!authorization || !authorization.startsWith("Bearer ")) {
            throw new HttpException("Missing or invalid authorization token.", HttpStatus.UNAUTHORIZED);
        }
        try {
            request.user = this.authTokenService.verifyAccessToken(authorization.slice("Bearer ".length));
            return true;
        }
        catch {
            throw new HttpException("Invalid or expired token.", HttpStatus.UNAUTHORIZED);
        }
    }
};
JwtAuthGuard = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [AuthTokenService])
], JwtAuthGuard);
export { JwtAuthGuard };
