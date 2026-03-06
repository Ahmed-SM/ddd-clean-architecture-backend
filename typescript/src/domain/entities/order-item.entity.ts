/**
 * @fileoverview Order Item Entity
 * @description Represents a line item within an order
 */

import { Entity } from '../common/entity.base';
import { UniqueEntityID } from '../common/unique-entity-id';
import { Money } from '../value-objects';
import { Quantity } from '../value-objects/quantity.value-object';

/**
 * Props interface for OrderItem entity
 */
interface OrderItemProps {
  productId: UniqueEntityID;
  productName: string;
  productSku: string;
  unitPrice: Money;
  quantity: Quantity;
  discount: Money;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * OrderItem Entity
 * 
 * Represents a single line item in an order.
 * Contains product reference, pricing, and quantity information.
 * 
 * @example
 * const item = OrderItem.create({
 *   productId: UniqueEntityID.from('product-123'),
 *   productName: 'Wireless Mouse',
 *   productSku: 'ELEC-MOUSE-001',
 *   unitPrice: Money.from(29.99, 'USD'),
 *   quantity: Quantity.from(2)
 * });
 */
export class OrderItem extends Entity<OrderItemProps> {
  /**
   * Gets the product ID
   */
  get productId(): UniqueEntityID {
    return this.props.productId;
  }

  /**
   * Gets the product name (snapshot at time of order)
   */
  get productName(): string {
    return this.props.productName;
  }

  /**
   * Gets the product SKU
   */
  get productSku(): string {
    return this.props.productSku;
  }

  /**
   * Gets the unit price
   */
  get unitPrice(): Money {
    return this.props.unitPrice;
  }

  /**
   * Gets the quantity
   */
  get quantity(): Quantity {
    return this.props.quantity;
  }

  /**
   * Gets the discount amount
   */
  get discount(): Money {
    return this.props.discount;
  }

  /**
   * Calculates the subtotal (unit price * quantity - discount)
   */
  get subtotal(): Money {
    const grossTotal = this.props.unitPrice.multiply(this.props.quantity.value);
    return grossTotal.subtract(this.props.discount);
  }

  /**
   * Calculates the gross total before discount
   */
  get grossTotal(): Money {
    return this.props.unitPrice.multiply(this.props.quantity.value);
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
   * Creates a new OrderItem
   */
  public static create(props: {
    productId: UniqueEntityID;
    productName: string;
    productSku: string;
    unitPrice: Money;
    quantity: Quantity;
    discount?: Money;
  }): OrderItem {
    // Validate
    if (!props.productName.trim()) {
      throw new Error('Product name is required');
    }

    if (!props.productSku.trim()) {
      throw new Error('Product SKU is required');
    }

    const discount = props.discount ?? Money.zero(props.unitPrice.currency);

    // Ensure discount doesn't exceed total
    if (discount.isGreaterThan(props.unitPrice.multiply(props.quantity.value))) {
      throw new Error('Discount cannot exceed total price');
    }

    const now = new Date();

    return new OrderItem({
      productId: props.productId,
      productName: props.productName.trim(),
      productSku: props.productSku.trim(),
      unitPrice: props.unitPrice,
      quantity: props.quantity,
      discount,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Creates an OrderItem from existing data (for reconstitution from persistence)
   */
  public static fromPersistence(props: {
    id: string;
    productId: string;
    productName: string;
    productSku: string;
    unitPrice: number;
    currency: string;
    quantity: number;
    discount: number;
    createdAt: Date;
    updatedAt: Date;
  }): OrderItem {
    return new OrderItem(
      {
        productId: UniqueEntityID.from(props.productId),
        productName: props.productName,
        productSku: props.productSku,
        unitPrice: Money.from(props.unitPrice, props.currency),
        quantity: Quantity.from(props.quantity),
        discount: Money.from(props.discount, props.currency),
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      UniqueEntityID.from(props.id)
    );
  }

  /**
   * Updates the quantity
   */
  public updateQuantity(quantity: Quantity): void {
    this.props.quantity = quantity;
    this.props.updatedAt = new Date();
  }

  /**
   * Applies a discount
   */
  public applyDiscount(discount: Money): void {
    if (discount.currency !== this.props.unitPrice.currency) {
      throw new Error('Discount currency must match item currency');
    }

    if (discount.isGreaterThan(this.grossTotal)) {
      throw new Error('Discount cannot exceed total price');
    }

    this.props.discount = discount;
    this.props.updatedAt = new Date();
  }

  /**
   * Converts to a plain object for serialization
   */
  public toPrimitives(): {
    id: string;
    productId: string;
    productName: string;
    productSku: string;
    unitPrice: number;
    currency: string;
    quantity: number;
    discount: number;
    subtotal: number;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.id.value,
      productId: this.productId.value,
      productName: this.productName,
      productSku: this.productSku,
      unitPrice: this.unitPrice.amount,
      currency: this.unitPrice.currency,
      quantity: this.quantity.value,
      discount: this.discount.amount,
      subtotal: this.subtotal.amount,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
