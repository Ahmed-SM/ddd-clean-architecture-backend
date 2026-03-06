/**
 * @fileoverview Product SKU Value Object
 * @description Represents a Stock Keeping Unit identifier
 */

import { ValueObject } from '../common/value-object.base';

/**
 * Props interface for the SKU value object
 */
interface SKUProps {
  value: string;
}

/**
 * SKU (Stock Keeping Unit) Value Object
 * 
 * Represents a unique product identifier used for inventory tracking.
 * Validates SKU format and provides parsing utilities.
 * 
 * @example
 * const sku = SKU.create('ELEC-LAPTOP-001');
 * console.log(sku.category); // 'ELEC'
 * console.log(sku.productType); // 'LAPTOP'
 */
export class SKU extends ValueObject<SKUProps> {
  private static readonly SKU_REGEX = /^[A-Z]{2,4}-[A-Z]{2,6}-\d{3,6}$/;
  private static readonly MAX_LENGTH = 20;

  /**
   * Gets the SKU value
   */
  get value(): string {
    return this.props.value;
  }

  /**
   * Gets the category prefix (first part)
   */
  get category(): string {
    return this.props.value.split('-')[0];
  }

  /**
   * Gets the product type (second part)
   */
  get productType(): string {
    return this.props.value.split('-')[1];
  }

  /**
   * Gets the sequence number (third part)
   */
  get sequence(): number {
    return parseInt(this.props.value.split('-')[2], 10);
  }

  /**
   * Creates a SKU from a string
   * @param value - The SKU string
   * @throws Error if the SKU format is invalid
   */
  public static create(value: string): SKU {
    const normalized = value.toUpperCase().trim();

    if (!normalized) {
      throw new Error('SKU cannot be empty');
    }

    if (normalized.length > SKU.MAX_LENGTH) {
      throw new Error(`SKU cannot exceed ${SKU.MAX_LENGTH} characters`);
    }

    if (!SKU.SKU_REGEX.test(normalized)) {
      throw new Error(`Invalid SKU format: ${value}. Expected format: XXXX-XXXX-000`);
    }

    return new SKU({ value: normalized });
  }

  /**
   * Generates a new SKU from components
   * @param category - Category code (2-4 letters)
   * @param productType - Product type code (2-6 letters)
   * @param sequence - Sequence number
   */
  public static generate(category: string, productType: string, sequence: number): SKU {
    const cat = category.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    const type = productType.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6);
    const seq = sequence.toString().padStart(4, '0').slice(0, 6);

    if (cat.length < 2) {
      throw new Error('Category code must be at least 2 letters');
    }
    if (type.length < 2) {
      throw new Error('Product type code must be at least 2 letters');
    }

    return SKU.create(`${cat}-${type}-${seq}`);
  }

  /**
   * Checks if a string is a valid SKU format
   */
  public static isValid(value: string): boolean {
    try {
      SKU.create(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checks if this SKU belongs to a specific category
   */
  public isCategory(category: string): boolean {
    return this.category === category.toUpperCase();
  }

  /**
   * Checks if this SKU is for a specific product type
   */
  public isProductType(type: string): boolean {
    return this.productType === type.toUpperCase();
  }
}
