/**
 * @fileoverview Order Aggregate Root
 * @description The Order aggregate root that manages orders and their items
 */

import { AggregateRoot } from '../common/aggregate-root.base';
import { UniqueEntityID } from '../common/unique-entity-id';
import { OrderStatus, Money, Address } from '../value-objects';
import { OrderItem } from './order-item.entity';
import { OrderCreatedEvent } from '../events/order-created.event';
import { OrderStatusChangedEvent } from '../events/order-status-changed.event';

/**
 * Props interface for Order aggregate
 */
interface OrderProps {
  customerId: UniqueEntityID;
  items: OrderItem[];
  status: OrderStatus;
  totalAmount: Money;
  shippingAddress: Address;
  billingAddress: Address | null;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Order Aggregate Root
 * 
 * Represents a customer order with order items.
 * Manages order lifecycle, business rules, and invariants.
 * 
 * Business Rules:
 * - Orders start in 'pending' status
 * - Items can only be modified in 'pending' status
 * - Status transitions follow a specific workflow
 * - Total amount is automatically calculated from items
 * 
 * @example
 * const order = Order.create({
 *   customerId: UniqueEntityID.from('customer-123'),
 *   items: [orderItem1, orderItem2],
 *   shippingAddress: Address.create({ ... })
 * });
 * 
 * order.confirm(); // Transitions to 'confirmed'
 */
export class Order extends AggregateRoot<OrderProps> {
  private constructor(props: OrderProps, id?: UniqueEntityID) {
    super(props, id);
  }

  /**
   * Gets the customer ID
   */
  get customerId(): UniqueEntityID {
    return this.props.customerId;
  }

  /**
   * Gets the order items
   */
  get items(): readonly OrderItem[] {
    return this.props.items;
  }

  /**
   * Gets the order status
   */
  get status(): OrderStatus {
    return this.props.status;
  }

  /**
   * Gets the total amount
   */
  get totalAmount(): Money {
    return this.props.totalAmount;
  }

  /**
   * Gets the shipping address
   */
  get shippingAddress(): Address {
    return this.props.shippingAddress;
  }

  /**
   * Gets the billing address
   */
  get billingAddress(): Address | null {
    return this.props.billingAddress;
  }

  /**
   * Gets order notes
   */
  get notes(): string {
    return this.props.notes;
  }

  /**
   * Gets the item count
   */
  get itemCount(): number {
    return this.props.items.length;
  }

  /**
   * Gets the total quantity of all items
   */
  get totalQuantity(): number {
    return this.props.items.reduce((sum, item) => sum + item.quantity.value, 0);
  }

  /**
   * Gets creation timestamp
   */
  get createdAt(): Date {
    return this.props.createdAt;
  }

  /**
   * Gets last update timestamp
   */
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Creates a new Order
   */
  public static create(props: {
    customerId: UniqueEntityID;
    items: OrderItem[];
    shippingAddress: Address;
    billingAddress?: Address;
    notes?: string;
  }): Order {
    // Validate
    if (props.items.length === 0) {
      throw new Error('Order must have at least one item');
    }

    // Ensure all items have the same currency
    const currencies = new Set(props.items.map(item => item.unitPrice.currency));
    if (currencies.size > 1) {
      throw new Error('All order items must have the same currency');
    }

    const currency = props.items[0].unitPrice.currency;
    const totalAmount = props.items.reduce(
      (sum, item) => sum.add(item.subtotal),
      Money.zero(currency)
    );

    const now = new Date();

    const order = new Order({
      customerId: props.customerId,
      items: [...props.items],
      status: OrderStatus.pending(),
      totalAmount,
      shippingAddress: props.shippingAddress,
      billingAddress: props.billingAddress ?? null,
      notes: props.notes?.trim() ?? '',
      createdAt: now,
      updatedAt: now,
    });

    // Add domain event
    order.addDomainEvent(new OrderCreatedEvent(order.id.value, {
      orderId: order.id.value,
      customerId: order.customerId.value,
      itemCount: order.itemCount,
      totalAmount: order.totalAmount.amount,
      currency: order.totalAmount.currency,
      status: order.status.value,
      shippingCity: order.shippingAddress.city,
      shippingCountry: order.shippingAddress.country,
    }));

    return order;
  }

  /**
   * Creates an Order from persistence data
   */
  public static fromPersistence(props: {
    id: string;
    customerId: string;
    items: OrderItem[];
    status: string;
    totalAmount: number;
    currency: string;
    shippingAddress: Address;
    billingAddress: Address | null;
    notes: string;
    createdAt: Date;
    updatedAt: Date;
  }): Order {
    return new Order(
      {
        customerId: UniqueEntityID.from(props.customerId),
        items: props.items,
        status: OrderStatus.from(props.status),
        totalAmount: Money.from(props.totalAmount, props.currency),
        shippingAddress: props.shippingAddress,
        billingAddress: props.billingAddress,
        notes: props.notes,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      UniqueEntityID.from(props.id)
    );
  }

  /**
   * Adds an item to the order
   * @throws Error if order cannot be modified
   */
  public addItem(item: OrderItem): void {
    if (!this.canBeModified()) {
      throw new Error(`Cannot add item to order in '${this.props.status.value}' status`);
    }

    // Check for existing item with same product
    const existingIndex = this.props.items.findIndex(
      i => i.productId.equals(item.productId)
    );

    if (existingIndex !== -1) {
      // Update quantity of existing item
      const existing = this.props.items[existingIndex];
      const newQuantity = existing.quantity.add(item.quantity);
      existing.updateQuantity(newQuantity);
    } else {
      // Add new item
      this.props.items.push(item);
    }

    this.recalculateTotal();
    this.props.updatedAt = new Date();
  }

  /**
   * Removes an item from the order
   * @throws Error if order cannot be modified or would be empty
   */
  public removeItem(itemId: string): void {
    if (!this.canBeModified()) {
      throw new Error(`Cannot remove item from order in '${this.props.status.value}' status`);
    }

    const index = this.props.items.findIndex(item => item.id.value === itemId);
    if (index === -1) {
      throw new Error(`Item not found: ${itemId}`);
    }

    if (this.props.items.length === 1) {
      throw new Error('Cannot remove the last item from an order');
    }

    this.props.items.splice(index, 1);
    this.recalculateTotal();
    this.props.updatedAt = new Date();
  }

  /**
   * Updates the quantity of an item
   */
  public updateItemQuantity(itemId: string, quantity: import('../value-objects/quantity.value-object').Quantity): void {
    if (!this.canBeModified()) {
      throw new Error(`Cannot modify order in '${this.props.status.value}' status`);
    }

    const item = this.props.items.find(i => i.id.value === itemId);
    if (!item) {
      throw new Error(`Item not found: ${itemId}`);
    }

    item.updateQuantity(quantity);
    this.recalculateTotal();
    this.props.updatedAt = new Date();
  }

  /**
   * Confirms the order (after payment)
   * @throws Error if status transition is invalid
   */
  public confirm(): void {
    if (!this.props.status.canTransitionTo('confirmed')) {
      throw new Error(`Cannot confirm order in '${this.props.status.value}' status`);
    }

    const previousStatus = this.props.status.value;
    this.props.status = OrderStatus.confirmed();
    this.props.updatedAt = new Date();

    this.addDomainEvent(new OrderStatusChangedEvent(this.id.value, {
      orderId: this.id.value,
      previousStatus,
      newStatus: 'confirmed',
    }));
  }

  /**
   * Starts processing the order
   */
  public startProcessing(): void {
    if (!this.props.status.canTransitionTo('processing')) {
      throw new Error(`Cannot start processing order in '${this.props.status.value}' status`);
    }

    const previousStatus = this.props.status.value;
    this.props.status = OrderStatus.processing();
    this.props.updatedAt = new Date();

    this.addDomainEvent(new OrderStatusChangedEvent(this.id.value, {
      orderId: this.id.value,
      previousStatus,
      newStatus: 'processing',
    }));
  }

  /**
   * Ships the order
   */
  public ship(): void {
    if (!this.props.status.canTransitionTo('shipped')) {
      throw new Error(`Cannot ship order in '${this.props.status.value}' status`);
    }

    const previousStatus = this.props.status.value;
    this.props.status = OrderStatus.shipped();
    this.props.updatedAt = new Date();

    this.addDomainEvent(new OrderStatusChangedEvent(this.id.value, {
      orderId: this.id.value,
      previousStatus,
      newStatus: 'shipped',
    }));
  }

  /**
   * Marks the order as delivered
   */
  public deliver(): void {
    if (!this.props.status.canTransitionTo('delivered')) {
      throw new Error(`Cannot deliver order in '${this.props.status.value}' status`);
    }

    const previousStatus = this.props.status.value;
    this.props.status = OrderStatus.delivered();
    this.props.updatedAt = new Date();

    this.addDomainEvent(new OrderStatusChangedEvent(this.id.value, {
      orderId: this.id.value,
      previousStatus,
      newStatus: 'delivered',
    }));
  }

  /**
   * Cancels the order
   * @param reason - Reason for cancellation
   */
  public cancel(reason: string): void {
    if (!this.props.status.canTransitionTo('cancelled')) {
      throw new Error(`Cannot cancel order in '${this.props.status.value}' status`);
    }

    const previousStatus = this.props.status.value;
    this.props.status = OrderStatus.cancelled();
    this.props.notes = this.props.notes
      ? `${this.props.notes}\nCancellation reason: ${reason}`
      : `Cancellation reason: ${reason}`;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new OrderStatusChangedEvent(this.id.value, {
      orderId: this.id.value,
      previousStatus,
      newStatus: 'cancelled',
      reason,
    }));
  }

  /**
   * Refunds the order
   */
  public refund(reason: string): void {
    if (!this.props.status.canTransitionTo('refunded')) {
      throw new Error(`Cannot refund order in '${this.props.status.value}' status`);
    }

    const previousStatus = this.props.status.value;
    this.props.status = OrderStatus.refunded();
    this.props.notes = this.props.notes
      ? `${this.props.notes}\nRefund reason: ${reason}`
      : `Refund reason: ${reason}`;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new OrderStatusChangedEvent(this.id.value, {
      orderId: this.id.value,
      previousStatus,
      newStatus: 'refunded',
      reason,
    }));
  }

  /**
   * Updates shipping address
   */
  public updateShippingAddress(address: Address): void {
    if (!this.canBeModified()) {
      throw new Error(`Cannot update shipping address for order in '${this.props.status.value}' status`);
    }

    this.props.shippingAddress = address;
    this.props.updatedAt = new Date();
  }

  /**
   * Updates billing address
   */
  public updateBillingAddress(address: Address): void {
    if (!this.canBeModified()) {
      throw new Error(`Cannot update billing address for order in '${this.props.status.value}' status`);
    }

    this.props.billingAddress = address;
    this.props.updatedAt = new Date();
  }

  /**
   * Adds notes to the order
   */
  public addNotes(notes: string): void {
    this.props.notes = notes.trim();
    this.props.updatedAt = new Date();
  }

  /**
   * Checks if the order can be modified
   */
  public canBeModified(): boolean {
    return this.props.status.value === 'pending';
  }

  /**
   * Checks if the order can be cancelled
   */
  public canBeCancelled(): boolean {
    return this.props.status.isCancellable();
  }

  /**
   * Checks if the order requires payment
   */
  public requiresPayment(): boolean {
    return this.props.status.requiresPayment();
  }

  /**
   * Checks if the order has been paid
   */
  public isPaid(): boolean {
    return this.props.status.isPaid();
  }

  /**
   * Checks if the order is complete
   */
  public isComplete(): boolean {
    return this.props.status.isComplete();
  }

  /**
   * Recalculates the total amount from items
   */
  private recalculateTotal(): void {
    if (this.props.items.length === 0) {
      return;
    }

    const currency = this.props.items[0].unitPrice.currency;
    this.props.totalAmount = this.props.items.reduce(
      (sum, item) => sum.add(item.subtotal),
      Money.zero(currency)
    );
  }

  /**
   * Converts to a plain object for serialization
   */
  public toPrimitives(): {
    id: string;
    customerId: string;
    items: ReturnType<OrderItem['toPrimitives']>[];
    status: string;
    totalAmount: number;
    currency: string;
    shippingAddress: ReturnType<Address['toPrimitives']>;
    billingAddress: ReturnType<Address['toPrimitives']> | null;
    notes: string;
    itemCount: number;
    totalQuantity: number;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.id.value,
      customerId: this.customerId.value,
      items: this.items.map(item => item.toPrimitives()),
      status: this.status.value,
      totalAmount: this.totalAmount.amount,
      currency: this.totalAmount.currency,
      shippingAddress: this.shippingAddress.toPrimitives(),
      billingAddress: this.billingAddress?.toPrimitives() ?? null,
      notes: this.notes,
      itemCount: this.itemCount,
      totalQuantity: this.totalQuantity,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
