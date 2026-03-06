/**
 * @fileoverview Update Order Status Use Case
 * @description Application service for updating order status
 */

import { Result, NotFoundError, BusinessRuleError, ValidationError } from '../../shared';
import { Order, OrderStatus } from '../../domain';
import { IOrderRepository } from '../../domain/repositories';
import { IEventBus, ICacheService } from '../ports';
import { UpdateOrderStatusDTO, OrderResponseDTO } from '../dto';
import { UniqueEntityID } from '../../domain/common/unique-entity-id';

/**
 * Update Order Status Use Case Input
 */
export interface UpdateOrderStatusInput {
  orderId: string;
  dto: UpdateOrderStatusDTO;
  userId?: string;
}

/**
 * Update Order Status Use Case Output
 */
export interface UpdateOrderStatusOutput {
  order: OrderResponseDTO;
}

/**
 * Update Order Status Use Case
 * 
 * Handles order status transitions with proper validation.
 */
export class UpdateOrderStatusUseCase {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly eventBus: IEventBus,
    private readonly cacheService: ICacheService
  ) {}

  async execute(input: UpdateOrderStatusInput): Promise<Result<UpdateOrderStatusOutput>> {
    try {
      const { orderId, dto } = input;

      // Find order
      const id = UniqueEntityID.from(orderId);
      const order = await this.orderRepository.findByIdWithItems(id);

      if (!order) {
        return Result.fail(new NotFoundError('Order', orderId));
      }

      // Validate status transition
      const newStatus = OrderStatus.from(dto.status);
      if (!order.status.canTransitionTo(dto.status)) {
        return Result.fail(new BusinessRuleError(
          `Cannot transition order from '${order.status.value}' to '${dto.status}'`,
          'INVALID_STATUS_TRANSITION'
        ));
      }

      // Apply status change
      switch (dto.status) {
        case 'confirmed':
          order.confirm();
          break;
        case 'processing':
          order.startProcessing();
          break;
        case 'shipped':
          order.ship();
          break;
        case 'delivered':
          order.deliver();
          break;
        case 'cancelled':
          if (!dto.reason) {
            return Result.fail(new ValidationError('Reason is required for cancellation', [
              { field: 'reason', message: 'Reason is required' },
            ]));
          }
          order.cancel(dto.reason);
          break;
        case 'refunded':
          if (!dto.reason) {
            return Result.fail(new ValidationError('Reason is required for refund', [
              { field: 'reason', message: 'Reason is required' },
            ]));
          }
          order.refund(dto.reason);
          break;
      }

      // Persist changes
      await this.orderRepository.save(order);

      // Publish domain events
      await this.eventBus.publishAll([...order.domainEvents]);
      order.clearDomainEvents();

      // Invalidate caches
      await this.cacheService.delete(`order:${orderId}`);
      await this.cacheService.invalidateEntity('customer', order.customerId.value);

      return Result.ok({
        order: this.toResponseDTO(order),
      });
    } catch (error) {
      return Result.fail(
        error instanceof Error ? error : new Error('Unknown error updating order status')
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
