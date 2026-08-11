var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BadRequestException, ConflictException, Injectable, NotFoundException, } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
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
};
let ReviewsService = class ReviewsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    listPublic() {
        return this.prisma.review.findMany({
            select: publicReviewSelect,
            orderBy: { createdAt: "desc" },
            take: 12,
        });
    }
    async create(customer, body) {
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
                    throw new NotFoundException("A completed appointment belonging to your account was not found.");
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
                    throw new BadRequestException("Cancelled appointments cannot be reviewed.");
                }
                if (!eligibility.canReview) {
                    throw new BadRequestException("You can leave a review after the appointment has finished.");
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
        }
        catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === "P2002") {
                throw new ConflictException("This appointment already has a review.");
            }
            throw error;
        }
    }
};
ReviewsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService])
], ReviewsService);
export { ReviewsService };
