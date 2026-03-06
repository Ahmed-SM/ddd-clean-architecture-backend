/**
 * @fileoverview Email Value Object
 * @description Represents a validated email address with domain behavior
 */

import { ValueObject } from '../common/value-object.base';

/**
 * Props interface for the Email value object
 */
interface EmailProps {
  value: string;
}

/**
 * Email Value Object
 * 
 * Encapsulates email validation and ensures all emails in the domain
 * are valid. Provides immutability and type safety.
 * 
 * @example
 * const email = Email.create('user@example.com');
 * console.log(email.value); // 'user@example.com'
 * console.log(email.domain); // 'example.com'
 */
export class Email extends ValueObject<EmailProps> {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private static readonly MAX_LENGTH = 255;

  /**
   * Gets the email address value
   */
  get value(): string {
    return this.props.value;
  }

  /**
   * Gets the local part of the email (before @)
   */
  get localPart(): string {
    return this.props.value.split('@')[0];
  }

  /**
   * Gets the domain part of the email (after @)
   */
  get domain(): string {
    return this.props.value.split('@')[1];
  }

  /**
   * Gets a masked version of the email for display
   * e.g., "u***@example.com"
   */
  get masked(): string {
    const [local, domain] = this.props.value.split('@');
    const maskedLocal = local.charAt(0) + '***';
    return `${maskedLocal}@${domain}`;
  }

  /**
   * Creates a new Email value object
   * @param email - The email address string
   * @returns A new Email instance
   * @throws Error if the email is invalid
   */
  public static create(email: string): Email {
    // Normalize the email
    const normalizedEmail = email.toLowerCase().trim();

    // Validate
    if (!normalizedEmail) {
      throw new Error('Email cannot be empty');
    }

    if (normalizedEmail.length > Email.MAX_LENGTH) {
      throw new Error(`Email cannot exceed ${Email.MAX_LENGTH} characters`);
    }

    if (!Email.EMAIL_REGEX.test(normalizedEmail)) {
      throw new Error(`Invalid email format: ${email}`);
    }

    return new Email({ value: normalizedEmail });
  }

  /**
   * Creates an Email from a trusted source (skips validation)
   * @param email - The email address (assumed to be valid)
   */
  public static fromTrusted(email: string): Email {
    return new Email({ value: email.toLowerCase() });
  }

  /**
   * Checks if a string is a valid email format
   */
  public static isValid(email: string): boolean {
    try {
      Email.create(email);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checks if the email is from a common provider
   */
  public isCommonProvider(): boolean {
    const commonDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];
    return commonDomains.includes(this.domain);
  }

  /**
   * Checks if the email is a business/corporate email
   */
  public isBusinessEmail(): boolean {
    const freeProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com'];
    return !freeProviders.includes(this.domain);
  }
}
