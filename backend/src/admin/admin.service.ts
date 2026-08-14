import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getCustomers() {
    // Implement fetching customers
    return this.prisma.user.findMany({
      where: { role: 'CUSTOMER' },
    });
  }

  async approveRequest(requestId: string) {
    // Implement approving request
    return this.prisma.customerRequest.update({
      where: { id: requestId },
      data: { status: 'APPROVED', processedAt: new Date() },
    });
  }
}
