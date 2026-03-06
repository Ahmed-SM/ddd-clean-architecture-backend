/**
 * @fileoverview In-Memory Event Bus Implementation
 * @description Simple in-memory implementation of IEventBus for development
 */

import { DomainEvent } from '../../domain/events';
import { IEventBus, EventHandler } from '../../application/ports';

/**
 * In-Memory Event Bus
 * 
 * Simple event bus that handles events synchronously in memory.
 * Suitable for development and testing. For production, use
 * Redis Pub/Sub, RabbitMQ, or similar message broker.
 */
export class InMemoryEventBus implements IEventBus {
  private handlers: Map<string, EventHandler[]> = new Map();

  /**
   * Publishes a single domain event
   */
  async publish<T extends DomainEvent>(event: T): Promise<void> {
    const handlers = this.handlers.get(event.eventType) ?? [];
    await Promise.all(handlers.map(handler => handler(event)));
  }

  /**
   * Publishes multiple domain events
   */
  async publishAll(events: DomainEvent[]): Promise<void> {
    await Promise.all(events.map(event => this.publish(event)));
  }

  /**
   * Subscribes to events of a specific type
   */
  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>
  ): void {
    const existingHandlers = this.handlers.get(eventType) ?? [];
    this.handlers.set(eventType, [...existingHandlers, handler as EventHandler]);
  }

  /**
   * Unsubscribes from events
   */
  unsubscribe<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>
  ): void {
    const handlers = this.handlers.get(eventType) ?? [];
    const index = handlers.indexOf(handler as EventHandler);
    if (index !== -1) {
      handlers.splice(index, 1);
      this.handlers.set(eventType, handlers);
    }
  }

  /**
   * Gets all registered handlers for an event type
   */
  getHandlers(eventType: string): EventHandler[] {
    return this.handlers.get(eventType) ?? [];
  }

  /**
   * Clears all handlers (useful for testing)
   */
  clear(): void {
    this.handlers.clear();
  }
}
