/**
 * @fileoverview In-Memory Cache Service Implementation
 * @description Simple in-memory cache implementation
 */

import { ICacheService, CacheOptions } from '../../application/ports';

/**
 * Cache entry
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number | null;
}

/**
 * In-Memory Cache Service
 * 
 * Simple cache that stores data in memory.
 * Suitable for development and single-instance deployments.
 */
export class InMemoryCacheService implements ICacheService {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private stats = { hits: 0, misses: 0 };

  /**
   * Gets a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check expiration
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.value;
  }

  /**
   * Sets a value in cache
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl ? options.ttl * 1000 : null;
    const expiresAt = ttl ? Date.now() + ttl : null;

    this.cache.set(key, {
      value,
      expiresAt,
    });
  }

  /**
   * Deletes a value from cache
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  /**
   * Deletes all keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Checks if a key exists
   */
  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check expiration
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Increments a counter
   */
  async increment(key: string, increment: number = 1): Promise<number> {
    const current = (await this.get<number>(key)) ?? 0;
    const newValue = current + increment;
    await this.set(key, newValue);
    return newValue;
  }

  /**
   * Sets expiration on a key
   */
  async expire(key: string, ttl: number): Promise<void> {
    const entry = this.cache.get(key);
    if (entry) {
      entry.expiresAt = Date.now() + ttl * 1000;
    }
  }

  /**
   * Gets or sets a value
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  /**
   * Invalidates cache for a specific entity
   */
  async invalidateEntity(entityName: string, id: string): Promise<void> {
    await this.delete(`${entityName}:${id}`);
  }

  /**
   * Invalidates all cache entries for a tag
   */
  async invalidateTag(tag: string): Promise<void> {
    await this.deletePattern(`*:${tag}:*`);
  }

  /**
   * Flushes all cache entries
   */
  async flushAll(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Gets cache statistics
   */
  async getStats(): Promise<{
    keys: number;
    hits: number;
    misses: number;
    memoryUsage?: number;
  }> {
    return {
      keys: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      memoryUsage: undefined, // Not easily calculable
    };
  }
}
