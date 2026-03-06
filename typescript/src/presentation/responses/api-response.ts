/**
 * @fileoverview API Response Helpers
 * @description Standardized API response formats
 */

import { NextResponse } from 'next/server';
import { ApplicationError } from '../../shared/errors/application-error';

/**
 * API Response metadata
 */
interface ResponseMeta {
  timestamp: string;
  requestId?: string;
}

/**
 * Success response wrapper
 */
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta: ResponseMeta;
}

/**
 * Error response wrapper
 */
interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    details?: Record<string, unknown>;
  };
  meta: ResponseMeta;
}

/**
 * Paginated response wrapper
 */
interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  meta: ResponseMeta;
}

/**
 * Generates response metadata
 */
function getMeta(): ResponseMeta {
  return {
    timestamp: new Date().toISOString(),
  };
}

/**
 * Creates a success response
 */
export function success<T>(data: T, status: number = 200): NextResponse<SuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      meta: getMeta(),
    },
    { status }
  );
}

/**
 * Creates a created response (201)
 */
export function created<T>(data: T): NextResponse<SuccessResponse<T>> {
  return success(data, 201);
}

/**
 * Creates a no content response (204)
 */
export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

/**
 * Creates a paginated response
 */
export function paginated<T>(
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  }
): NextResponse<PaginatedResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    pagination,
    meta: getMeta(),
  });
}

/**
 * Creates an error response
 */
export function error(
  error: ApplicationError | Error,
  status?: number
): NextResponse<ErrorResponse> {
  if (error instanceof ApplicationError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error.message,
          code: error.code,
          details: error.details,
        },
        meta: getMeta(),
      },
      { status: status ?? error.statusCode }
    );
  }

  return NextResponse.json(
    {
      success: false,
      error: {
        message: error.message || 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      meta: getMeta(),
    },
    { status: status ?? 500 }
  );
}

/**
 * Creates a not found response
 */
export function notFound(message: string = 'Resource not found'): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        code: 'NOT_FOUND',
      },
      meta: getMeta(),
    },
    { status: 404 }
  );
}

/**
 * Creates a validation error response
 */
export function validationError(
  errors: Array<{ field: string; message: string }>
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: { errors },
      },
      meta: getMeta(),
    },
    { status: 400 }
  );
}

/**
 * Creates an unauthorized response
 */
export function unauthorized(message: string = 'Unauthorized'): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        code: 'UNAUTHORIZED',
      },
      meta: getMeta(),
    },
    { status: 401 }
  );
}

/**
 * Creates a forbidden response
 */
export function forbidden(message: string = 'Access denied'): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        code: 'FORBIDDEN',
      },
      meta: getMeta(),
    },
    { status: 403 }
  );
}
