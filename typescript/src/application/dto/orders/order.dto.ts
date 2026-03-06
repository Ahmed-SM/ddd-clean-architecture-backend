/**
 * @fileoverview Order DTOs
 * @description Data Transfer Objects for Order operations
 */

import { z } from 'zod';

/**
 * Order item DTO schema
 */
export const OrderItemDTOSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
  unitPrice: z.number().positive('Unit price must be positive'),
});

/**
 * Address DTO schema
 */
export const AddressDTOSchema = z.object({
  street: z.string().min(1, 'Street is required'),
  apartment: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zipCode: z.string().min(1, 'ZIP code is required'),
  country: z.string().min(2, 'Country code is required'),
  instructions: z.string().optional(),
});

/**
 * Create Order DTO schema
 */
export const CreateOrderDTOSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  items: z.array(OrderItemDTOSchema).min(1, 'At least one item is required'),
  shippingAddress: AddressDTOSchema,
  billingAddress: AddressDTOSchema.optional(),
  notes: z.string().max(500).optional(),
});

/**
 * Create Order DTO type
 */
export type CreateOrderDTO = z.infer<typeof CreateOrderDTOSchema>;

/**
 * Order Item Response DTO
 */
export interface OrderItemResponseDTO {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
}

/**
 * Order Response DTO
 */
export interface OrderResponseDTO {
  id: string;
  customerId: string;
  items: OrderItemResponseDTO[];
  status: string;
  statusLabel: string;
  totalAmount: number;
  currency: string;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    formatted: string;
  };
  billingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    formatted: string;
  } | null;
  notes: string;
  itemCount: number;
  totalQuantity: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Update Order Status DTO
 */
export const UpdateOrderStatusDTOSchema = z.object({
  status: z.enum(['confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']),
  reason: z.string().optional(),
});

export type UpdateOrderStatusDTO = z.infer<typeof UpdateOrderStatusDTOSchema>;

/**
 * Order List Query DTO
 */
export const OrderListQueryDTOSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'totalAmount', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  customerId: z.string().optional(),
  status: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  minAmount: z.coerce.number().min(0).optional(),
  maxAmount: z.coerce.number().min(0).optional(),
});

export type OrderListQueryDTO = z.infer<typeof OrderListQueryDTOSchema>;

/**
 * Paginated Orders Response DTO
 */
export interface PaginatedOrdersResponseDTO {
  data: OrderResponseDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}
