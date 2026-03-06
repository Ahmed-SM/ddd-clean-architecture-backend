/**
 * @fileoverview Orders API Routes
 * @description RESTful API endpoints for order management
 * 
 * GET /api/v1/orders - List orders with pagination
 * POST /api/v1/orders - Create a new order
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getContainer, TYPES } from '../../../infrastructure';
import { ListOrdersUseCase, CreateOrderUseCase } from '../../../application/use-cases';
import { CreateOrderDTOSchema, OrderListQueryDTOSchema } from '../../../application/dto';
import { success, created, paginated, error } from '../../responses';
import { asyncHandler, validateBody, validateQuery } from '../../middleware';

/**
 * GET /api/v1/orders
 * List orders with pagination and filtering
 */
export const GET = asyncHandler(async (request: NextRequest) => {
  // Validate query parameters
  const queryResult = validateQuery(request, OrderListQueryDTOSchema);
  if (!queryResult.success) {
    return queryResult.error;
  }

  // Execute use case
  const container = getContainer();
  const listOrdersUseCase = container.get<ListOrdersUseCase>(TYPES.ListOrdersUseCase);

  const result = await listOrdersUseCase.execute({
    query: queryResult.data,
  });

  if (result.isFailure) {
    return error(result.getError());
  }

  const { result: response } = result.getValue();
  return paginated(response.data, response.pagination);
});

/**
 * POST /api/v1/orders
 * Create a new order
 */
export const POST = asyncHandler(async (request: NextRequest) => {
  // Validate request body
  const bodyResult = await validateBody(request, CreateOrderDTOSchema);
  if (!bodyResult.success) {
    return bodyResult.error;
  }

  // Execute use case
  const container = getContainer();
  const createOrderUseCase = container.get<CreateOrderUseCase>(TYPES.CreateOrderUseCase);

  const result = await createOrderUseCase.execute({
    dto: bodyResult.data,
  });

  if (result.isFailure) {
    return error(result.getError());
  }

  const { order } = result.getValue();
  return created(order);
});
