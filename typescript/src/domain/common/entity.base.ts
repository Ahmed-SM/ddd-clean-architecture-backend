/**
 * @fileoverview Base Entity class for Domain-Driven Design
 * @description Entities are objects defined by their identity rather than their attributes.
 * Two entities are considered equal if they have the same identity, regardless of their attributes.
 */

import { UniqueEntityID } from './unique-entity-id';

/**
 * Abstract base class for all domain entities.
 * Provides identity-based equality and common entity behavior.
 * 
 * @template T - The properties interface that defines the entity's data
 * 
 * @example
 * interface UserProps {
 *   email: string;
 *   name: string;
 * }
 * 
 * class User extends Entity<UserProps> {
 *   get email(): string { return this.props.email; }
 *   get name(): string { return this.props.name; }
 * }
 */
export abstract class Entity<T> {
  protected readonly props: T;
  protected readonly _id: UniqueEntityID;

  /**
   * Creates a new Entity instance
   * @param props - The entity's properties
   * @param id - Optional unique identifier (generated if not provided)
   */
  constructor(props: T, id?: UniqueEntityID) {
    this._id = id ?? UniqueEntityID.generate();
    this.props = props;
  }

  /**
   * Gets the entity's unique identifier
   */
  get id(): UniqueEntityID {
    return this._id;
  }

  /**
   * Compares two entities for equality based on their identities.
   * Two entities are equal if they have the same ID, regardless of their attributes.
   * 
   * @param entity - The entity to compare with
   * @returns true if both entities have the same ID
   */
  public equals(entity?: Entity<T>): boolean {
    if (entity === null || entity === undefined) {
      return false;
    }
    if (this === entity) {
      return true;
    }
    if (!(entity instanceof Entity)) {
      return false;
    }
    return this._id.equals(entity._id);
  }

  /**
   * Returns a string representation of the entity
   */
  public toString(): string {
    return `${this.constructor.name}(${this._id.toString()})`;
  }
}
