/**
 * @fileoverview Domain Event base class for Domain-Driven Design
 * @description Domain events represent something that happened in the domain
 * that other parts of the system need to be aware of.
 */

import { createId } from '@paralleldrive/cuid2';

/**
 * Interface for domain events
 */
export interface IDomainEvent {
  /** Unique identifier for this event instance */
  readonly eventId: string;
  /** Type/name of the event (e.g., 'order.created') */
  readonly eventType: string;
  /** When the event occurred */
  readonly occurredAt: Date;
  /** ID of the aggregate that emitted this event */
  readonly aggregateId: string;
  /** Event-specific data */
  readonly payload: unknown;
  /** Event version for schema evolution */
  readonly version: number;
}

/**
 * Abstract base class for domain events.
 * Domain events are immutable records of something significant that happened
 * in the domain, with all the relevant data encapsulated.
 * 
 * @template T - The type of the event payload
 * 
 * @example
 * interface OrderCreatedPayload {
 *   orderId: string;
 *   customerId: string;
 *   totalAmount: number;
 * }
 * 
 * class OrderCreatedEvent extends DomainEvent<OrderCreatedPayload> {
 *   constructor(orderId: string, payload: OrderCreatedPayload) {
 *     super(orderId, payload, 'order.created', 1);
 *   }
 * }
 */
export abstract class DomainEvent<T = unknown> implements IDomainEvent {
  public readonly eventId: string;
  public readonly occurredAt: Date;

  /**
   * Creates a new domain event
   * 
   * @param aggregateId - ID of the aggregate that emitted this event
   * @param payload - Event-specific data
   * @param eventType - Type/name of the event
   * @param version - Schema version for event evolution
   */
  constructor(
    public readonly aggregateId: string,
    public readonly payload: T,
    public readonly eventType: string,
    public readonly version: number = 1
  ) {
    this.eventId = createId();
    this.occurredAt = new Date();
  }

  /**
   * Converts the event to a JSON-serializable object
   */
  public toJSON(): Record<string, unknown> {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      occurredAt: this.occurredAt.toISOString(),
      aggregateId: this.aggregateId,
      payload: this.payload,
      version: this.version,
    };
  }

  /**
   * Creates a domain event from a JSON object
   */
  public static fromJSON<T>(data: Record<string, unknown>): IDomainEvent {
    return {
      eventId: data.eventId as string,
      eventType: data.eventType as string,
      occurredAt: new Date(data.occurredAt as string),
      aggregateId: data.aggregateId as string,
      payload: data.payload as T,
      version: (data.version as number) ?? 1,
    };
  }
}
