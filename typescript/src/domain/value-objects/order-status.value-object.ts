/**
 * @fileoverview Order Status Value Object
 * @description Represents the status of an order with valid transitions
 */

import { ValueObject } from '../common/value-object.base';

/**
 * All possible order status values
 */
export type OrderStatusValue =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

/**
 * Valid status transitions - defines which statuses can transition to which
 */
const VALID_TRANSITIONS: Record<OrderStatusValue, OrderStatusValue[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

/**
 * Status display information
 */
const STATUS_INFO: Record<OrderStatusValue, { label: string; description: string; color: string }> = {
  pending: { label: 'Pending', description: 'Order received, awaiting payment', color: 'yellow' },
  confirmed: { label: 'Confirmed', description: 'Payment received, preparing order', color: 'blue' },
  processing: { label: 'Processing', description: 'Order is being prepared', color: 'indigo' },
  shipped: { label: 'Shipped', description: 'Order has been dispatched', color: 'purple' },
  delivered: { label: 'Delivered', description: 'Order has been delivered', color: 'green' },
  cancelled: { label: 'Cancelled', description: 'Order has been cancelled', color: 'red' },
  refunded: { label: 'Refunded', description: 'Order has been refunded', color: 'gray' },
};

/**
 * Props interface for the OrderStatus value object
 */
interface OrderStatusProps {
  value: OrderStatusValue;
}

/**
 * Order Status Value Object
 * 
 * Represents the lifecycle state of an order with valid transitions.
 * Enforces business rules around status changes.
 * 
 * @example
 * const status = OrderStatus.pending();
 * 
 * if (status.canTransitionTo('confirmed')) {
 *   const newStatus = OrderStatus.confirmed();
 * }
 */
export class OrderStatus extends ValueObject<OrderStatusProps> {
  /**
   * Gets the status value
   */
  get value(): OrderStatusValue {
    return this.props.value;
  }

  /**
   * Gets the display label
   */
  get label(): string {
    return STATUS_INFO[this.props.value].label;
  }

  /**
   * Gets the status description
   */
  get description(): string {
    return STATUS_INFO[this.props.value].description;
  }

  /**
   * Gets the status color for UI
   */
  get color(): string {
    return STATUS_INFO[this.props.value].color;
  }

  /**
   * Creates an OrderStatus from a string value
   * @throws Error if the status is invalid
   */
  public static from(value: string): OrderStatus {
    if (!this.isValidStatus(value)) {
      throw new Error(`Invalid order status: ${value}`);
    }
    return new OrderStatus({ value: value as OrderStatusValue });
  }

  /**
   * Factory method for pending status
   */
  public static pending(): OrderStatus {
    return new OrderStatus({ value: 'pending' });
  }

  /**
   * Factory method for confirmed status
   */
  public static confirmed(): OrderStatus {
    return new OrderStatus({ value: 'confirmed' });
  }

  /**
   * Factory method for processing status
   */
  public static processing(): OrderStatus {
    return new OrderStatus({ value: 'processing' });
  }

  /**
   * Factory method for shipped status
   */
  public static shipped(): OrderStatus {
    return new OrderStatus({ value: 'shipped' });
  }

  /**
   * Factory method for delivered status
   */
  public static delivered(): OrderStatus {
    return new OrderStatus({ value: 'delivered' });
  }

  /**
   * Factory method for cancelled status
   */
  public static cancelled(): OrderStatus {
    return new OrderStatus({ value: 'cancelled' });
  }

  /**
   * Factory method for refunded status
   */
  public static refunded(): OrderStatus {
    return new OrderStatus({ value: 'refunded' });
  }

  /**
   * Checks if a string is a valid status
   */
  public static isValidStatus(value: string): value is OrderStatusValue {
    return Object.keys(VALID_TRANSITIONS).includes(value);
  }

  /**
   * Checks if this status can transition to another status
   * @param targetStatus - The status to transition to
   */
  public canTransitionTo(targetStatus: OrderStatusValue): boolean {
    return VALID_TRANSITIONS[this.props.value].includes(targetStatus);
  }

  /**
   * Gets all possible next statuses
   */
  public getPossibleTransitions(): OrderStatusValue[] {
    return [...VALID_TRANSITIONS[this.props.value]];
  }

  /**
   * Checks if this is a final status (no further transitions possible)
   */
  public isFinal(): boolean {
    return VALID_TRANSITIONS[this.props.value].length === 0;
  }

  /**
   * Checks if the order can be cancelled from this status
   */
  public isCancellable(): boolean {
    return this.canTransitionTo('cancelled');
  }

  /**
   * Checks if the order is active (not cancelled or refunded)
   */
  public isActive(): boolean {
    return !['cancelled', 'refunded'].includes(this.props.value);
  }

  /**
   * Checks if payment is required for this status
   */
  public requiresPayment(): boolean {
    return this.props.value === 'pending';
  }

  /**
   * Checks if the order has been paid
   */
  public isPaid(): boolean {
    return ['confirmed', 'processing', 'shipped', 'delivered', 'refunded'].includes(this.props.value);
  }

  /**
   * Checks if the order has been shipped
   */
  public isShipped(): boolean {
    return ['shipped', 'delivered'].includes(this.props.value);
  }

  /**
   * Checks if the order is complete
   */
  public isComplete(): boolean {
    return this.props.value === 'delivered';
  }
}
