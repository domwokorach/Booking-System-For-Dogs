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

  async getBookings() {
    const appointments = await this.prisma.appointment.findMany({
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            surname: true,
            email: true,
            customerReference: true,
          },
        },
        serviceRef: { select: { id: true, name: true } },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            status: true,
            amountPence: true,
            currency: true,
            paidAt: true,
          },
        },
      },
      orderBy: { dateTime: 'desc' },
    });

    return appointments.map((appointment) => {
      const latestPayment = appointment.payments[0] ?? null;
      return {
        id: appointment.id,
        dateTime: appointment.dateTime,
        bookingStatus: appointment.status,
        customer: {
          id: appointment.user.id,
          name: `${appointment.user.firstName} ${appointment.user.surname}`,
          email: appointment.user.email,
          customerReference: appointment.user.customerReference,
        },
        service: appointment.serviceRef?.name ?? appointment.service ?? null,
        paymentStatus: latestPayment?.status ?? null,
        amountPence: latestPayment?.amountPence ?? null,
        currency: latestPayment?.currency ?? null,
        paidAt: latestPayment?.paidAt ?? null,
      };
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
