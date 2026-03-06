/**
 * @fileoverview Order Created Domain Event
 * @description Emitted when a new order is created in the system
 */

import { DomainEvent } from './domain-event.base';

/**
 * Payload structure for the OrderCreatedEvent
 */
export interface OrderCreatedPayload {
  /** Unique identifier of the order */
  orderId: string;
  /** ID of the customer who placed the order */
  customerId: string;
  /** Number of items in the order */
  itemCount: number;
  /** Total amount of the order */
  totalAmount: number;
  /** Currency of the order total (ISO 4217) */
  currency: string;
  /** Status of the order at creation */
  status: string;
  /** Shipping address city */
  shippingCity: string;
  /** Shipping address country */
  shippingCountry: string;
}

/**
 * Domain event emitted when a new order is successfully created.
 * This event can trigger side effects like:
 * - Sending order confirmation emails
 * - Reserving inventory
 * - Updating customer statistics
 * - Notifying warehouse systems
 */
export class OrderCreatedEvent extends DomainEvent<OrderCreatedPayload> {
  /**
   * Creates a new OrderCreatedEvent
   * @param orderId - The ID of the created order
   * @param payload - The event payload containing order details
   */
  constructor(aggregateId: string, payload: OrderCreatedPayload) {
    super(aggregateId, payload, 'order.created', 1);
  }

  /**
   * Creates an OrderCreatedEvent from a plain object
   */
  public static from(data: Omit<OrderCreatedPayload, 'status'> & { aggregateId: string }): OrderCreatedEvent {
    return new OrderCreatedEvent(data.aggregateId, {
      ...data,
      status: 'pending',
    });
  }
}
