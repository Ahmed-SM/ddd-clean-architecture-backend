/**
 * @fileoverview Aggregate Root base class for Domain-Driven Design
 * @description Aggregate Roots are the only entry points to aggregates.
 * They ensure consistency boundaries and manage domain events.
 */

import { Entity } from './entity.base';
import { DomainEvent } from '../events/domain-event.base';

/**
 * Abstract base class for aggregate roots.
 * An aggregate root is the root entity of an aggregate cluster,
 * responsible for maintaining invariants and publishing domain events.
 * 
 * @template T - The properties interface for the aggregate
 * 
 * @example
 * interface OrderProps {
 *   customerId: CustomerId;
 *   items: OrderItem[];
 *   status: OrderStatus;
 * }
 * 
 * class Order extends AggregateRoot<OrderProps> {
 *   public confirm(): void {
 *     // Business logic
 *     this.addDomainEvent(new OrderConfirmedEvent(this.id));
 *   }
 * }
 */
export abstract class AggregateRoot<T> extends Entity<T> {
  private _domainEvents: DomainEvent[] = [];

  /**
   * Gets a copy of the uncommitted domain events
   */
  public get domainEvents(): readonly DomainEvent[] {
    return [...this._domainEvents];
  }

  /**
   * Adds a domain event to the aggregate's event list.
   * Events will be dispatched when the aggregate is saved.
   * 
   * @param event - The domain event to add
   */
  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  /**
   * Removes a specific domain event from the aggregate's event list.
   * 
   * @param event - The domain event to remove
   */
  protected removeDomainEvent(event: DomainEvent): void {
    const index = this._domainEvents.findIndex(e => e.eventId === event.eventId);
    if (index !== -1) {
      this._domainEvents.splice(index, 1);
    }
  }

  /**
   * Clears all domain events from the aggregate.
   * Called after events have been successfully dispatched.
   */
  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  /**
   * Checks if the aggregate has any uncommitted domain events.
   */
  public hasDomainEvents(): boolean {
    return this._domainEvents.length > 0;
  }
}
