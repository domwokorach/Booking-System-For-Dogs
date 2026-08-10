import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from "@nestjs/common";

import {
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
} from "./dto/auth.schemas.js";
import { AuthService } from "./auth.service.js";

@Controller("api/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  register(@Body() body: unknown) {
    return this.authService.register(registerSchema.parse(body));
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body() body: unknown) {
    return this.authService.login(loginSchema.parse(body));
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: unknown) {
    return this.authService.refresh(refreshSchema.parse(body));
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  logout(@Body() body: unknown) {
    return this.authService.logout(refreshSchema.parse(body));
  }

  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() body: unknown) {
    return this.authService.forgotPassword(forgotPasswordSchema.parse(body));
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() body: unknown) {
    return this.authService.resetPassword(resetPasswordSchema.parse(body));
  }
}
