/**
 * @fileoverview Product Repository Implementation
 * @description Prisma-based implementation of IProductRepository
 */

import { Prisma } from '@prisma/client';
import prisma from '../database/prisma-client';
import { IProductRepository, PaginationOptions, ProductFilters, PaginatedResult } from '../../domain/repositories';
import { Product, ProductImage } from '../../domain/entities';
import { UniqueEntityID } from '../../domain/common/unique-entity-id';
import { Money, SKU } from '../../domain/value-objects';
import { Quantity } from '../../domain/value-objects/quantity.value-object';

/**
 * Product Repository Implementation using Prisma
 */
export class PrismaProductRepository implements IProductRepository {
  /**
   * Finds a product by its ID
   */
  async findById(id: UniqueEntityID): Promise<Product | null> {
    const product = await prisma.product.findUnique({
      where: { id: id.value },
      include: { images: { orderBy: { order: 'asc' } } },
    });

    return product ? this.toDomain(product) : null;
  }

  /**
   * Finds a product by its SKU
   */
  async findBySKU(sku: SKU): Promise<Product | null> {
    const product = await prisma.product.findUnique({
      where: { sku: sku.value },
      include: { images: { orderBy: { order: 'asc' } } },
    });

    return product ? this.toDomain(product) : null;
  }

  /**
   * Finds multiple products by their IDs
   */
  async findByIds(ids: UniqueEntityID[]): Promise<Product[]> {
    const products = await prisma.product.findMany({
      where: { id: { in: ids.map(id => id.value) } },
      include: { images: { orderBy: { order: 'asc' } } },
    });

    return products.map(product => this.toDomain(product));
  }

  /**
   * Finds all active products
   */
  async findAllActive(): Promise<Product[]> {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: { images: { orderBy: { order: 'asc' } } },
      orderBy: { name: 'asc' },
    });

    return products.map(product => this.toDomain(product));
  }

  /**
   * Finds products by category
   */
  async findByCategory(categoryId: UniqueEntityID): Promise<Product[]> {
    const products = await prisma.product.findMany({
      where: { categoryId: categoryId.value },
      include: { images: { orderBy: { order: 'asc' } } },
      orderBy: { name: 'asc' },
    });

    return products.map(product => this.toDomain(product));
  }

  /**
   * Finds products with pagination and filtering
   */
  async findPaginated(
    options: PaginationOptions,
    filters?: ProductFilters
  ): Promise<PaginatedResult<Product>> {
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.ProductWhereInput = {};
    if (filters) {
      if (filters.categoryId) where.categoryId = filters.categoryId;
      if (filters.isActive !== undefined) where.isActive = filters.isActive;
      if (filters.inStock) where.stock = { gt: 0 };
      if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
        where.price = {};
        if (filters.minPrice !== undefined) where.price.gte = filters.minPrice;
        if (filters.maxPrice !== undefined) where.price.lte = filters.maxPrice;
      }
      if (filters.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ];
      }
    }

    // Get total count
    const total = await prisma.product.count({ where });

    // Get paginated data
    const products = await prisma.product.findMany({
      where,
      include: { images: { orderBy: { order: 'asc' } } },
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    });

    return {
      data: products.map(product => this.toDomain(product)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + limit < total,
    };
  }

  /**
   * Searches products by name or description
   */
  async search(query: string, limit: number = 20): Promise<Product[]> {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { sku: { contains: query.toUpperCase() } },
        ],
      },
      include: { images: { orderBy: { order: 'asc' } } },
      take: limit,
      orderBy: { name: 'asc' },
    });

    return products.map(product => this.toDomain(product));
  }

  /**
   * Finds products with low stock
   */
  async findLowStock(threshold: number): Promise<Product[]> {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        stock: { lte: threshold },
      },
      include: { images: { orderBy: { order: 'asc' } } },
      orderBy: { stock: 'asc' },
    });

    return products.map(product => this.toDomain(product));
  }

  /**
   * Saves a product (creates or updates)
   */
  async save(product: Product): Promise<void> {
    const primitives = product.toPrimitives();

    await prisma.$transaction(async (tx) => {
      // Upsert product
      await tx.product.upsert({
        where: { id: primitives.id },
        update: {
          sku: primitives.sku,
          name: primitives.name,
          description: primitives.description,
          price: primitives.price,
          currency: primitives.currency,
          stock: primitives.stock,
          categoryId: primitives.categoryId,
          isActive: primitives.isActive,
          attributes: primitives.attributes ? JSON.stringify(primitives.attributes) : null,
          updatedAt: new Date(),
        },
        create: {
          id: primitives.id,
          sku: primitives.sku,
          name: primitives.name,
          description: primitives.description,
          price: primitives.price,
          currency: primitives.currency,
          stock: primitives.stock,
          categoryId: primitives.categoryId,
          isActive: primitives.isActive,
          attributes: primitives.attributes ? JSON.stringify(primitives.attributes) : null,
        },
      });

      // Update images
      await tx.productImage.deleteMany({
        where: { productId: primitives.id },
      });

      for (const image of primitives.images) {
        await tx.productImage.create({
          data: {
            id: image.id,
            productId: primitives.id,
            url: image.url,
            alt: image.alt,
            isPrimary: image.isPrimary,
            order: image.order,
          },
        });
      }
    });
  }

  /**
   * Saves multiple products in batch
   */
  async saveMany(products: Product[]): Promise<void> {
    await Promise.all(products.map(product => this.save(product)));
  }

  /**
   * Deletes a product
   */
  async delete(id: UniqueEntityID): Promise<void> {
    await prisma.product.delete({
      where: { id: id.value },
    });
  }

  /**
   * Checks if a product exists
   */
  async exists(id: UniqueEntityID): Promise<boolean> {
    const count = await prisma.product.count({
      where: { id: id.value },
    });
    return count > 0;
  }

  /**
   * Checks if a SKU is already taken
   */
  async isSKUTaken(sku: SKU, excludeId?: UniqueEntityID): Promise<boolean> {
    const where: Prisma.ProductWhereInput = {
      sku: sku.value,
    };
    if (excludeId) {
      where.NOT = { id: excludeId.value };
    }
    const count = await prisma.product.count({ where });
    return count > 0;
  }

  /**
   * Updates stock for a product
   */
  async updateStock(id: UniqueEntityID, quantity: Quantity): Promise<void> {
    await prisma.product.update({
      where: { id: id.value },
      data: {
        stock: { increment: quantity.value },
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Counts products matching filters
   */
  async count(filters?: ProductFilters): Promise<number> {
    const where: Prisma.ProductWhereInput = {};
    if (filters) {
      if (filters.categoryId) where.categoryId = filters.categoryId;
      if (filters.isActive !== undefined) where.isActive = filters.isActive;
    }
    return prisma.product.count({ where });
  }

  /**
   * Maps Prisma model to domain entity
   */
  private toDomain(data: {
    id: string;
    sku: string;
    name: string;
    description: string;
    price: number;
    currency: string;
    stock: number;
    categoryId: string | null;
    isActive: boolean;
    attributes: string | null;
    images: Array<{
      id: string;
      url: string;
      alt: string | null;
      isPrimary: boolean;
      order: number;
    }>;
    createdAt: Date;
    updatedAt: Date;
  }): Product {
    const images: ProductImage[] = data.images.map(img => ({
      id: img.id,
      url: img.url,
      alt: img.alt ?? '',
      isPrimary: img.isPrimary,
      order: img.order,
    }));

    return Product.fromPersistence({
      id: data.id,
      sku: data.sku,
      name: data.name,
      description: data.description,
      price: data.price,
      currency: data.currency,
      stock: data.stock,
      categoryId: data.categoryId,
      isActive: data.isActive,
      images,
      attributes: data.attributes ? JSON.parse(data.attributes) : {},
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}
