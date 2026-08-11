import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import {
  CustomerReviewsController,
  PublicReviewsController,
} from "./reviews.controller.js";
import { ReviewsService } from "./reviews.service.js";

@Module({
  imports: [AuthModule],
  controllers: [PublicReviewsController, CustomerReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
