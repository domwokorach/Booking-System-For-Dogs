import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async listActive() {
    const services = await this.prisma.service.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        pricePence: true,
        active: true,
      },
    });

    return { services };
  }
}
