import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateReviewDto } from './dto/create-review.dto';
import { Review } from '@prisma/client';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  /**
   * Creates a new review and broadcasts an update to all clients.
   * @param createReviewDto - The review data from the client.
   * @param userId - The ID of the user submitting the review.
   * @returns The newly created review.
   */
  async create(
    createReviewDto: CreateReviewDto,
    userId: string,
  ): Promise<Review> {
    // In a real implementation, you would have authorization logic here
    // to ensure the user can review this appointment.

    const newReview = await this.prisma.review.create({
      data: {
        ...createReviewDto,
        customerId: userId,
      },
    });

    // After saving, calculate the new average and broadcast the update.
    await this.broadcastReviewUpdate();

    return newReview;
  }

  /**
   * Calculates the new average rating and broadcasts an update
   * containing all reviews and the new average.
   */
  private async broadcastReviewUpdate(): Promise<void> {
    const reviews = await this.prisma.review.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;

    this.realtimeGateway.server.emit('reviews_updated', {
      reviews,
      averageRating,
    });
  }
}