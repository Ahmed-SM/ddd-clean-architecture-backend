/**
 * @fileoverview Error Handler Middleware
 * @description Centralized error handling for API routes
 */

import { NextResponse } from 'next/server';
import { ApplicationError } from '../../shared/errors/application-error';
import { error } from '../responses';

/**
 * Wraps an API handler with error handling
 */
export function withErrorHandler<T>(
  handler: () => Promise<NextResponse<T>>
): Promise<NextResponse<T | ReturnType<typeof error>>> {
  return handler().catch((err) => {
    console.error('API Error:', err);

    if (err instanceof ApplicationError) {
      return error(err);
    }

    return error(
      new ApplicationError(
        err instanceof Error ? err.message : 'Internal server error',
        'INTERNAL_ERROR',
        500
      )
    );
  });
}

/**
 * Async handler wrapper with error handling
 */
export function asyncHandler(
  handler: (request: Request, context?: { params: Promise<Record<string, string>> }) => Promise<NextResponse>
) {
  return async (request: Request, context?: { params: Promise<Record<string, string>> }) => {
    try {
      return await handler(request, context);
    } catch (err) {
      console.error('API Error:', err);

      if (err instanceof ApplicationError) {
        return error(err);
      }

      return error(
        new ApplicationError(
          err instanceof Error ? err.message : 'Internal server error',
          'INTERNAL_ERROR',
          500
        )
      );
    }
  };
}
