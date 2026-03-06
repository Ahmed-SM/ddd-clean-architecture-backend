/**
 * @fileoverview Create Order Use Case
 * @description Application service for creating new orders
 */

import { Result, NotFoundError, ValidationError, BusinessRuleError } from '../../shared';
import { Order, OrderItem, Product, Customer } from '../../domain';
import { IOrderRepository, IProductRepository, ICustomerRepository } from '../../domain/repositories';
import { IEventBus, ICacheService } from '../ports';
import { CreateOrderDTO, OrderResponseDTO } from '../dto';
import { UniqueEntityID } from '../../domain/common/unique-entity-id';
import { Money, Address, Quantity } from '../../domain/value-objects';

/**
 * Create Order Use Case Input
 */
export interface CreateOrderInput {
  dto: CreateOrderDTO;
  userId?: string;
}

/**
 * Create Order Use Case Output
 */
export interface CreateOrderOutput {
  order: OrderResponseDTO;
}

/**
 * Create Order Use Case
 * 
 * Orchestrates the creation of a new order:
 * 1. Validates customer exists
 * 2. Validates and retrieves products
 * 3. Checks stock availability
 * 4. Creates order with domain rules
 * 5. Persists order
 * 6. Publishes domain events
 * 7. Invalidates relevant caches
 */
export class CreateOrderUseCase {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly productRepository: IProductRepository,
    private readonly customerRepository: ICustomerRepository,
    private readonly eventBus: IEventBus,
    private readonly cacheService: ICacheService
  ) {}

  async execute(input: CreateOrderInput): Promise<Result<CreateOrderOutput>> {
    try {
      const { dto } = input;

      // 1. Find and validate customer
      const customerId = UniqueEntityID.from(dto.customerId);
      const customer = await this.customerRepository.findById(customerId);

      if (!customer) {
        return Result.fail(new NotFoundError('Customer', dto.customerId));
      }

      if (!customer.isActive) {
        return Result.fail(new BusinessRuleError(
          'Cannot create order for inactive customer',
          'CUSTOMER_INACTIVE'
        ));
      }

      // 2. Collect product IDs
      const productIds = dto.items.map(item => UniqueEntityID.from(item.productId));
      const products = await this.productRepository.findByIds(productIds);

      // 3. Validate all products exist and are available
      const productMap = new Map(products.map(p => [p.id.value, p]));
      const errors: Array<{ field: string; message: string }> = [];

      for (const item of dto.items) {
        const product = productMap.get(item.productId);
        if (!product) {
          errors.push({ field: 'items', message: `Product not found: ${item.productId}` });
          continue;
        }

        if (!product.isActive) {
          errors.push({ field: 'items', message: `Product is not available: ${product.name}` });
        }

        const requestedQuantity = Quantity.from(item.quantity);
        if (!product.isAvailable(requestedQuantity)) {
          errors.push({
            field: 'items',
            message: `Insufficient stock for ${product.name}. Available: ${product.stock.value}`,
          });
        }
      }

      if (errors.length > 0) {
        return Result.fail(new ValidationError('Invalid order items', errors));
      }

      // 4. Create order items
      const orderItems: OrderItem[] = dto.items.map(item => {
        const product = productMap.get(item.productId)!;
        return OrderItem.create({
          productId: product.id,
          productName: product.name,
          productSku: product.sku.value,
          unitPrice: product.price,
          quantity: Quantity.from(item.quantity),
        });
      });

      // 5. Create shipping address
      const shippingAddress = Address.create({
        street: dto.shippingAddress.street,
        apartment: dto.shippingAddress.apartment,
        city: dto.shippingAddress.city,
        state: dto.shippingAddress.state,
        zipCode: dto.shippingAddress.zipCode,
        country: dto.shippingAddress.country,
        instructions: dto.shippingAddress.instructions,
      });

      // 6. Create billing address if provided
      const billingAddress = dto.billingAddress
        ? Address.create({
            street: dto.billingAddress.street,
            apartment: dto.billingAddress.apartment,
            city: dto.billingAddress.city,
            state: dto.billingAddress.state,
            zipCode: dto.billingAddress.zipCode,
            country: dto.billingAddress.country,
          })
        : undefined;

      // 7. Create order
      const order = Order.create({
        customerId,
        items: orderItems,
        shippingAddress,
        billingAddress,
        notes: dto.notes,
      });

      // 8. Reserve stock for products
      for (const item of dto.items) {
        const product = productMap.get(item.productId)!;
        product.reserveStock(Quantity.from(item.quantity));
        await this.productRepository.save(product);
      }

      // 9. Persist order
      await this.orderRepository.save(order);

      // 10. Publish domain events
      await this.eventBus.publishAll([...order.domainEvents]);
      order.clearDomainEvents();

      // 11. Invalidate caches
      await this.cacheService.invalidateEntity('customer', dto.customerId);
      await this.cacheService.deletePattern('orders:*');

      // 12. Return response
      return Result.ok({
        order: this.toResponseDTO(order),
      });
    } catch (error) {
      return Result.fail(
        error instanceof Error ? error : new Error('Unknown error creating order')
      );
    }
  }

  /**
   * Maps order entity to response DTO
   */
  private toResponseDTO(order: Order): OrderResponseDTO {
    return {
      id: order.id.value,
      customerId: order.customerId.value,
      items: order.items.map(item => ({
        id: item.id.value,
        productId: item.productId.value,
        productName: item.productName,
        productSku: item.productSku,
        quantity: item.quantity.value,
        unitPrice: item.unitPrice.amount,
        discount: item.discount.amount,
        subtotal: item.subtotal.amount,
      })),
      status: order.status.value,
      statusLabel: order.status.label,
      totalAmount: order.totalAmount.amount,
      currency: order.totalAmount.currency,
      shippingAddress: {
        street: order.shippingAddress.street,
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
        zipCode: order.shippingAddress.zipCode,
        country: order.shippingAddress.country,
        formatted: order.shippingAddress.formatted,
      },
      billingAddress: order.billingAddress
        ? {
            street: order.billingAddress.street,
            city: order.billingAddress.city,
            state: order.billingAddress.state,
            zipCode: order.billingAddress.zipCode,
            country: order.billingAddress.country,
            formatted: order.billingAddress.formatted,
          }
        : null,
      notes: order.notes,
      itemCount: order.itemCount,
      totalQuantity: order.totalQuantity,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }
}
