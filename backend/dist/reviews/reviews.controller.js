var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { createReviewSchema } from "./dto/reviews.schemas.js";
import { ReviewsService } from "./reviews.service.js";
let PublicReviewsController = class PublicReviewsController {
    reviews;
    constructor(reviews) {
        this.reviews = reviews;
    }
    list() {
        return this.reviews.listPublic();
    }
    stats() {
        return this.reviews.getPublicStats();
    }
};
__decorate([
    Get(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PublicReviewsController.prototype, "list", null);
__decorate([
    Get("stats"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PublicReviewsController.prototype, "stats", null);
PublicReviewsController = __decorate([
    Controller("api/reviews"),
    __metadata("design:paramtypes", [ReviewsService])
], PublicReviewsController);
export { PublicReviewsController };
let CustomerReviewsController = class CustomerReviewsController {
    reviews;
    constructor(reviews) {
        this.reviews = reviews;
    }
    create(customer, body) {
        return this.reviews.create(customer, createReviewSchema.parse(body));
    }
};
__decorate([
    Post(),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CustomerReviewsController.prototype, "create", null);
CustomerReviewsController = __decorate([
    Controller("api/reviews"),
    UseGuards(JwtAuthGuard),
    __metadata("design:paramtypes", [ReviewsService])
], CustomerReviewsController);
export { CustomerReviewsController };
