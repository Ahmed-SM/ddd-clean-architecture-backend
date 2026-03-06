/**
 * @fileoverview Dependency Injection Container
 * @description Simple DI container for managing service dependencies
 */

import { PrismaOrderRepository, PrismaProductRepository, PrismaCustomerRepository } from '../database/repositories';
import { InMemoryEventBus } from '../events/in-memory-event-bus';
import { InMemoryCacheService } from '../adapters/cache/in-memory-cache';
import { CreateOrderUseCase, GetOrderUseCase, UpdateOrderStatusUseCase, ListOrdersUseCase } from '../../application/use-cases';

/**
 * DI Container Symbols
 */
export const TYPES = {
  // Repositories
  OrderRepository: Symbol.for('OrderRepository'),
  ProductRepository: Symbol.for('ProductRepository'),
  CustomerRepository: Symbol.for('CustomerRepository'),

  // Services
  EventBus: Symbol.for('EventBus'),
  CacheService: Symbol.for('CacheService'),

  // Use Cases
  CreateOrderUseCase: Symbol.for('CreateOrderUseCase'),
  GetOrderUseCase: Symbol.for('GetOrderUseCase'),
  UpdateOrderStatusUseCase: Symbol.for('UpdateOrderStatusUseCase'),
  ListOrdersUseCase: Symbol.for('ListOrdersUseCase'),
} as const;

/**
 * Container interface
 */
interface Container {
  get<T>(symbol: symbol): T;
}

/**
 * Simple DI Container Implementation
 */
class SimpleContainer implements Container {
  private instances: Map<symbol, unknown> = new Map();

  register<T>(symbol: symbol, instance: T): void {
    this.instances.set(symbol, instance);
  }

  get<T>(symbol: symbol): T {
    const instance = this.instances.get(symbol);
    if (!instance) {
      throw new Error(`No instance registered for symbol: ${symbol.toString()}`);
    }
    return instance as T;
  }
}

/**
 * Creates and configures the DI container
 */
export function createContainer(): Container {
  const container = new SimpleContainer();

  // Register infrastructure services
  const eventBus = new InMemoryEventBus();
  const cacheService = new InMemoryCacheService();

  container.register(TYPES.EventBus, eventBus);
  container.register(TYPES.CacheService, cacheService);

  // Register repositories
  const orderRepository = new PrismaOrderRepository();
  const productRepository = new PrismaProductRepository();
  const customerRepository = new PrismaCustomerRepository();

  container.register(TYPES.OrderRepository, orderRepository);
  container.register(TYPES.ProductRepository, productRepository);
  container.register(TYPES.CustomerRepository, customerRepository);

  // Register use cases
  const createOrderUseCase = new CreateOrderUseCase(
    orderRepository,
    productRepository,
    customerRepository,
    eventBus,
    cacheService
  );

  const getOrderUseCase = new GetOrderUseCase(
    orderRepository,
    cacheService
  );

  const updateOrderStatusUseCase = new UpdateOrderStatusUseCase(
    orderRepository,
    eventBus,
    cacheService
  );

  const listOrdersUseCase = new ListOrdersUseCase(
    orderRepository,
    cacheService
  );

  container.register(TYPES.CreateOrderUseCase, createOrderUseCase);
  container.register(TYPES.GetOrderUseCase, getOrderUseCase);
  container.register(TYPES.UpdateOrderStatusUseCase, updateOrderStatusUseCase);
  container.register(TYPES.ListOrdersUseCase, listOrdersUseCase);

  return container;
}

/**
 * Global container instance
 */
let container: Container | null = null;

/**
 * Gets the global container instance
 */
export function getContainer(): Container {
  if (!container) {
    container = createContainer();
  }
  return container;
}

/**
 * Resets the global container (useful for testing)
 */
export function resetContainer(): void {
  container = null;
}
