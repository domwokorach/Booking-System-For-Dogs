import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: ('CUSTOMER' | 'STAFF' | 'ADMIN')[]) => SetMetadata(ROLES_KEY, roles);
