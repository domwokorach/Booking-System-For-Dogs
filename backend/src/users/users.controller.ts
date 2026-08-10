import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";

import type { AuthUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import {
  accountDeletionTokenSchema,
  changePasswordSchema,
  deleteAccountSchema,
  updateProfileSchema,
} from "./dto/users.schemas.js";
import { UsersService } from "./users.service.js";

@Controller("api/users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post("delete-account/confirm")
  @HttpCode(HttpStatus.OK)
  confirmAccountDeletion(@Body() body: unknown) {
    return this.usersService.confirmAccountDeletion(
      accountDeletionTokenSchema.parse(body),
    );
  }

  @Post("delete-account/cancel")
  @HttpCode(HttpStatus.OK)
  cancelAccountDeletion(@Body() body: unknown) {
    return this.usersService.cancelAccountDeletion(
      accountDeletionTokenSchema.parse(body),
    );
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  getCurrentUser(@CurrentUser() currentUser: AuthUser) {
    return this.usersService.getCurrentUser(currentUser);
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard)
  updateCurrentUser(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: unknown,
  ) {
    return this.usersService.updateCurrentUser(
      currentUser,
      updateProfileSchema.parse(body),
    );
  }

  @Patch("me/password")
  @UseGuards(JwtAuthGuard)
  changePassword(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: unknown,
  ) {
    return this.usersService.changePassword(
      currentUser,
      changePasswordSchema.parse(body),
    );
  }

  @Post("me/delete-request")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  requestAccountDeletion(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: unknown,
  ) {
    return this.usersService.requestAccountDeletion(
      currentUser,
      deleteAccountSchema.parse(body),
    );
  }
}
