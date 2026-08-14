export type AuthUser = {
  id: string;
  userId: string;
  email: string;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
  expiresAt: number;
};
