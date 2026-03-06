/**
 * @fileoverview Order Status Value Object Tests
 */

import { describe, it, expect } from 'bun:test';
import { OrderStatus } from '../../../src/domain/value-objects';

describe('OrderStatus Value Object', () => {
  describe('factory methods', () => {
    it('should create pending status', () => {
      const status = OrderStatus.pending();
      expect(status.value).toBe('pending');
      expect(status.label).toBe('Pending');
      expect(status.isFinal()).toBe(false);
    });

    it('should create confirmed status', () => {
      const status = OrderStatus.confirmed();
      expect(status.value).toBe('confirmed');
    });

    it('should create delivered status', () => {
      const status = OrderStatus.delivered();
      expect(status.value).toBe('delivered');
      // delivered can transition to refunded, so it's not final
      expect(status.isFinal()).toBe(false);
    });

    it('should create cancelled status', () => {
      const status = OrderStatus.cancelled();
      expect(status.value).toBe('cancelled');
      expect(status.isFinal()).toBe(true);
    });
  });

  describe('transitions', () => {
    it('should allow pending to confirmed transition', () => {
      const pending = OrderStatus.pending();
      expect(pending.canTransitionTo('confirmed')).toBe(true);
      expect(pending.canTransitionTo('cancelled')).toBe(true);
      expect(pending.canTransitionTo('shipped')).toBe(false);
    });

    it('should allow confirmed to processing transition', () => {
      const confirmed = OrderStatus.confirmed();
      expect(confirmed.canTransitionTo('processing')).toBe(true);
      expect(confirmed.canTransitionTo('cancelled')).toBe(true);
    });

    it('should not allow transitions from cancelled', () => {
      const cancelled = OrderStatus.cancelled();
      expect(cancelled.getPossibleTransitions()).toEqual([]);
      expect(cancelled.isFinal()).toBe(true);
    });

    it('should allow delivered to refunded transition', () => {
      const delivered = OrderStatus.delivered();
      expect(delivered.canTransitionTo('refunded')).toBe(true);
    });
  });

  describe('status checks', () => {
    it('should identify cancellable status', () => {
      expect(OrderStatus.pending().isCancellable()).toBe(true);
      expect(OrderStatus.confirmed().isCancellable()).toBe(true);
      expect(OrderStatus.delivered().isCancellable()).toBe(false);
    });

    it('should identify active status', () => {
      expect(OrderStatus.pending().isActive()).toBe(true);
      expect(OrderStatus.cancelled().isActive()).toBe(false);
      expect(OrderStatus.refunded().isActive()).toBe(false);
    });

    it('should identify paid status', () => {
      expect(OrderStatus.pending().isPaid()).toBe(false);
      expect(OrderStatus.confirmed().isPaid()).toBe(true);
      expect(OrderStatus.shipped().isPaid()).toBe(true);
    });

    it('should identify shipped status', () => {
      expect(OrderStatus.shipped().isShipped()).toBe(true);
      expect(OrderStatus.delivered().isShipped()).toBe(true);
      expect(OrderStatus.pending().isShipped()).toBe(false);
    });
  });

  describe('from string', () => {
    it('should create status from valid string', () => {
      const status = OrderStatus.from('pending');
      expect(status.value).toBe('pending');
    });

    it('should throw for invalid status string', () => {
      expect(() => OrderStatus.from('invalid')).toThrow('Invalid order status');
    });
  });
});
