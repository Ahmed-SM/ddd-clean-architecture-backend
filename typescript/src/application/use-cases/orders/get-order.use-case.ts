/**
 * @fileoverview Get Order Use Case
 * @description Application service for retrieving orders
 */

import { Result, NotFoundError } from '../../shared';
import { Order } from '../../domain';
import { IOrderRepository } from '../../domain/repositories';
import { ICacheService } from '../ports';
import { OrderResponseDTO } from '../dto';
import { UniqueEntityID } from '../../domain/common/unique-entity-id';

/**
 * Get Order Use Case Input
 */
export interface GetOrderInput {
  orderId: string;
}

/**
 * Get Order Use Case Output
 */
export interface GetOrderOutput {
  order: OrderResponseDTO;
}

/**
 * Get Order Use Case
 * 
 * Retrieves an order by ID with caching support.
 */
export class GetOrderUseCase {
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly cacheService: ICacheService
  ) {}

  async execute(input: GetOrderInput): Promise<Result<GetOrderOutput>> {
    try {
      const cacheKey = `order:${input.orderId}`;

      // Try to get from cache first
      const cached = await this.cacheService.get<OrderResponseDTO>(cacheKey);
      if (cached) {
        return Result.ok({ order: cached });
      }

      // Find order from repository
      const orderId = UniqueEntityID.from(input.orderId);
      const order = await this.orderRepository.findByIdWithItems(orderId);

      if (!order) {
        return Result.fail(new NotFoundError('Order', input.orderId));
      }

      const responseDTO = this.toResponseDTO(order);

      // Cache the result
      await this.cacheService.set(cacheKey, responseDTO, { ttl: this.CACHE_TTL });

      return Result.ok({ order: responseDTO });
    } catch (error) {
      return Result.fail(
        error instanceof Error ? error : new Error('Unknown error retrieving order')
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
