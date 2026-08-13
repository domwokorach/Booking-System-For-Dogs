import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import type { AuthUser } from "../auth/auth.types.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { CreateReviewInput } from "./dto/reviews.schemas.js";
import { getReviewEligibility } from "./review-eligibility.js";

const publicReviewSelect = {
  id: true,
  customerId: true,
  customerName: true,
  avatarUrl: true,
  rating: true,
  comment: true,
  petName: true,
  petBreed: true,
  createdAt: true,
} as const;

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  listPublic() {
    return this.prisma.review.findMany({
      select: publicReviewSelect,
      orderBy: { createdAt: "desc" },
      take: 12,
    });
  }

  async getPublicStats() {
    const stats = await this.prisma.review.aggregate({
      _count: { _all: true },
      _avg: { rating: true },
    });

    return {
      count: stats._count._all,
      averageRating:
        stats._avg.rating === null
          ? null
          : Math.round(stats._avg.rating * 10) / 10,
    };
  }

  async create(customer: AuthUser, body: CreateReviewInput) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const appointment = await transaction.appointment.findFirst({
          where: {
            id: body.appointmentId,
            userId: customer.id,
          },
          select: {
            id: true,
            dateTime: true,
            durationMinutes: true,
            status: true,
            review: { select: { id: true } },
            user: { select: { firstName: true, surname: true } },
          },
        });

        if (!appointment) {
          throw new NotFoundException(
            "A completed appointment belonging to your account was not found.",
          );
        }

        if (appointment.review) {
          throw new ConflictException("This appointment already has a review.");
        }

        const eligibility = getReviewEligibility({
          status: appointment.status,
          dateTime: appointment.dateTime,
          durationMinutes: appointment.durationMinutes,
          hasReview: Boolean(appointment.review),
        });
        if (eligibility.reason === "CANCELLED") {
          throw new BadRequestException(
            "Cancelled appointments cannot be reviewed.",
          );
        }
        if (!eligibility.canReview) {
          throw new BadRequestException(
            "You can leave a review after the appointment has finished.",
          );
        }

        return transaction.review.create({
          data: {
            customerId: customer.id,
            appointmentId: appointment.id,
            customerName: `${appointment.user.firstName} ${appointment.user.surname}`,
            avatarUrl: body.avatarUrl,
            rating: body.rating,
            comment: body.comment,
            petName: body.petName,
            petBreed: body.petBreed,
          },
          select: publicReviewSelect,
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("This appointment already has a review.");
      }
      throw error;
    }
  }
}
