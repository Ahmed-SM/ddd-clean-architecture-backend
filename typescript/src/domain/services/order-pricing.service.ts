/**
 * @fileoverview Order Pricing Domain Service
 * @description Calculates order totals, discounts, and taxes
 */

import { Money } from '../value-objects';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';

/**
 * Discount rule interface
 */
export interface DiscountRule {
  type: 'percentage' | 'fixed';
  value: number;
  applicableTo: 'order' | 'item';
  condition?: (order: Order) => boolean;
}

/**
 * Tax rule interface
 */
export interface TaxRule {
  rate: number; // e.g., 0.08 for 8%
  appliesTo: 'all' | 'shipping' | 'items';
  exemptCategories?: string[];
}

/**
 * Pricing calculation result
 */
export interface PricingResult {
  subtotal: Money;
  discount: Money;
  taxableAmount: Money;
  tax: Money;
  shipping: Money;
  total: Money;
  currency: string;
}

/**
 * Order Pricing Domain Service
 * 
 * Encapsulates complex pricing calculations that don't belong
 * to a single entity or value object. This is a domain service
 * because it operates on domain objects and expresses domain rules.
 */
export class OrderPricingService {
  private readonly taxRules: TaxRule[];
  private readonly freeShippingThreshold: Money;

  constructor(
    taxRules: TaxRule[] = [],
    freeShippingThreshold: Money = Money.from(100, 'USD')
  ) {
    this.taxRules = taxRules;
    this.freeShippingThreshold = freeShippingThreshold;
  }

  /**
   * Calculates complete pricing for an order
   * @param order - The order to calculate pricing for
   * @param shippingCost - Base shipping cost
   * @param discountRules - Applicable discount rules
   */
  public calculateOrderPricing(
    order: Order,
    shippingCost: Money,
    discountRules: DiscountRule[] = []
  ): PricingResult {
    const currency = order.totalAmount.currency;

    // Calculate subtotal (sum of item totals)
    const subtotal = order.totalAmount;

    // Calculate discounts
    const discount = this.calculateDiscounts(order, discountRules);

    // Calculate taxable amount (subtotal minus discount)
    const taxableAmount = subtotal.subtract(discount);

    // Calculate tax
    const tax = this.calculateTax(order, taxableAmount);

    // Calculate shipping (free if above threshold)
    const shipping = this.calculateShipping(order, shippingCost);

    // Calculate total
    const total = taxableAmount.add(tax).add(shipping);

    return {
      subtotal,
      discount,
      taxableAmount,
      tax,
      shipping,
      total,
      currency,
    };
  }

  /**
   * Calculates item-level discount
   */
  public calculateItemDiscount(item: OrderItem, rules: DiscountRule[]): Money {
    const applicableRules = rules.filter(
      rule => rule.applicableTo === 'item' && (!rule.condition || rule.condition(null as unknown as Order))
    );

    return applicableRules.reduce((totalDiscount, rule) => {
      const discount = rule.type === 'percentage'
        ? item.subtotal.percentage(rule.value)
        : Money.from(rule.value, item.subtotal.currency);
      
      return totalDiscount.add(discount);
    }, Money.zero(item.subtotal.currency));
  }

  /**
   * Calculates order-level discounts
   */
  private calculateDiscounts(order: Order, rules: DiscountRule[]): Money {
    const orderRules = rules.filter(
      rule => rule.applicableTo === 'order' && (!rule.condition || rule.condition(order))
    );

    return orderRules.reduce((totalDiscount, rule) => {
      const discount = rule.type === 'percentage'
        ? order.totalAmount.percentage(rule.value)
        : Money.from(rule.value, order.totalAmount.currency);
      
      return totalDiscount.add(discount);
    }, Money.zero(order.totalAmount.currency));
  }

  /**
   * Calculates tax based on rules
   */
  private calculateTax(order: Order, taxableAmount: Money): Money {
    const totalRate = this.taxRules
      .filter(rule => rule.appliesTo === 'all' || rule.appliesTo === 'items')
      .reduce((sum, rule) => sum + rule.rate, 0);

    return taxableAmount.multiply(totalRate);
  }

  /**
   * Calculates shipping cost (with free shipping threshold)
   */
  private calculateShipping(order: Order, baseShippingCost: Money): Money {
    // Free shipping if order total exceeds threshold
    if (order.totalAmount.isGreaterThan(this.freeShippingThreshold)) {
      return Money.zero(baseShippingCost.currency);
    }

    return baseShippingCost;
  }

  /**
   * Validates if an order's total matches the calculated total
   */
  public validateOrderTotal(order: Order): boolean {
    const calculatedTotal = order.items.reduce(
      (sum, item) => sum.add(item.subtotal),
      Money.zero(order.totalAmount.currency)
    );

    return order.totalAmount.equals(calculatedTotal);
  }

  /**
   * Calculates refund amount for an order
   */
  public calculateRefundAmount(order: Order): Money {
    // Full refund for undelivered orders
    if (!['delivered', 'refunded'].includes(order.status.value)) {
      return order.totalAmount;
    }

    // For delivered orders, may have restocking fees, etc.
    // This is a simplified implementation
    return order.totalAmount;
  }
}
