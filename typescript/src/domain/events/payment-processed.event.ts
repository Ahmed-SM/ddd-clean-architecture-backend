/**
 * @fileoverview Payment Processed Domain Event
 * @description Emitted when a payment is processed for an order
 */

import { DomainEvent } from './domain-event.base';

/**
 * Payload structure for the PaymentProcessedEvent
 */
export interface PaymentProcessedPayload {
  /** Unique identifier of the payment */
  paymentId: string;
  /** ID of the associated order */
  orderId: string;
  /** ID of the customer who made the payment */
  customerId: string;
  /** Amount paid */
  amount: number;
  /** Currency of the payment (ISO 4217) */
  currency: string;
  /** Payment method used */
  paymentMethod: string;
  /** Status of the payment */
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  /** External transaction ID from payment provider */
  transactionId?: string;
  /** Failure reason if payment failed */
  failureReason?: string;
}

/**
 * Domain event emitted when a payment is processed.
 * This event can trigger:
 * - Order confirmation
 * - Invoice generation
 * - Receipt emails
 * - Inventory reservation
 */
export class PaymentProcessedEvent extends DomainEvent<PaymentProcessedPayload> {
  /**
   * Creates a new PaymentProcessedEvent
   * @param aggregateId - The ID of the payment or order aggregate
   * @param payload - The event payload containing payment details
   */
  constructor(aggregateId: string, payload: PaymentProcessedPayload) {
    super(aggregateId, payload, 'payment.processed', 1);
  }

  /**
   * Checks if the payment was successful
   */
  public isSuccessful(): boolean {
    return this.payload.status === 'succeeded';
  }

  /**
   * Checks if the payment failed
   */
  public isFailed(): boolean {
    return this.payload.status === 'failed';
  }

  /**
   * Checks if the payment was refunded
   */
  public isRefunded(): boolean {
    return this.payload.status === 'refunded';
  }
}
