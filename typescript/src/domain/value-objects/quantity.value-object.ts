/**
 * @fileoverview Quantity Value Object
 * @description Represents a positive quantity with validation
 */

import { ValueObject } from '../common/value-object.base';

/**
 * Props interface for the Quantity value object
 */
interface QuantityProps {
  value: number;
}

/**
 * Quantity Value Object
 * 
 * Represents a positive integer quantity with business rules.
 * Used for product quantities, order item quantities, stock levels, etc.
 * 
 * @example
 * const qty = Quantity.from(5);
 * const doubled = qty.multiply(2);
 * console.log(doubled.value); // 10
 */
export class Quantity extends ValueObject<QuantityProps> {
  private static readonly MAX_VALUE = 999999;
  private static readonly MIN_VALUE = 0;

  /**
   * Gets the quantity value
   */
  get value(): number {
    return this.props.value;
  }

  /**
   * Creates a Quantity from a number
   * @param value - The quantity value
   * @throws Error if value is invalid
   */
  public static from(value: number): Quantity {
    if (!Number.isInteger(value)) {
      throw new Error('Quantity must be an integer');
    }

    if (value < Quantity.MIN_VALUE) {
      throw new Error(`Quantity cannot be negative (got ${value})`);
    }

    if (value > Quantity.MAX_VALUE) {
      throw new Error(`Quantity cannot exceed ${Quantity.MAX_VALUE}`);
    }

    return new Quantity({ value });
  }

  /**
   * Creates a zero quantity
   */
  public static zero(): Quantity {
    return new Quantity({ value: 0 });
  }

  /**
   * Creates a quantity of one
   */
  public static one(): Quantity {
    return new Quantity({ value: 1 });
  }

  /**
   * Adds another quantity to this one
   */
  public add(other: Quantity): Quantity {
    return Quantity.from(this.value + other.value);
  }

  /**
   * Subtracts another quantity from this one
   * @throws Error if result would be negative
   */
  public subtract(other: Quantity): Quantity {
    const result = this.value - other.value;
    if (result < 0) {
      throw new Error('Cannot subtract: result would be negative');
    }
    return Quantity.from(result);
  }

  /**
   * Multiplies the quantity by a factor
   */
  public multiply(factor: number): Quantity {
    if (factor < 0) {
      throw new Error('Cannot multiply by negative factor');
    }
    return Quantity.from(Math.round(this.value * factor));
  }

  /**
   * Checks if the quantity is zero
   */
  public isZero(): boolean {
    return this.value === 0;
  }

  /**
   * Checks if the quantity is positive (greater than zero)
   */
  public isPositive(): boolean {
    return this.value > 0;
  }

  /**
   * Checks if this is greater than another quantity
   */
  public isGreaterThan(other: Quantity): boolean {
    return this.value > other.value;
  }

  /**
   * Checks if this is less than another quantity
   */
  public isLessThan(other: Quantity): boolean {
    return this.value < other.value;
  }

  /**
   * Checks if this is at least a certain amount
   */
  public isAtLeast(minimum: number): boolean {
    return this.value >= minimum;
  }

  /**
   * Checks if this is at most a certain amount
   */
  public isAtMost(maximum: number): boolean {
    return this.value <= maximum;
  }

  /**
   * Checks if there's enough stock (quantity available)
   */
  public canFulfill(requested: Quantity): boolean {
    return this.value >= requested.value;
  }

  /**
   * Gets the remaining quantity after fulfilling a request
   */
  public remainingAfter(requested: Quantity): Quantity {
    if (!this.canFulfill(requested)) {
      throw new Error('Insufficient quantity to fulfill request');
    }
    return this.subtract(requested);
  }

  /**
   * Creates a negative quantity for deficit calculations
   */
  public deficit(): Quantity {
    return Quantity.from(-this.value);
  }
}
