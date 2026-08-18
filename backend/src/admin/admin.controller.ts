import { Controller, Get, UseGuards, Post, Param } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('customers')
  @Roles('ADMIN', 'STAFF')
  async getCustomers() {
    return this.adminService.getCustomers();
  }

  @Get('bookings')
  @Roles('ADMIN', 'STAFF')
  async getBookings() {
    return this.adminService.getBookings();
  }

  @Post('requests/:id/approve')
  @Roles('ADMIN', 'STAFF')
  async approveRequest(@Param('id') id: string) {
    return this.adminService.approveRequest(id);
  }
}
