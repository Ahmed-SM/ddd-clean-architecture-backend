/**
 * @fileoverview Value Object base class for Domain-Driven Design
 * @description Value Objects are objects defined by their attributes, not identity.
 * Two value objects are equal if all their attributes are equal.
 */

/**
 * Abstract base class for all value objects.
 * Value objects are immutable and compared by their structural equality.
 * 
 * @template T - The properties interface that defines the value object's data
 * 
 * @example
 * interface MoneyProps {
 *   amount: number;
 *   currency: string;
 * }
 * 
 * class Money extends ValueObject<MoneyProps> {
 *   get amount(): number { return this.props.amount; }
 *   get currency(): string { return this.props.currency; }
 *   
 *   public static create(amount: number, currency: string): Money {
 *     if (amount < 0) throw new Error('Amount cannot be negative');
 *     return new Money({ amount, currency });
 *   }
 * }
 */
export abstract class ValueObject<T> {
  protected readonly props: T;

  /**
   * Creates a new Value Object instance.
   * Properties are frozen to ensure immutability.
   * 
   * @param props - The value object's properties
   */
  constructor(props: T) {
    this.props = Object.freeze({ ...props }) as T;
  }

  /**
   * Compares two value objects for structural equality.
   * Two value objects are equal if all their properties are deeply equal.
   * 
   * @param vo - The value object to compare with
   * @returns true if both value objects have the same property values
   */
  public equals(vo?: ValueObject<T>): boolean {
    if (vo === null || vo === undefined) {
      return false;
    }
    if (vo.constructor !== this.constructor) {
      return false;
    }
    return this.shallowEqual(this.props, vo.props);
  }

  /**
   * Performs a shallow equality comparison between two objects.
   * For nested objects, deep equality should be implemented in subclasses.
   */
  private shallowEqual(a: T, b: T): boolean {
    const keysA = Object.keys(a as object);
    const keysB = Object.keys(b as object);

    if (keysA.length !== keysB.length) {
      return false;
    }

    for (const key of keysA) {
      const valueA = (a as Record<string, unknown>)[key];
      const valueB = (b as Record<string, unknown>)[key];
      
      if (valueA !== valueB) {
        return false;
      }
    }

    return true;
  }

  /**
   * Returns a string representation of the value object
   */
  public toString(): string {
    return JSON.stringify(this.props);
  }

  /**
   * Returns a copy of the value object's properties
   */
  public toObject(): T {
    return { ...this.props };
  }
}
