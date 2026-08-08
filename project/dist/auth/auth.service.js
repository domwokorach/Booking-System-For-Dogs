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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcryptjs");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
let AuthService = class AuthService {
    constructor(prisma, jwtService, configService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async register(dto) {
        if (dto.password !== dto.confirmPassword) {
            throw new common_1.BadRequestException('Password and confirm password do not match.');
        }
        const existing = await this.prisma.user.findFirst({
            where: {
                OR: [{ email: dto.email }, { mobileNumber: dto.mobileNumber }],
            },
            select: { id: true },
        });
        if (existing) {
            throw new common_1.BadRequestException('User with email or mobile number already exists.');
        }
        const passwordHash = await bcrypt.hash(dto.password, 12);
        const user = await this.prisma.user.create({
            data: {
                firstName: dto.firstName,
                surname: dto.surname,
                fullName: dto.fullName,
                address: dto.address,
                email: dto.email,
                mobileNumber: dto.mobileNumber,
                passwordHash,
            },
        });
        const token = await this.signToken(user);
        return {
            message: 'Registration successful.',
            token,
            user: this.toSafeUser(user),
        };
    }
    async login(dto) {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid credentials.');
        }
        const isValid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!isValid) {
            throw new common_1.UnauthorizedException('Invalid credentials.');
        }
        const token = await this.signToken(user);
        return {
            message: 'Login successful.',
            token,
            user: this.toSafeUser(user),
        };
    }
    async logout() {
        return { message: 'Logout successful.' };
    }
    async forgotPassword(dto) {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (!user) {
            return {
                message: 'If an account exists for that email, a reset link has been sent.',
            };
        }
        const rawToken = (0, crypto_1.randomBytes)(32).toString('hex');
        const tokenHash = (0, crypto_1.createHash)('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60);
        await this.prisma.passwordResetToken.create({
            data: {
                userId: user.id,
                tokenHash,
                expiresAt,
            },
        });
        const response = {
            message: 'If an account exists for that email, a reset link has been sent.',
        };
        if (this.configService.get('NODE_ENV') !== 'production') {
            response.resetToken = rawToken;
        }
        return response;
    }
    async resetPassword(dto) {
        if (dto.newPassword !== dto.confirmPassword) {
            throw new common_1.BadRequestException('New password and confirm password do not match.');
        }
        const tokenHash = (0, crypto_1.createHash)('sha256').update(dto.token).digest('hex');
        const token = await this.prisma.passwordResetToken.findFirst({
            where: {
                tokenHash,
                usedAt: null,
                expiresAt: {
                    gt: new Date(),
                },
            },
            include: {
                user: true,
            },
        });
        if (!token) {
            throw new common_1.BadRequestException('Invalid or expired reset token.');
        }
        const passwordHash = await bcrypt.hash(dto.newPassword, 12);
        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: token.userId },
                data: { passwordHash },
            }),
            this.prisma.passwordResetToken.update({
                where: { id: token.id },
                data: { usedAt: new Date() },
            }),
        ]);
        return { message: 'Password reset successful.' };
    }
    async signToken(user) {
        return this.jwtService.signAsync({
            sub: user.id,
            email: user.email,
        }, {
            secret: this.configService.get('JWT_ACCESS_SECRET') ??
                this.configService.get('JWT_SECRET') ??
                'fallback-secret',
            expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN') ??
                this.configService.get('JWT_EXPIRES_IN') ??
                '1d',
        });
    }
    toSafeUser(user) {
        return {
            id: user.id,
            firstName: user.firstName,
            surname: user.surname,
            fullName: user.fullName,
            address: user.address,
            email: user.email,
            mobileNumber: user.mobileNumber,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
