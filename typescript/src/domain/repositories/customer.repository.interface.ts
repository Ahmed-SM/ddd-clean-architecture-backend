/**
 * @fileoverview Customer Repository Interface
 * @description Repository contract for Customer aggregate persistence
 */

import { Customer } from '../entities/customer.entity';
import { UniqueEntityID } from '../common/unique-entity-id';
import { Email } from '../value-objects';
import { PaginatedResult } from './order.repository.interface';

/**
 * Filter options for customer queries
 */
export interface CustomerFilters {
  isActive?: boolean;
  hasOrders?: boolean;
  minTotalSpent?: number;
  search?: string;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: 'name' | 'createdAt' | 'totalSpent' | 'totalOrders';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Customer Repository Interface
 * 
 * Defines the contract for Customer persistence operations.
 */
export interface ICustomerRepository {
  /**
   * Finds a customer by its ID
   * @param id - The customer's unique identifier
   * @returns The customer if found, null otherwise
   */
  findById(id: UniqueEntityID): Promise<Customer | null>;

  /**
   * Finds a customer by user ID
   * @param userId - The associated user's unique identifier
   * @returns The customer if found, null otherwise
   */
  findByUserId(userId: UniqueEntityID): Promise<Customer | null>;

  /**
   * Finds a customer by email
   * @param email - The customer's email
   * @returns The customer if found, null otherwise
   */
  findByEmail(email: Email): Promise<Customer | null>;

  /**
   * Finds multiple customers by their IDs
   * @param ids - Array of customer IDs
   * @returns Array of found customers
   */
  findByIds(ids: UniqueEntityID[]): Promise<Customer[]>;

  /**
   * Finds customers with pagination and filtering
   * @param options - Pagination options
   * @param filters - Filter criteria
   * @returns Paginated result of customers
   */
  findPaginated(
    options: PaginationOptions,
    filters?: CustomerFilters
  ): Promise<PaginatedResult<Customer>>;

  /**
   * Searches customers by name or email
   * @param query - Search query
   * @param limit - Maximum results to return
   * @returns Array of matching customers
   */
  search(query: string, limit?: number): Promise<Customer[]>;

  /**
   * Finds top customers by total spent
   * @param limit - Maximum results to return
   * @returns Array of top customers
   */
  findTopCustomers(limit: number): Promise<Customer[]>;

  /**
   * Finds customers who haven't ordered recently
   * @param days - Number of days since last order
   * @returns Array of inactive customers
   */
  findInactive(days: number): Promise<Customer[]>;

  /**
   * Saves a customer (creates or updates)
   * @param customer - The customer to save
   */
  save(customer: Customer): Promise<void>;

  /**
   * Deletes a customer
   * @param id - The customer's unique identifier
   */
  delete(id: UniqueEntityID): Promise<void>;

  /**
   * Checks if a customer exists
   * @param id - The customer's unique identifier
   * @returns true if the customer exists
   */
  exists(id: UniqueEntityID): Promise<boolean>;

  /**
   * Checks if an email is already taken
   * @param email - The email to check
   * @param excludeId - Optional customer ID to exclude from check
   * @returns true if the email is taken
   */
  isEmailTaken(email: Email, excludeId?: UniqueEntityID): Promise<boolean>;

  /**
   * Counts customers matching filters
   * @param filters - Filter options
   * @returns Count of matching customers
   */
  count(filters?: CustomerFilters): Promise<number>;
}
