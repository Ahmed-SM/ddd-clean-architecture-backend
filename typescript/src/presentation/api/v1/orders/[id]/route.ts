/**
 * @fileoverview Single Order API Routes
 * @description RESTful API endpoints for single order operations
 * 
 * GET /api/v1/orders/:id - Get order by ID
 * PUT /api/v1/orders/:id/status - Update order status
 * DELETE /api/v1/orders/:id - Cancel order
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getContainer, TYPES } from '../../../../infrastructure';
import { GetOrderUseCase, UpdateOrderStatusUseCase } from '../../../../application/use-cases';
import { UpdateOrderStatusDTOSchema } from '../../../../application/dto';
import { success, error, notFound } from '../../../responses';
import { asyncHandler, validateBody, validateParams } from '../../../middleware';

/**
 * Path parameters schema
 */
const ParamsSchema = z.object({
  id: z.string().min(1, 'Order ID is required'),
});

/**
 * GET /api/v1/orders/:id
 * Get order by ID
 */
export const GET = asyncHandler(
  async (request: NextRequest, { params }: { params: Promise<Record<string, string>> }) => {
    const resolvedParams = await params;
    
    // Validate path parameters
    const paramsResult = validateParams(resolvedParams, ParamsSchema);
    if (!paramsResult.success) {
      return paramsResult.error;
    }

    // Execute use case
    const container = getContainer();
    const getOrderUseCase = container.get<GetOrderUseCase>(TYPES.GetOrderUseCase);

    const result = await getOrderUseCase.execute({
      orderId: paramsResult.data.id,
    });

    if (result.isFailure) {
      const err = result.getError();
      if ('code' in err && err.code === 'ENTITY_NOT_FOUND') {
        return notFound('Order');
      }
      return error(err);
    }

    const { order } = result.getValue();
    return success(order);
  }
);

/**
 * PUT /api/v1/orders/:id/status
 * Update order status
 */
export const PUT = asyncHandler(
  async (request: NextRequest, { params }: { params: Promise<Record<string, string>> }) => {
    const resolvedParams = await params;
    
    // Validate path parameters
    const paramsResult = validateParams(resolvedParams, ParamsSchema);
    if (!paramsResult.success) {
      return paramsResult.error;
    }

    // Validate request body
    const bodyResult = await validateBody(request, UpdateOrderStatusDTOSchema);
    if (!bodyResult.success) {
      return bodyResult.error;
    }

    // Execute use case
    const container = getContainer();
    const updateOrderStatusUseCase = container.get<UpdateOrderStatusUseCase>(
      TYPES.UpdateOrderStatusUseCase
    );

    const result = await updateOrderStatusUseCase.execute({
      orderId: paramsResult.data.id,
      dto: bodyResult.data,
    });

    if (result.isFailure) {
      const err = result.getError();
      if ('code' in err && err.code === 'ENTITY_NOT_FOUND') {
        return notFound('Order');
      }
      return error(err);
    }

    const { order } = result.getValue();
    return success(order);
  }
);
