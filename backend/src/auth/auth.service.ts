import { createHash, randomBytes } from "node:crypto";

import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import argon2 from "argon2";
import bcrypt from "bcryptjs";

import { env } from "../config/env.js";
import { EmailService } from "../notifications/email.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type {
  ForgotPasswordInput,
  LoginInput,
  RefreshInput,
  RegisterInput,
  ResetPasswordInput,
} from "./dto/auth.schemas.js";
import { AuthTokenService } from "./auth-token.service.js";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  async register(body: RegisterInput) {
    const email = body.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      throw new HttpException(
        "An account with this email already exists.",
        HttpStatus.CONFLICT,
      );
    }

    const passwordHash = await argon2.hash(body.password);
    const customerReference = await this.createCustomerReference();
    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          customerReference,
          firstName: body.firstName,
          surname: body.surname,
          email,
          address: body.homeAddress,
          mobileNumber: body.mobileNumber,
          passwordHash,
        },
        select: {
          id: true,
          customerReference: true,
          firstName: true,
          surname: true,
          email: true,
          address: true,
          mobileNumber: true,
          role: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new HttpException(
          "An account with this email already exists.",
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }

    const token = this.authTokenService.signAccessToken(user);
    const refreshToken = this.authTokenService.signRefreshToken(user);
    await this.persistRefreshToken(user.id, refreshToken);

    return {
      user,
      token,
      accessToken: token,
      refreshToken,
    };
  }

  async login(body: LoginInput) {
    const user = await this.prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });

    if (!user || !(await this.verifyPassword(body.password, user.passwordHash))) {
      throw new HttpException(
        "Invalid email or password.",
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!user.isActive) {
      throw new HttpException(
        "Account is deactivated.",
        HttpStatus.UNAUTHORIZED,
      );
    }

    const token = this.authTokenService.signAccessToken(user);
    const refreshToken = this.authTokenService.signRefreshToken(user);
    await this.persistRefreshToken(user.id, refreshToken);

    return {
      user: {
        id: user.id,
        customerReference: user.customerReference,
        firstName: user.firstName,
        surname: user.surname,
        email: user.email,
        address: user.address,
        mobileNumber: user.mobileNumber,
        role: user.role,
        isActive: user.isActive,
      },
      token,
      accessToken: token,
      refreshToken,
    };
  }

  async refresh(body: RefreshInput) {
    const tokenHash = this.authTokenService.hashRefreshToken(body.refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        revokedAt: true,
      },
    });

    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt < new Date()
    ) {
      throw new HttpException(
        "Invalid refresh token.",
        HttpStatus.UNAUTHORIZED,
      );
    }

    let payload;
    try {
      payload = this.authTokenService.verifyRefreshToken(body.refreshToken);
    } catch {
      throw new HttpException(
        "Invalid refresh token.",
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (payload.userId !== storedToken.userId) {
      throw new HttpException(
        "Invalid refresh token.",
        HttpStatus.UNAUTHORIZED,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      throw new HttpException(
        "Invalid refresh token.",
        HttpStatus.UNAUTHORIZED,
      );
    }

    const accessToken = this.authTokenService.signAccessToken(user);
    const refreshToken = this.authTokenService.signRefreshToken(user);

    await this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.refreshToken.updateMany({
        where: {
          id: storedToken.id,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { revokedAt: new Date() },
      });

      if (claimed.count !== 1) {
        throw new HttpException(
          "Invalid refresh token.",
          HttpStatus.UNAUTHORIZED,
        );
      }

      await transaction.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: this.authTokenService.hashRefreshToken(refreshToken),
          expiresAt:
            this.authTokenService.getRefreshTokenExpiry(refreshToken),
        },
      });
    });

    return { accessToken, refreshToken };
  }

  async logout(body: RefreshInput) {
    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash: this.authTokenService.hashRefreshToken(body.refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return {
      success: true,
      message: "Logged out successfully.",
    };
  }

  async forgotPassword(body: ForgotPasswordInput) {
    const user = await this.prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
      select: { id: true, firstName: true, email: true },
    });

    if (user) {
      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = this.hashResetToken(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await this.prisma.$transaction(async (transaction) => {
        await transaction.passwordResetToken.deleteMany({
          where: { userId: user.id },
        });
        await transaction.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt,
          },
        });
      });

      const resetUrl = `${env.FRONTEND_URL.replace(/\/$/, "")}/reset-password?token=${rawToken}`;
      await this.emailService.sendPasswordReset({
        to: user.email,
        firstName: user.firstName,
        resetUrl,
      });
    }

    return {
      success: true,
      message: "If the email exists, a password reset link has been sent.",
    };
  }

  async resetPassword(body: ResetPasswordInput) {
    const tokenHash = this.hashResetToken(body.token);
    const tokenRecord = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (
      !tokenRecord ||
      tokenRecord.usedAt ||
      tokenRecord.expiresAt < new Date()
    ) {
      throw new HttpException(
        "Invalid or expired reset token.",
        HttpStatus.BAD_REQUEST,
      );
    }

    const passwordHash = await argon2.hash(body.password);
    await this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.passwordResetToken.updateMany({
        where: {
          id: tokenRecord.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });

      if (claimed.count !== 1) {
        throw new HttpException(
          "Invalid or expired reset token.",
          HttpStatus.BAD_REQUEST,
        );
      }

      await transaction.user.update({
        where: { id: tokenRecord.userId },
        data: { passwordHash },
      });
      await transaction.refreshToken.updateMany({
        where: { userId: tokenRecord.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await transaction.passwordResetToken.deleteMany({
        where: {
          userId: tokenRecord.userId,
          id: { not: tokenRecord.id },
        },
      });
    });

    return {
      success: true,
      message: "Password reset successful.",
    };
  }

  private async createCustomerReference(): Promise<string> {
    const [sequence] = await this.prisma.$queryRaw<Array<{ value: string }>>`
      SELECT nextval('"User_customerReference_seq"')::text AS value
    `;

    if (!sequence) {
      throw new HttpException(
        "Unable to create a customer reference.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return `CUS-${sequence.value.padStart(6, "0")}`;
  }

  private async persistRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.authTokenService.hashRefreshToken(refreshToken),
        expiresAt: this.authTokenService.getRefreshTokenExpiry(refreshToken),
      },
    });
  }

  private async verifyPassword(
    password: string,
    passwordHash: string,
  ): Promise<boolean> {
    if (
      passwordHash.startsWith("$2a$") ||
      passwordHash.startsWith("$2b$") ||
      passwordHash.startsWith("$2y$")
    ) {
      return bcrypt.compare(password, passwordHash);
    }

    return argon2.verify(passwordHash, password);
  }

  private hashResetToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
