import { Global, Module } from "@nestjs/common";

import { WeatherController } from "./weather.controller.js";
import { WeatherService } from "./weather.service.js";

@Global()
@Module({
  controllers: [WeatherController],
  providers: [WeatherService],
  exports: [WeatherService],
})
export class WeatherModule {}
