import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';
import { loginSchema } from '../auth/dto/auth.schemas.js';

@Controller('admin')
export class AdminAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: unknown) {
    const loginData = loginSchema.parse(body);
    const result = await this.authService.login(loginData);
    
    if (result.user.role !== 'ADMIN' && result.user.role !== 'STAFF') {
      throw new HttpException('Access denied: Admin or Staff role required', HttpStatus.FORBIDDEN);
    }
    
    return result;
  }
}
