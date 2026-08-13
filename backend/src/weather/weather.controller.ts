import { Controller, Get, Headers, UnauthorizedException } from "@nestjs/common";

import { env } from "../config/env.js";
import { WeatherService } from "./weather.service.js";

@Controller("api/weather")
export class WeatherController {
  constructor(private readonly weather: WeatherService) {}

  @Get()
  current() {
    return this.weather.getCurrentWeather();
  }

  @Get("refresh")
  refresh(@Headers("authorization") authorization?: string) {
    const secret = env.CRON_SECRET.trim();
    if (!secret || authorization !== `Bearer ${secret}`) {
      throw new UnauthorizedException("Invalid weather refresh credentials.");
    }
    return this.weather.refreshNow();
  }
}
