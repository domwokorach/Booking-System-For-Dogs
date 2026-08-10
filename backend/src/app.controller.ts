import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get()
  root() {
    return {
      ok: true,
      message: "Pawside booking API is running.",
      architecture: "NestJS controllers and services with Prisma and PostgreSQL",
      endpoints: {
        health: "/health",
        auth: "/api/auth",
        appointments: "/api/appointments",
        bookings: "/api/bookings",
        services: "/api/services",
        slots: "/api/slots",
        users: "/api/users",
        files: "/api/files",
      },
    };
  }

  @Get("health")
  health() {
    return { ok: true };
  }
}
