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
import { Controller, Get, Headers, UnauthorizedException } from "@nestjs/common";
import { env } from "../config/env.js";
import { WeatherService } from "./weather.service.js";
let WeatherController = class WeatherController {
    weather;
    constructor(weather) {
        this.weather = weather;
    }
    current() {
        return this.weather.getCurrentWeather();
    }
    refresh(authorization) {
        const secret = env.CRON_SECRET.trim();
        if (!secret || authorization !== `Bearer ${secret}`) {
            throw new UnauthorizedException("Invalid weather refresh credentials.");
        }
        return this.weather.refreshNow();
    }
};
__decorate([
    Get(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], WeatherController.prototype, "current", null);
__decorate([
    Get("refresh"),
    __param(0, Headers("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WeatherController.prototype, "refresh", null);
WeatherController = __decorate([
    Controller("api/weather"),
    __metadata("design:paramtypes", [WeatherService])
], WeatherController);
export { WeatherController };
