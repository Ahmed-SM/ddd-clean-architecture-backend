/**
 * @fileoverview Prisma Database Client
 * @description Singleton Prisma client for database operations
 */

import { PrismaClient } from '@prisma/client';

// Global type for Prisma client singleton
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Prisma client singleton
 * In development, this prevents creating multiple instances due to hot reloading
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Database configuration
 */
export const dbConfig = {
  /**
   * Gracefully disconnect from the database
   */
  async disconnect(): Promise<void> {
    await prisma.$disconnect();
  },

  /**
   * Check database connection
   */
  async isConnected(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Execute a transaction
   */
  async transaction<T>(
    fn: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>
  ): Promise<T> {
    return prisma.$transaction(fn);
  },
};

export default prisma;
