/**
 * @fileoverview Order Status Changed Domain Event
 * @description Emitted when an order's status changes
 */

import { DomainEvent } from './domain-event.base';

/**
 * Payload structure for the OrderStatusChangedEvent
 */
export interface OrderStatusChangedPayload {
  /** Unique identifier of the order */
  orderId: string;
  /** Previous status before the change */
  previousStatus: string;
  /** New status after the change */
  newStatus: string;
  /** Reason for the status change (optional) */
  reason?: string;
  /** ID of the user/system that made the change */
  changedBy?: string;
}

/**
 * Domain event emitted when an order's status changes.
 * Common status transitions:
 * - pending → confirmed (after payment)
 * - confirmed → processing (warehouse picked up)
 * - processing → shipped (dispatched)
 * - shipped → delivered (received by customer)
 * - * → cancelled (order cancelled)
 */
export class OrderStatusChangedEvent extends DomainEvent<OrderStatusChangedPayload> {
  /**
   * Creates a new OrderStatusChangedEvent
   * @param aggregateId - The ID of the order aggregate
   * @param payload - The event payload containing status change details
   */
  constructor(aggregateId: string, payload: OrderStatusChangedPayload) {
    super(aggregateId, payload, 'order.status_changed', 1);
  }

  /**
   * Checks if this is a cancellation event
   */
  public isCancellation(): boolean {
    return this.payload.newStatus === 'cancelled';
  }

  /**
   * Checks if this is a completion event
   */
  public isCompletion(): boolean {
    return this.payload.newStatus === 'delivered';
  }

  /**
   * Checks if this is a shipping event
   */
  public isShipping(): boolean {
    return this.payload.newStatus === 'shipped';
  }
}
