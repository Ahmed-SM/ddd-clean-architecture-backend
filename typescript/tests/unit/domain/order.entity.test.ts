/**
 * @fileoverview Order Entity Tests
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { Order, OrderItem } from '../../../src/domain/entities';
import { UniqueEntityID } from '../../../src/domain/common/unique-entity-id';
import { Money, Address, Quantity } from '../../../src/domain/value-objects';

describe('Order Entity', () => {
  let customerId: UniqueEntityID;
  let shippingAddress: Address;
  let orderItem: OrderItem;

  beforeEach(() => {
    customerId = UniqueEntityID.generate();
    shippingAddress = Address.create({
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'US',
    });
    orderItem = OrderItem.create({
      productId: UniqueEntityID.generate(),
      productName: 'Test Product',
      productSku: 'TEST-PROD-001',
      unitPrice: Money.from(29.99, 'USD'),
      quantity: Quantity.from(2),
    });
  });

  describe('creation', () => {
    it('should create an order with valid data', () => {
      const order = Order.create({
        customerId,
        items: [orderItem],
        shippingAddress,
      });

      expect(order.customerId.equals(customerId)).toBe(true);
      expect(order.items.length).toBe(1);
      expect(order.status.value).toBe('pending');
      expect(order.totalAmount.amount).toBe(59.98);
    });

    it('should emit OrderCreatedEvent on creation', () => {
      const order = Order.create({
        customerId,
        items: [orderItem],
        shippingAddress,
      });

      expect(order.domainEvents.length).toBe(1);
      expect(order.domainEvents[0].eventType).toBe('order.created');
    });

    it('should throw when creating order without items', () => {
      expect(() =>
        Order.create({
          customerId,
          items: [],
          shippingAddress,
        })
      ).toThrow('Order must have at least one item');
    });
  });

  describe('item management', () => {
    it('should add item to pending order', () => {
      const order = Order.create({
        customerId,
        items: [orderItem],
        shippingAddress,
      });

      const newItem = OrderItem.create({
        productId: UniqueEntityID.generate(),
        productName: 'Another Product',
        productSku: 'TEST-PROD-002',
        unitPrice: Money.from(19.99, 'USD'),
        quantity: Quantity.from(1),
      });

      order.addItem(newItem);
      expect(order.items.length).toBe(2);
    });

    it('should not add item to confirmed order', () => {
      const order = Order.create({
        customerId,
        items: [orderItem],
        shippingAddress,
      });

      order.confirm();

      const newItem = OrderItem.create({
        productId: UniqueEntityID.generate(),
        productName: 'Another Product',
        productSku: 'TEST-PROD-002',
        unitPrice: Money.from(19.99, 'USD'),
        quantity: Quantity.from(1),
      });

      expect(() => order.addItem(newItem)).toThrow();
    });
  });

  describe('status transitions', () => {
    it('should confirm a pending order', () => {
      const order = Order.create({
        customerId,
        items: [orderItem],
        shippingAddress,
      });

      order.confirm();
      expect(order.status.value).toBe('confirmed');
      expect(order.domainEvents.length).toBe(2); // Created + StatusChanged
    });

    it('should not confirm an already confirmed order', () => {
      const order = Order.create({
        customerId,
        items: [orderItem],
        shippingAddress,
      });

      order.confirm();
      expect(() => order.confirm()).toThrow();
    });

    it('should ship a processing order', () => {
      const order = Order.create({
        customerId,
        items: [orderItem],
        shippingAddress,
      });

      order.confirm();
      order.startProcessing();
      order.ship();

      expect(order.status.value).toBe('shipped');
    });

    it('should cancel a pending order', () => {
      const order = Order.create({
        customerId,
        items: [orderItem],
        shippingAddress,
      });

      order.cancel('Customer requested');
      expect(order.status.value).toBe('cancelled');
      expect(order.notes).toContain('Customer requested');
    });

    it('should not cancel a delivered order', () => {
      const order = Order.create({
        customerId,
        items: [orderItem],
        shippingAddress,
      });

      order.confirm();
      order.startProcessing();
      order.ship();
      order.deliver();

      expect(() => order.cancel('Too late')).toThrow();
    });
  });

  describe('business rules', () => {
    it('should identify modifiable orders', () => {
      const order = Order.create({
        customerId,
        items: [orderItem],
        shippingAddress,
      });

      expect(order.canBeModified()).toBe(true);
      order.confirm();
      expect(order.canBeModified()).toBe(false);
    });

    it('should require payment for pending orders', () => {
      const order = Order.create({
        customerId,
        items: [orderItem],
        shippingAddress,
      });

      expect(order.requiresPayment()).toBe(true);
      order.confirm();
      expect(order.requiresPayment()).toBe(false);
    });
  });
});
