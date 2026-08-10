import { Controller, Get } from "@nestjs/common";

import { ServicesService } from "./services.service.js";

@Controller("api/services")
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  listActive() {
    return this.servicesService.listActive();
  }
}
