/**
 * @fileoverview Payment Gateway Port
 * @description Interface for payment processing external service
 */

import { Money } from '../../domain/value-objects';
import { Result } from '../../shared';

/**
 * Payment intent status
 */
export type PaymentIntentStatus = 'pending' | 'succeeded' | 'failed' | 'canceled';

/**
 * Payment intent creation options
 */
export interface CreatePaymentIntentOptions {
  orderId: string;
  amount: Money;
  customerId: string;
  metadata?: Record<string, string>;
}

/**
 * Payment intent response
 */
export interface PaymentIntentResponse {
  id: string;
  orderId: string;
  amount: Money;
  status: PaymentIntentStatus;
  clientSecret?: string;
  createdAt: Date;
  expiresAt?: Date;
}

/**
 * Payment confirmation response
 */
export interface PaymentConfirmationResponse {
  id: string;
  orderId: string;
  amount: Money;
  status: PaymentIntentStatus;
  transactionId?: string;
  failureReason?: string;
  processedAt?: Date;
}

/**
 * Refund response
 */
export interface RefundResponse {
  id: string;
  paymentIntentId: string;
  amount: Money;
  status: 'pending' | 'succeeded' | 'failed';
  processedAt?: Date;
}

/**
 * Payment Gateway Port
 * 
 * Interface for payment processing operations.
 * Implementations will integrate with Stripe, PayPal, etc.
 */
export interface IPaymentGateway {
  /**
   * Creates a payment intent
   * @param options - Payment intent options
   * @returns Result containing the payment intent or error
   */
  createPaymentIntent(
    options: CreatePaymentIntentOptions
  ): Promise<Result<PaymentIntentResponse>>;

  /**
   * Confirms a payment intent
   * @param paymentIntentId - The payment intent ID
   * @param paymentMethodId - Optional payment method ID
   * @returns Result containing the confirmation or error
   */
  confirmPayment(
    paymentIntentId: string,
    paymentMethodId?: string
  ): Promise<Result<PaymentConfirmationResponse>>;

  /**
   * Cancels a payment intent
   * @param paymentIntentId - The payment intent ID
   * @returns Result containing the canceled intent or error
   */
  cancelPaymentIntent(paymentIntentId: string): Promise<Result<PaymentIntentResponse>>;

  /**
   * Gets payment intent status
   * @param paymentIntentId - The payment intent ID
   * @returns Result containing the payment intent or error
   */
  getPaymentIntent(paymentIntentId: string): Promise<Result<PaymentIntentResponse>>;

  /**
   * Refunds a payment
   * @param paymentIntentId - The payment intent ID to refund
   * @param amount - Optional partial refund amount (full refund if not specified)
   * @returns Result containing the refund or error
   */
  refundPayment(
    paymentIntentId: string,
    amount?: Money
  ): Promise<Result<RefundResponse>>;

  /**
   * Handles webhook event
   * @param payload - Raw webhook payload
   * @param signature - Webhook signature for verification
   * @returns Result containing the parsed event or error
   */
  handleWebhook(
    payload: string,
    signature: string
  ): Promise<Result<{ type: string; data: unknown }>>;
}
