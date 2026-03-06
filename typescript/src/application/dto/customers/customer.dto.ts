/**
 * @fileoverview Customer DTOs
 * @description Data Transfer Objects for Customer operations
 */

import { z } from 'zod';

/**
 * Address DTO for Customer
 */
export const CustomerAddressDTOSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  street: z.string().min(1, 'Street is required'),
  apartment: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zipCode: z.string().min(1, 'ZIP code is required'),
  country: z.string().min(2, 'Country is required'),
  isDefault: z.boolean().default(false),
  type: z.enum(['shipping', 'billing', 'both']).default('both'),
});

/**
 * Create/Update Customer DTO schema
 */
export const CustomerDTOSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email format'),
  phone: z.string().optional(),
});

export type CustomerDTO = z.infer<typeof CustomerDTOSchema>;

/**
 * Customer Response DTO
 */
export interface CustomerResponseDTO {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string | null;
  addresses: Array<{
    id: string;
    label: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    isDefault: boolean;
    type: string;
    formatted: string;
  }>;
  isActive: boolean;
  totalOrders: number;
  totalSpent: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Customer List Query DTO
 */
export const CustomerListQueryDTOSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['name', 'createdAt', 'totalSpent', 'totalOrders']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

export type CustomerListQueryDTO = z.infer<typeof CustomerListQueryDTOSchema>;
