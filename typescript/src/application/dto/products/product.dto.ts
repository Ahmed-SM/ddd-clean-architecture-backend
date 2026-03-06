/**
 * @fileoverview Product DTOs
 * @description Data Transfer Objects for Product operations
 */

import { z } from 'zod';

/**
 * Product Image DTO
 */
export interface ProductImageDTO {
  id: string;
  url: string;
  alt: string;
  isPrimary: boolean;
}

/**
 * Create Product DTO schema
 */
export const CreateProductDTOSchema = z.object({
  sku: z.string().regex(/^[A-Z]{2,4}-[A-Z]{2,6}-\d{3,6}$/, 'Invalid SKU format'),
  name: z.string().min(1, 'Name is required').max(200, 'Name too long'),
  description: z.string().max(2000).optional(),
  price: z.number().positive('Price must be positive'),
  currency: z.string().length(3, 'Currency must be 3 characters').default('USD'),
  stock: z.number().int().min(0).default(0),
  categoryId: z.string().optional(),
  isActive: z.boolean().default(true),
  images: z.array(z.object({
    url: z.string().url(),
    alt: z.string().optional(),
    isPrimary: z.boolean().optional(),
  })).optional(),
  attributes: z.record(z.string()).optional(),
});

export type CreateProductDTO = z.infer<typeof CreateProductDTOSchema>;

/**
 * Update Product DTO schema
 */
export const UpdateProductDTOSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  price: z.number().positive().optional(),
  stock: z.number().int().min(0).optional(),
  categoryId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  attributes: z.record(z.string()).optional(),
});

export type UpdateProductDTO = z.infer<typeof UpdateProductDTOSchema>;

/**
 * Product Response DTO
 */
export interface ProductResponseDTO {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  formattedPrice: string;
  stock: number;
  isAvailable: boolean;
  categoryId: string | null;
  isActive: boolean;
  images: ProductImageDTO[];
  primaryImage: ProductImageDTO | null;
  attributes: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Product List Query DTO
 */
export const ProductListQueryDTOSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['name', 'price', 'createdAt', 'stock']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  categoryId: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  inStock: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

export type ProductListQueryDTO = z.infer<typeof ProductListQueryDTOSchema>;

/**
 * Paginated Products Response DTO
 */
export interface PaginatedProductsResponseDTO {
  data: ProductResponseDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}
