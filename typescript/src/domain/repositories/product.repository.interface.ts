/**
 * @fileoverview Product Repository Interface
 * @description Repository contract for Product aggregate persistence
 */

import { Product } from '../entities/product.entity';
import { UniqueEntityID } from '../common/unique-entity-id';
import { SKU } from '../value-objects';
import { Quantity } from '../value-objects/quantity.value-object';
import { PaginatedResult } from './order.repository.interface';

/**
 * Filter options for product queries
 */
export interface ProductFilters {
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  isActive?: boolean;
  search?: string;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: 'name' | 'price' | 'createdAt' | 'stock';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Product Repository Interface
 * 
 * Defines the contract for Product persistence operations.
 */
export interface IProductRepository {
  /**
   * Finds a product by its ID
   * @param id - The product's unique identifier
   * @returns The product if found, null otherwise
   */
  findById(id: UniqueEntityID): Promise<Product | null>;

  /**
   * Finds a product by its SKU
   * @param sku - The product's SKU
   * @returns The product if found, null otherwise
   */
  findBySKU(sku: SKU): Promise<Product | null>;

  /**
   * Finds multiple products by their IDs
   * @param ids - Array of product IDs
   * @returns Array of found products
   */
  findByIds(ids: UniqueEntityID[]): Promise<Product[]>;

  /**
   * Finds all active products
   * @returns Array of active products
   */
  findAllActive(): Promise<Product[]>;

  /**
   * Finds products by category
   * @param categoryId - The category ID
   * @returns Array of products in the category
   */
  findByCategory(categoryId: UniqueEntityID): Promise<Product[]>;

  /**
   * Finds products with pagination and filtering
   * @param options - Pagination and filter options
   * @param filters - Filter criteria
   * @returns Paginated result of products
   */
  findPaginated(
    options: PaginationOptions,
    filters?: ProductFilters
  ): Promise<PaginatedResult<Product>>;

  /**
   * Searches products by name or description
   * @param query - Search query
   * @param limit - Maximum results to return
   * @returns Array of matching products
   */
  search(query: string, limit?: number): Promise<Product[]>;

  /**
   * Finds products with low stock
   * @param threshold - Stock threshold
   * @returns Array of products with stock below threshold
   */
  findLowStock(threshold: number): Promise<Product[]>;

  /**
   * Saves a product (creates or updates)
   * @param product - The product to save
   */
  save(product: Product): Promise<void>;

  /**
   * Saves multiple products in batch
   * @param products - Products to save
   */
  saveMany(products: Product[]): Promise<void>;

  /**
   * Deletes a product
   * @param id - The product's unique identifier
   */
  delete(id: UniqueEntityID): Promise<void>;

  /**
   * Checks if a product exists
   * @param id - The product's unique identifier
   * @returns true if the product exists
   */
  exists(id: UniqueEntityID): Promise<boolean>;

  /**
   * Checks if a SKU is already taken
   * @param sku - The SKU to check
   * @param excludeId - Optional product ID to exclude from check
   * @returns true if the SKU is taken
   */
  isSKUTaken(sku: SKU, excludeId?: UniqueEntityID): Promise<boolean>;

  /**
   * Updates stock for a product
   * @param id - The product's unique identifier
   * @param quantity - Quantity to add (positive) or subtract (negative)
   */
  updateStock(id: UniqueEntityID, quantity: Quantity): Promise<void>;

  /**
   * Counts products matching filters
   * @param filters - Filter options
   * @returns Count of matching products
   */
  count(filters?: ProductFilters): Promise<number>;
}
