/**
 * @fileoverview Order Repository Interface
 * @description Repository contract for Order aggregate persistence
 */

import { Order } from '../entities/order.entity';
import { UniqueEntityID } from '../common/unique-entity-id';
import { OrderStatus } from '../value-objects';

/**
 * Filter options for order queries
 */
export interface OrderFilters {
  customerId?: string;
  status?: string;
  fromDate?: Date;
  toDate?: Date;
  minAmount?: number;
  maxAmount?: number;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Order Repository Interface
 * 
 * Defines the contract for Order persistence operations.
 * Following the Repository pattern from DDD, this interface
 * belongs to the domain layer while implementations belong
 * to the infrastructure layer.
 */
export interface IOrderRepository {
  /**
   * Finds an order by its ID
   * @param id - The order's unique identifier
   * @returns The order if found, null otherwise
   */
  findById(id: UniqueEntityID): Promise<Order | null>;

  /**
   * Finds an order by ID with all items loaded
   * @param id - The order's unique identifier
   * @returns The order with items if found, null otherwise
   */
  findByIdWithItems(id: UniqueEntityID): Promise<Order | null>;

  /**
   * Finds all orders for a customer
   * @param customerId - The customer's unique identifier
   * @returns Array of orders for the customer
   */
  findByCustomerId(customerId: UniqueEntityID): Promise<Order[]>;

  /**
   * Finds orders by status
   * @param status - The order status to filter by
   * @returns Array of orders with the specified status
   */
  findByStatus(status: OrderStatus): Promise<Order[]>;

  /**
   * Finds orders with pagination and filtering
   * @param options - Pagination and filter options
   * @returns Paginated result of orders
   */
  findPaginated(
    options: PaginationOptions,
    filters?: OrderFilters
  ): Promise<PaginatedResult<Order>>;

  /**
   * Finds recent orders
   * @param limit - Maximum number of orders to return
   * @returns Array of recent orders
   */
  findRecent(limit: number): Promise<Order[]>;

  /**
   * Saves an order (creates or updates)
   * @param order - The order to save
   */
  save(order: Order): Promise<void>;

  /**
   * Saves an order within a transaction
   * @param order - The order to save
   * @param transaction - The transaction context
   */
  saveInTransaction(order: Order, transaction: unknown): Promise<void>;

  /**
   * Deletes an order
   * @param id - The order's unique identifier
   */
  delete(id: UniqueEntityID): Promise<void>;

  /**
   * Checks if an order exists
   * @param id - The order's unique identifier
   * @returns true if the order exists
   */
  exists(id: UniqueEntityID): Promise<boolean>;

  /**
   * Counts orders matching filters
   * @param filters - Filter options
   * @returns Count of matching orders
   */
  count(filters?: OrderFilters): Promise<number>;

  /**
   * Gets order statistics for a customer
   * @param customerId - The customer's unique identifier
   * @returns Statistics object
   */
  getCustomerStats(customerId: UniqueEntityID): Promise<{
    totalOrders: number;
    totalSpent: number;
    lastOrderDate: Date | null;
  }>;
}
