/**
 * @fileoverview Money Value Object
 * @description Represents monetary amounts with currency support and arithmetic operations
 */

import { ValueObject } from '../common/value-object.base';

/**
 * Props interface for the Money value object
 */
interface MoneyProps {
  amount: number;
  currency: string;
}

/**
 * Supported ISO 4217 currency codes
 */
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD' | 'AUD' | 'CHF' | 'CNY' | 'INR';

/**
 * Currency metadata
 */
const CURRENCY_DATA: Record<CurrencyCode, { symbol: string; decimals: number; name: string }> = {
  USD: { symbol: '$', decimals: 2, name: 'US Dollar' },
  EUR: { symbol: '€', decimals: 2, name: 'Euro' },
  GBP: { symbol: '£', decimals: 2, name: 'British Pound' },
  JPY: { symbol: '¥', decimals: 0, name: 'Japanese Yen' },
  CAD: { symbol: 'C$', decimals: 2, name: 'Canadian Dollar' },
  AUD: { symbol: 'A$', decimals: 2, name: 'Australian Dollar' },
  CHF: { symbol: 'CHF', decimals: 2, name: 'Swiss Franc' },
  CNY: { symbol: '¥', decimals: 2, name: 'Chinese Yuan' },
  INR: { symbol: '₹', decimals: 2, name: 'Indian Rupee' },
};

/**
 * Money Value Object
 * 
 * Represents monetary values with currency, ensuring proper handling
 * of financial calculations and preventing common money-related bugs.
 * 
 * @example
 * const price = Money.from(99.99, 'USD');
 * const tax = price.multiply(0.1);
 * const total = price.add(tax);
 * console.log(total.format()); // '$109.99'
 */
export class Money extends ValueObject<MoneyProps> {
  private static readonly SUPPORTED_CURRENCIES = Object.keys(CURRENCY_DATA) as CurrencyCode[];

  /**
   * Gets the monetary amount
   */
  get amount(): number {
    return this.props.amount;
  }

  /**
   * Gets the currency code
   */
  get currency(): string {
    return this.props.currency;
  }

  /**
   * Gets the currency symbol
   */
  get symbol(): string {
    return CURRENCY_DATA[this.props.currency as CurrencyCode]?.symbol ?? this.props.currency;
  }

  /**
   * Gets the number of decimal places for the currency
   */
  get decimals(): number {
    return CURRENCY_DATA[this.props.currency as CurrencyCode]?.decimals ?? 2;
  }

  /**
   * Creates a Money value object
   * @param amount - The monetary amount
   * @param currency - The ISO 4217 currency code
   * @returns A new Money instance
   * @throws Error if the currency is not supported
   */
  public static from(amount: number, currency: CurrencyCode | string): Money {
    // Validate currency
    if (!Money.SUPPORTED_CURRENCIES.includes(currency as CurrencyCode)) {
      throw new Error(`Unsupported currency: ${currency}. Supported: ${Money.SUPPORTED_CURRENCIES.join(', ')}`);
    }

    // Round to appropriate decimal places
    const decimals = CURRENCY_DATA[currency as CurrencyCode]?.decimals ?? 2;
    const roundedAmount = Math.round(amount * Math.pow(10, decimals)) / Math.pow(10, decimals);

    return new Money({ amount: roundedAmount, currency });
  }

  /**
   * Creates a zero amount for a given currency
   */
  public static zero(currency: CurrencyCode | string): Money {
    return Money.from(0, currency);
  }

  /**
   * Creates Money from the smallest currency unit (cents, pence, etc.)
   */
  public static fromMinor(minorAmount: number, currency: CurrencyCode | string): Money {
    const decimals = CURRENCY_DATA[currency as CurrencyCode]?.decimals ?? 2;
    const amount = minorAmount / Math.pow(10, decimals);
    return Money.from(amount, currency);
  }

  /**
   * Adds another Money value to this one
   * @throws Error if currencies don't match
   */
  public add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error(`Cannot add different currencies: ${this.currency} and ${other.currency}`);
    }
    return Money.from(this.amount + other.amount, this.currency);
  }

  /**
   * Subtracts another Money value from this one
   * @throws Error if currencies don't match
   */
  public subtract(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error(`Cannot subtract different currencies: ${this.currency} and ${other.currency}`);
    }
    return Money.from(this.amount - other.amount, this.currency);
  }

  /**
   * Multiplies the amount by a factor
   */
  public multiply(factor: number): Money {
    return Money.from(this.amount * factor, this.currency);
  }

  /**
   * Divides the amount by a divisor
   */
  public divide(divisor: number): Money {
    if (divisor === 0) {
      throw new Error('Cannot divide by zero');
    }
    return Money.from(this.amount / divisor, this.currency);
  }

  /**
   * Calculates a percentage of this amount
   */
  public percentage(percent: number): Money {
    return this.multiply(percent / 100);
  }

  /**
   * Checks if the amount is zero
   */
  public isZero(): boolean {
    return this.amount === 0;
  }

  /**
   * Checks if the amount is positive
   */
  public isPositive(): boolean {
    return this.amount > 0;
  }

  /**
   * Checks if the amount is negative
   */
  public isNegative(): boolean {
    return this.amount < 0;
  }

  /**
   * Checks if this is greater than another Money value
   */
  public isGreaterThan(other: Money): boolean {
    if (this.currency !== other.currency) {
      throw new Error(`Cannot compare different currencies: ${this.currency} and ${other.currency}`);
    }
    return this.amount > other.amount;
  }

  /**
   * Checks if this is less than another Money value
   */
  public isLessThan(other: Money): boolean {
    if (this.currency !== other.currency) {
      throw new Error(`Cannot compare different currencies: ${this.currency} and ${other.currency}`);
    }
    return this.amount < other.amount;
  }

  /**
   * Formats the money for display
   * @param locale - The locale to use for formatting
   */
  public format(locale: string = 'en-US'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this.currency,
    }).format(this.amount);
  }

  /**
   * Formats the money without currency symbol
   */
  public formatAmount(): string {
    return this.amount.toFixed(this.decimals);
  }

  /**
   * Gets the amount in the smallest currency unit (cents)
   */
  public toMinor(): number {
    return Math.round(this.amount * Math.pow(10, this.decimals));
  }

  /**
   * Gets the absolute value
   */
  public abs(): Money {
    return Money.from(Math.abs(this.amount), this.currency);
  }

  /**
   * Negates the amount
   */
  public negate(): Money {
    return Money.from(-this.amount, this.currency);
  }
}
