import { Controller, Get, Query } from "@nestjs/common";

import { SlotsService } from "./slots.service.js";

@Controller("api/slots")
export class SlotsController {
  constructor(private readonly slotsService: SlotsService) {}

  @Get()
  list(@Query() query: Record<string, unknown>) {
    return this.slotsService.list(query);
  }
}
