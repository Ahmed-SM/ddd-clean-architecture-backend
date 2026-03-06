/**
 * @fileoverview Unique Entity Identifier for Domain-Driven Design
 * @description Represents a unique identifier for entities.
 * Uses CUID2 for generating collision-resistant, sortable IDs.
 */

import { createId } from '@paralleldrive/cuid2';

/**
 * Represents a unique identifier for an entity.
 * Wraps a string ID and provides type-safe comparison and generation.
 */
export class UniqueEntityID {
  private readonly _value: string;

  /**
   * Creates a UniqueEntityID instance.
   * @param value - The string value of the ID (generates new ID if not provided)
   */
  private constructor(value?: string) {
    this._value = value ?? createId();
  }

  /**
   * Gets the string value of the identifier
   */
  get value(): string {
    return this._value;
  }

  /**
   * Generates a new unique identifier
   * @returns A new UniqueEntityID instance with a generated ID
   */
  public static generate(): UniqueEntityID {
    return new UniqueEntityID();
  }

  /**
   * Creates a UniqueEntityID from an existing string value
   * @param value - The existing ID string
   * @returns A UniqueEntityID instance wrapping the provided value
   */
  public static from(value: string): UniqueEntityID {
    if (!value || value.trim() === '') {
      throw new Error('UniqueEntityID cannot be empty');
    }
    return new UniqueEntityID(value);
  }

  /**
   * Compares two UniqueEntityIDs for equality
   * @param id - The ID to compare with
   * @returns true if both IDs have the same value
   */
  public equals(id?: UniqueEntityID): boolean {
    if (!id) {
      return false;
    }
    return this._value === id._value;
  }

  /**
   * Returns the string representation of the ID
   */
  public toString(): string {
    return this._value;
  }

  /**
   * Returns a short version of the ID (first 8 characters)
   */
  public toShort(): string {
    return this._value.substring(0, 8);
  }
}
