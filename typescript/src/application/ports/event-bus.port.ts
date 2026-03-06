/**
 * @fileoverview Event Bus Port
 * @description Interface for domain event publishing and handling
 */

import { DomainEvent } from '../../domain/events';

/**
 * Event handler function type
 */
export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => Promise<void>;

/**
 * Subscription options
 */
export interface SubscriptionOptions {
  queueName?: string;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Event Bus Port
 * 
 * Interface for publishing and subscribing to domain events.
 * Enables event-driven architecture within the application.
 */
export interface IEventBus {
  /**
   * Publishes a single domain event
   * @param event - The event to publish
   */
  publish<T extends DomainEvent>(event: T): Promise<void>;

  /**
   * Publishes multiple domain events
   * @param events - The events to publish
   */
  publishAll(events: DomainEvent[]): Promise<void>;

  /**
   * Subscribes to events of a specific type
   * @param eventType - The event type to subscribe to
   * @param handler - The handler function
   * @param options - Subscription options
   */
  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>,
    options?: SubscriptionOptions
  ): void;

  /**
   * Unsubscribes from events
   * @param eventType - The event type
   * @param handler - The handler to unsubscribe
   */
  unsubscribe<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>
  ): void;

  /**
   * Gets all registered handlers for an event type
   * @param eventType - The event type
   */
  getHandlers(eventType: string): EventHandler[];
}
