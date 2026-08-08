type PrismaLike = {
  $connect: () => Promise<void>;
  $disconnect: () => Promise<void>;
  [key: string]: unknown;
};

const globalForPrisma = globalThis as unknown as { prisma?: PrismaLike };

function createPrismaClient(): PrismaLike {
  return {
    async $connect() {},
    async $disconnect() {},
  } as PrismaLike;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
