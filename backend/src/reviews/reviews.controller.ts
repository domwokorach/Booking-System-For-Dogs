import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";

import type { AuthUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { createReviewSchema } from "./dto/reviews.schemas.js";
import { ReviewsService } from "./reviews.service.js";

@Controller("api/reviews")
export class PublicReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list() {
    return this.reviews.listPublic();
  }
}

@Controller("api/reviews")
@UseGuards(JwtAuthGuard)
export class CustomerReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post()
  create(@CurrentUser() customer: AuthUser, @Body() body: unknown) {
    return this.reviews.create(customer, createReviewSchema.parse(body));
  }
}
