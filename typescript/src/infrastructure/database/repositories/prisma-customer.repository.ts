/**
 * @fileoverview Customer Repository Implementation
 * @description Prisma-based implementation of ICustomerRepository
 */

import { Prisma } from '@prisma/client';
import prisma from '../database/prisma-client';
import { ICustomerRepository, PaginationOptions, CustomerFilters, PaginatedResult } from '../../domain/repositories';
import { Customer, CustomerAddress } from '../../domain/entities';
import { UniqueEntityID } from '../../domain/common/unique-entity-id';
import { Email, Address } from '../../domain/value-objects';

/**
 * Customer Repository Implementation using Prisma
 */
export class PrismaCustomerRepository implements ICustomerRepository {
  /**
   * Finds a customer by its ID
   */
  async findById(id: UniqueEntityID): Promise<Customer | null> {
    const customer = await prisma.customer.findUnique({
      where: { id: id.value },
      include: { addresses: true },
    });

    return customer ? this.toDomain(customer) : null;
  }

  /**
   * Finds a customer by user ID
   */
  async findByUserId(userId: UniqueEntityID): Promise<Customer | null> {
    const customer = await prisma.customer.findUnique({
      where: { userId: userId.value },
      include: { addresses: true },
    });

    return customer ? this.toDomain(customer) : null;
  }

  /**
   * Finds a customer by email
   */
  async findByEmail(email: Email): Promise<Customer | null> {
    const customer = await prisma.customer.findUnique({
      where: { email: email.value },
      include: { addresses: true },
    });

    return customer ? this.toDomain(customer) : null;
  }

  /**
   * Finds multiple customers by their IDs
   */
  async findByIds(ids: UniqueEntityID[]): Promise<Customer[]> {
    const customers = await prisma.customer.findMany({
      where: { id: { in: ids.map(id => id.value) } },
      include: { addresses: true },
    });

    return customers.map(customer => this.toDomain(customer));
  }

  /**
   * Finds customers with pagination and filtering
   */
  async findPaginated(
    options: PaginationOptions,
    filters?: CustomerFilters
  ): Promise<PaginatedResult<Customer>> {
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.CustomerWhereInput = {};
    if (filters) {
      if (filters.isActive !== undefined) where.isActive = filters.isActive;
      if (filters.minTotalSpent !== undefined) {
        where.totalSpent = { gte: filters.minTotalSpent };
      }
      if (filters.search) {
        where.OR = [
          { firstName: { contains: filters.search, mode: 'insensitive' } },
          { lastName: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
        ];
      }
    }

    // Get total count
    const total = await prisma.customer.count({ where });

    // Get paginated data
    const customers = await prisma.customer.findMany({
      where,
      include: { addresses: true },
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    });

    return {
      data: customers.map(customer => this.toDomain(customer)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + limit < total,
    };
  }

  /**
   * Searches customers by name or email
   */
  async search(query: string, limit: number = 20): Promise<Customer[]> {
    const customers = await prisma.customer.findMany({
      where: {
        isActive: true,
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: { addresses: true },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return customers.map(customer => this.toDomain(customer));
  }

  /**
   * Finds top customers by total spent
   */
  async findTopCustomers(limit: number): Promise<Customer[]> {
    const customers = await prisma.customer.findMany({
      where: { isActive: true, totalSpent: { gt: 0 } },
      include: { addresses: true },
      take: limit,
      orderBy: { totalSpent: 'desc' },
    });

    return customers.map(customer => this.toDomain(customer));
  }

  /**
   * Finds customers who haven't ordered recently
   */
  async findInactive(days: number): Promise<Customer[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const customers = await prisma.customer.findMany({
      where: {
        isActive: true,
        orders: {
          none: {
            createdAt: { gte: cutoffDate },
          },
        },
      },
      include: { addresses: true },
    });

    return customers.map(customer => this.toDomain(customer));
  }

  /**
   * Saves a customer (creates or updates)
   */
  async save(customer: Customer): Promise<void> {
    const primitives = customer.toPrimitives();

    await prisma.$transaction(async (tx) => {
      // Upsert customer
      await tx.customer.upsert({
        where: { id: primitives.id },
        update: {
          email: primitives.email,
          firstName: primitives.firstName,
          lastName: primitives.lastName,
          phone: primitives.phone,
          isActive: primitives.isActive,
          totalOrders: primitives.totalOrders,
          totalSpent: primitives.totalSpent,
          updatedAt: new Date(),
        },
        create: {
          id: primitives.id,
          userId: primitives.userId,
          email: primitives.email,
          firstName: primitives.firstName,
          lastName: primitives.lastName,
          phone: primitives.phone,
          isActive: primitives.isActive,
          totalOrders: primitives.totalOrders,
          totalSpent: primitives.totalSpent,
        },
      });

      // Update addresses
      await tx.address.deleteMany({
        where: { customerId: primitives.id },
      });

      for (const addr of primitives.addresses) {
        await tx.address.create({
          data: {
            id: addr.id,
            customerId: primitives.id,
            label: addr.label,
            street: addr.address.street,
            apartment: addr.address.apartment,
            city: addr.address.city,
            state: addr.address.state,
            zipCode: addr.address.zipCode,
            country: addr.address.country,
            isDefault: addr.isDefault,
            type: addr.type,
          },
        });
      }
    });
  }

  /**
   * Deletes a customer
   */
  async delete(id: UniqueEntityID): Promise<void> {
    await prisma.customer.delete({
      where: { id: id.value },
    });
  }

  /**
   * Checks if a customer exists
   */
  async exists(id: UniqueEntityID): Promise<boolean> {
    const count = await prisma.customer.count({
      where: { id: id.value },
    });
    return count > 0;
  }

  /**
   * Checks if an email is already taken
   */
  async isEmailTaken(email: Email, excludeId?: UniqueEntityID): Promise<boolean> {
    const where: Prisma.CustomerWhereInput = {
      email: email.value,
    };
    if (excludeId) {
      where.NOT = { id: excludeId.value };
    }
    const count = await prisma.customer.count({ where });
    return count > 0;
  }

  /**
   * Counts customers matching filters
   */
  async count(filters?: CustomerFilters): Promise<number> {
    const where: Prisma.CustomerWhereInput = {};
    if (filters) {
      if (filters.isActive !== undefined) where.isActive = filters.isActive;
    }
    return prisma.customer.count({ where });
  }

  /**
   * Maps Prisma model to domain entity
   */
  private toDomain(data: {
    id: string;
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    isActive: boolean;
    totalOrders: number;
    totalSpent: number;
    addresses: Array<{
      id: string;
      label: string;
      street: string;
      apartment: string | null;
      city: string;
      state: string;
      zipCode: string;
      country: string;
      isDefault: boolean;
      type: string;
    }>;
    createdAt: Date;
    updatedAt: Date;
  }): Customer {
    const addresses: CustomerAddress[] = data.addresses.map(addr => ({
      id: addr.id,
      label: addr.label,
      address: Address.create({
        street: addr.street,
        apartment: addr.apartment ?? undefined,
        city: addr.city,
        state: addr.state,
        zipCode: addr.zipCode,
        country: addr.country,
      }),
      isDefault: addr.isDefault,
      type: addr.type as 'shipping' | 'billing' | 'both',
    }));

    return Customer.fromPersistence({
      id: data.id,
      userId: data.userId,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      addresses,
      isActive: data.isActive,
      totalOrders: data.totalOrders,
      totalSpent: data.totalSpent,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}
