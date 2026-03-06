/**
 * @fileoverview Order Repository Implementation
 * @description Prisma-based implementation of IOrderRepository
 */

import { Prisma } from '@prisma/client';
import prisma from '../database/prisma-client';
import { IOrderRepository, PaginationOptions, OrderFilters, PaginatedResult } from '../../domain/repositories';
import { Order, OrderItem } from '../../domain/entities';
import { UniqueEntityID } from '../../domain/common/unique-entity-id';
import { OrderStatus, Money, Address } from '../../domain/value-objects';

/**
 * Order Repository Implementation using Prisma
 */
export class PrismaOrderRepository implements IOrderRepository {
  /**
   * Finds an order by its ID
   */
  async findById(id: UniqueEntityID): Promise<Order | null> {
    const order = await prisma.order.findUnique({
      where: { id: id.value },
    });

    return order ? this.toDomain(order) : null;
  }

  /**
   * Finds an order by ID with all items loaded
   */
  async findByIdWithItems(id: UniqueEntityID): Promise<Order | null> {
    const order = await prisma.order.findUnique({
      where: { id: id.value },
      include: {
        items: true,
      },
    });

    return order ? this.toDomainWithItems(order) : null;
  }

  /**
   * Finds all orders for a customer
   */
  async findByCustomerId(customerId: UniqueEntityID): Promise<Order[]> {
    const orders = await prisma.order.findMany({
      where: { customerId: customerId.value },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map(order => this.toDomainWithItems(order));
  }

  /**
   * Finds orders by status
   */
  async findByStatus(status: OrderStatus): Promise<Order[]> {
    const orders = await prisma.order.findMany({
      where: { status: status.value },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map(order => this.toDomainWithItems(order));
  }

  /**
   * Finds orders with pagination and filtering
   */
  async findPaginated(
    options: PaginationOptions,
    filters?: OrderFilters
  ): Promise<PaginatedResult<Order>> {
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.OrderWhereInput = {};
    if (filters) {
      if (filters.customerId) where.customerId = filters.customerId;
      if (filters.status) where.status = filters.status;
      if (filters.fromDate || filters.toDate) {
        where.createdAt = {};
        if (filters.fromDate) where.createdAt.gte = filters.fromDate;
        if (filters.toDate) where.createdAt.lte = filters.toDate;
      }
      if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
        where.totalAmount = {};
        if (filters.minAmount !== undefined) where.totalAmount.gte = filters.minAmount;
        if (filters.maxAmount !== undefined) where.totalAmount.lte = filters.maxAmount;
      }
    }

    // Get total count
    const total = await prisma.order.count({ where });

    // Get paginated data
    const orders = await prisma.order.findMany({
      where,
      include: { items: true },
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    });

    return {
      data: orders.map(order => this.toDomainWithItems(order)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + limit < total,
    };
  }

  /**
   * Finds recent orders
   */
  async findRecent(limit: number): Promise<Order[]> {
    const orders = await prisma.order.findMany({
      take: limit,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map(order => this.toDomainWithItems(order));
  }

  /**
   * Saves an order (creates or updates)
   */
  async save(order: Order): Promise<void> {
    const primitives = order.toPrimitives();

    await prisma.$transaction(async (tx) => {
      // Upsert order
      await tx.order.upsert({
        where: { id: primitives.id },
        update: {
          customerId: primitives.customerId,
          status: primitives.status,
          totalAmount: primitives.totalAmount,
          currency: primitives.currency,
          notes: primitives.notes,
          shippingStreet: primitives.shippingAddress.street,
          shippingApartment: primitives.shippingAddress.apartment,
          shippingCity: primitives.shippingAddress.city,
          shippingState: primitives.shippingAddress.state,
          shippingZipCode: primitives.shippingAddress.zipCode,
          shippingCountry: primitives.shippingAddress.country,
          shippingInstructions: primitives.shippingAddress.instructions,
          billingStreet: primitives.billingAddress?.street,
          billingApartment: primitives.billingAddress?.apartment,
          billingCity: primitives.billingAddress?.city,
          billingState: primitives.billingAddress?.state,
          billingZipCode: primitives.billingAddress?.zipCode,
          billingCountry: primitives.billingAddress?.country,
          updatedAt: new Date(),
        },
        create: {
          id: primitives.id,
          customerId: primitives.customerId,
          status: primitives.status,
          totalAmount: primitives.totalAmount,
          currency: primitives.currency,
          notes: primitives.notes,
          shippingStreet: primitives.shippingAddress.street,
          shippingApartment: primitives.shippingAddress.apartment,
          shippingCity: primitives.shippingAddress.city,
          shippingState: primitives.shippingAddress.state,
          shippingZipCode: primitives.shippingAddress.zipCode,
          shippingCountry: primitives.shippingAddress.country,
          shippingInstructions: primitives.shippingAddress.instructions,
          billingStreet: primitives.billingAddress?.street,
          billingApartment: primitives.billingAddress?.apartment,
          billingCity: primitives.billingAddress?.city,
          billingState: primitives.billingAddress?.state,
          billingZipCode: primitives.billingAddress?.zipCode,
          billingCountry: primitives.billingAddress?.country,
        },
      });

      // Delete existing items
      await tx.orderItem.deleteMany({
        where: { orderId: primitives.id },
      });

      // Create new items
      for (const item of primitives.items) {
        await tx.orderItem.create({
          data: {
            id: item.id,
            orderId: primitives.id,
            productId: item.productId,
            productName: item.productName,
            productSku: item.productSku,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            discount: item.discount,
            currency: item.currency,
          },
        });
      }
    });
  }

  /**
   * Saves an order within a transaction
   */
  async saveInTransaction(order: Order, transaction: unknown): Promise<void> {
    const tx = transaction as Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
    const primitives = order.toPrimitives();

    await tx.order.upsert({
      where: { id: primitives.id },
      update: {
        status: primitives.status,
        totalAmount: primitives.totalAmount,
        notes: primitives.notes,
        updatedAt: new Date(),
      },
      create: {
        id: primitives.id,
        customerId: primitives.customerId,
        status: primitives.status,
        totalAmount: primitives.totalAmount,
        currency: primitives.currency,
        notes: primitives.notes,
        shippingStreet: primitives.shippingAddress.street,
        shippingCity: primitives.shippingAddress.city,
        shippingState: primitives.shippingAddress.state,
        shippingZipCode: primitives.shippingAddress.zipCode,
        shippingCountry: primitives.shippingAddress.country,
      },
    });
  }

  /**
   * Deletes an order
   */
  async delete(id: UniqueEntityID): Promise<void> {
    await prisma.order.delete({
      where: { id: id.value },
    });
  }

  /**
   * Checks if an order exists
   */
  async exists(id: UniqueEntityID): Promise<boolean> {
    const count = await prisma.order.count({
      where: { id: id.value },
    });
    return count > 0;
  }

  /**
   * Counts orders matching filters
   */
  async count(filters?: OrderFilters): Promise<number> {
    const where: Prisma.OrderWhereInput = {};
    if (filters) {
      if (filters.customerId) where.customerId = filters.customerId;
      if (filters.status) where.status = filters.status;
    }
    return prisma.order.count({ where });
  }

  /**
   * Gets order statistics for a customer
   */
  async getCustomerStats(customerId: UniqueEntityID): Promise<{
    totalOrders: number;
    totalSpent: number;
    lastOrderDate: Date | null;
  }> {
    const stats = await prisma.order.aggregate({
      where: { customerId: customerId.value },
      _count: { id: true },
      _sum: { totalAmount: true },
      _max: { createdAt: true },
    });

    return {
      totalOrders: stats._count.id,
      totalSpent: stats._sum.totalAmount ?? 0,
      lastOrderDate: stats._max.createdAt,
    };
  }

  /**
   * Maps Prisma model to domain entity (without items)
   */
  private toDomain(data: {
    id: string;
    customerId: string;
    status: string;
    totalAmount: number;
    currency: string;
    shippingStreet: string;
    shippingApartment: string | null;
    shippingCity: string;
    shippingState: string;
    shippingZipCode: string;
    shippingCountry: string;
    shippingInstructions: string | null;
    billingStreet: string | null;
    billingApartment: string | null;
    billingCity: string | null;
    billingState: string | null;
    billingZipCode: string | null;
    billingCountry: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Order {
    const shippingAddress = Address.create({
      street: data.shippingStreet,
      apartment: data.shippingApartment ?? undefined,
      city: data.shippingCity,
      state: data.shippingState,
      zipCode: data.shippingZipCode,
      country: data.shippingCountry,
      instructions: data.shippingInstructions ?? undefined,
    });

    const billingAddress = data.billingStreet
      ? Address.create({
          street: data.billingStreet,
          apartment: data.billingApartment ?? undefined,
          city: data.billingCity!,
          state: data.billingState!,
          zipCode: data.billingZipCode!,
          country: data.billingCountry!,
        })
      : null;

    return Order.fromPersistence({
      id: data.id,
      customerId: data.customerId,
      items: [], // Items loaded separately
      status: data.status,
      totalAmount: data.totalAmount,
      currency: data.currency,
      shippingAddress,
      billingAddress,
      notes: data.notes ?? '',
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  /**
   * Maps Prisma model to domain entity with items
   */
  private toDomainWithItems(data: {
    id: string;
    customerId: string;
    status: string;
    totalAmount: number;
    currency: string;
    shippingStreet: string;
    shippingApartment: string | null;
    shippingCity: string;
    shippingState: string;
    shippingZipCode: string;
    shippingCountry: string;
    shippingInstructions: string | null;
    billingStreet: string | null;
    billingApartment: string | null;
    billingCity: string | null;
    billingState: string | null;
    billingZipCode: string | null;
    billingCountry: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    items: Array<{
      id: string;
      productId: string;
      productName: string;
      productSku: string;
      unitPrice: number;
      quantity: number;
      discount: number;
      currency: string;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }): Order {
    const shippingAddress = Address.create({
      street: data.shippingStreet,
      apartment: data.shippingApartment ?? undefined,
      city: data.shippingCity,
      state: data.shippingState,
      zipCode: data.shippingZipCode,
      country: data.shippingCountry,
      instructions: data.shippingInstructions ?? undefined,
    });

    const billingAddress = data.billingStreet
      ? Address.create({
          street: data.billingStreet,
          apartment: data.billingApartment ?? undefined,
          city: data.billingCity!,
          state: data.billingState!,
          zipCode: data.billingZipCode!,
          country: data.billingCountry!,
        })
      : null;

    const items = data.items.map(item =>
      OrderItem.fromPersistence({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        unitPrice: item.unitPrice,
        currency: item.currency,
        quantity: item.quantity,
        discount: item.discount,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })
    );

    return Order.fromPersistence({
      id: data.id,
      customerId: data.customerId,
      items,
      status: data.status,
      totalAmount: data.totalAmount,
      currency: data.currency,
      shippingAddress,
      billingAddress,
      notes: data.notes ?? '',
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}
