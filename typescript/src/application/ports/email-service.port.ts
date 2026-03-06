/**
 * @fileoverview Email Service Port
 * @description Interface for email sending external service
 */

import { Result } from '../../shared';

/**
 * Email attachment
 */
export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

/**
 * Email options
 */
export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
}

/**
 * Email response
 */
export interface SendEmailResponse {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

/**
 * Template email options
 */
export interface SendTemplateEmailOptions {
  to: string | string[];
  templateId: string;
  templateData: Record<string, unknown>;
  from?: string;
}

/**
 * Email Service Port
 * 
 * Interface for email sending operations.
 * Implementations will integrate with SendGrid, AWS SES, etc.
 */
export interface IEmailService {
  /**
   * Sends an email
   * @param options - Email options
   * @returns Result containing the response or error
   */
  sendEmail(options: SendEmailOptions): Promise<Result<SendEmailResponse>>;

  /**
   * Sends a templated email
   * @param options - Template email options
   * @returns Result containing the response or error
   */
  sendTemplateEmail(options: SendTemplateEmailOptions): Promise<Result<SendEmailResponse>>;

  /**
   * Sends an order confirmation email
   * @param orderId - The order ID
   * @param customerEmail - Customer email address
   * @param orderDetails - Order details for the email
   */
  sendOrderConfirmation(
    orderId: string,
    customerEmail: string,
    orderDetails: {
      items: Array<{ name: string; quantity: number; price: number }>;
      total: number;
      currency: string;
      shippingAddress: string;
    }
  ): Promise<Result<SendEmailResponse>>;

  /**
   * Sends a shipping notification email
   * @param orderId - The order ID
   * @param customerEmail - Customer email address
   * @param trackingNumber - Shipping tracking number
   */
  sendShippingNotification(
    orderId: string,
    customerEmail: string,
    trackingNumber: string
  ): Promise<Result<SendEmailResponse>>;

  /**
   * Verifies an email service connection
   */
  verifyConnection(): Promise<boolean>;
}
