/**
 * @fileoverview Money Value Object Tests
 */

import { describe, it, expect } from 'bun:test';
import { Money } from '../../../src/domain/value-objects';

describe('Money Value Object', () => {
  describe('creation', () => {
    it('should create a money object with valid amount and currency', () => {
      const money = Money.from(100, 'USD');
      expect(money.amount).toBe(100);
      expect(money.currency).toBe('USD');
    });

    it('should round to appropriate decimal places', () => {
      const money = Money.from(99.999, 'USD');
      expect(money.amount).toBe(100);
    });

    it('should throw for unsupported currency', () => {
      expect(() => Money.from(100, 'XYZ')).toThrow('Unsupported currency');
    });

    it('should create zero money', () => {
      const zero = Money.zero('USD');
      expect(zero.amount).toBe(0);
      expect(zero.isZero()).toBe(true);
    });
  });

  describe('arithmetic operations', () => {
    it('should add two money objects of the same currency', () => {
      const m1 = Money.from(50, 'USD');
      const m2 = Money.from(30, 'USD');
      const result = m1.add(m2);
      expect(result.amount).toBe(80);
    });

    it('should throw when adding different currencies', () => {
      const usd = Money.from(100, 'USD');
      const eur = Money.from(100, 'EUR');
      expect(() => usd.add(eur)).toThrow('Cannot add different currencies');
    });

    it('should subtract two money objects', () => {
      const m1 = Money.from(100, 'USD');
      const m2 = Money.from(30, 'USD');
      const result = m1.subtract(m2);
      expect(result.amount).toBe(70);
    });

    it('should multiply by a factor', () => {
      const money = Money.from(100, 'USD');
      const result = money.multiply(1.5);
      expect(result.amount).toBe(150);
    });

    it('should calculate percentage', () => {
      const money = Money.from(100, 'USD');
      const result = money.percentage(10);
      expect(result.amount).toBe(10);
    });
  });

  describe('comparison', () => {
    it('should compare amounts correctly', () => {
      const m1 = Money.from(100, 'USD');
      const m2 = Money.from(50, 'USD');
      expect(m1.isGreaterThan(m2)).toBe(true);
      expect(m2.isLessThan(m1)).toBe(true);
    });

    it('should check if positive or negative', () => {
      const positive = Money.from(100, 'USD');
      const zero = Money.zero('USD');
      
      expect(positive.isPositive()).toBe(true);
      expect(zero.isZero()).toBe(true);
    });
  });

  describe('formatting', () => {
    it('should format money correctly', () => {
      const money = Money.from(1234.56, 'USD');
      expect(money.format()).toBe('$1,234.56');
    });

    it('should convert to minor units (cents)', () => {
      const money = Money.from(10.50, 'USD');
      expect(money.toMinor()).toBe(1050);
    });
  });

  describe('immutability', () => {
    it('should be immutable', () => {
      const money1 = Money.from(100, 'USD');
      const money2 = money1.add(Money.from(50, 'USD'));
      
      // Original should be unchanged
      expect(money1.amount).toBe(100);
      expect(money2.amount).toBe(150);
    });
  });
});
