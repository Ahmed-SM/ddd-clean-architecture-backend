/**
 * @fileoverview Cache Service Port
 * @description Interface for caching operations
 */

import { Result } from '../../shared';

/**
 * Cache options
 */
export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: string;
}

/**
 * Cache Service Port
 * 
 * Interface for caching operations.
 * Implementations will use Redis, Memcached, etc.
 */
export interface ICacheService {
  /**
   * Gets a value from cache
   * @param key - The cache key
   * @returns The cached value or null
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Sets a value in cache
   * @param key - The cache key
   * @param value - The value to cache
   * @param options - Cache options
   */
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;

  /**
   * Deletes a value from cache
   * @param key - The cache key
   */
  delete(key: string): Promise<void>;

  /**
   * Deletes all keys matching a pattern
   * @param pattern - The key pattern
   */
  deletePattern(pattern: string): Promise<void>;

  /**
   * Checks if a key exists
   * @param key - The cache key
   */
  exists(key: string): Promise<boolean>;

  /**
   * Increments a counter
   * @param key - The cache key
   * @param increment - Amount to increment
   */
  increment(key: string, increment?: number): Promise<number>;

  /**
   * Sets expiration on a key
   * @param key - The cache key
   * @param ttl - Time to live in seconds
   */
  expire(key: string, ttl: number): Promise<void>;

  /**
   * Gets or sets a value (lazy loading pattern)
   * @param key - The cache key
   * @param factory - Function to create value if not cached
   * @param options - Cache options
   */
  getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T>;

  /**
   * Invalidates cache for a specific entity
   * @param entityName - The entity name
   * @param id - The entity ID
   */
  invalidateEntity(entityName: string, id: string): Promise<void>;

  /**
   * Invalidates all cache entries for a tag
   * @param tag - The cache tag
   */
  invalidateTag(tag: string): Promise<void>;

  /**
   * Flushes all cache entries
   */
  flushAll(): Promise<void>;

  /**
   * Gets cache statistics
   */
  getStats(): Promise<{
    keys: number;
    hits: number;
    misses: number;
    memoryUsage?: number;
  }>;
}
