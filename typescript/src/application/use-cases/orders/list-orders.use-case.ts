/**
 * @fileoverview List Orders Use Case
 * @description Application service for listing orders with pagination
 */

import { Result } from '../../shared';
import { IOrderRepository, PaginationOptions, OrderFilters } from '../../domain/repositories';
import { ICacheService } from '../ports';
import { OrderListQueryDTO, PaginatedOrdersResponseDTO } from '../dto';

/**
 * List Orders Use Case Input
 */
export interface ListOrdersInput {
  query: OrderListQueryDTO;
}

/**
 * List Orders Use Case Output
 */
export interface ListOrdersOutput {
  result: PaginatedOrdersResponseDTO;
}

/**
 * List Orders Use Case
 * 
 * Retrieves paginated list of orders with filtering support.
 */
export class ListOrdersUseCase {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly cacheService: ICacheService
  ) {}

  async execute(input: ListOrdersInput): Promise<Result<ListOrdersOutput>> {
    try {
      const { query } = input;

      // Build pagination options
      const pagination: PaginationOptions = {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      };

      // Build filters
      const filters: OrderFilters = {};
      if (query.customerId) filters.customerId = query.customerId;
      if (query.status) filters.status = query.status;
      if (query.fromDate) filters.fromDate = new Date(query.fromDate);
      if (query.toDate) filters.toDate = new Date(query.toDate);
      if (query.minAmount !== undefined) filters.minAmount = query.minAmount;
      if (query.maxAmount !== undefined) filters.maxAmount = query.maxAmount;

      // Get paginated results
      const result = await this.orderRepository.findPaginated(pagination, filters);

      // Map to response DTOs
      const response: PaginatedOrdersResponseDTO = {
        data: result.data.map(order => ({
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
        })),
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
          hasMore: result.hasMore,
        },
      };

      return Result.ok({ result: response });
    } catch (error) {
      return Result.fail(
        error instanceof Error ? error : new Error('Unknown error listing orders')
      );
    }
  }
}
