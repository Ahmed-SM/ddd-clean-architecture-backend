/**
 * @fileoverview Application Error Types
 * @description Standardized error types for the application layer
 */

/**
 * Base application error
 */
export abstract class ApplicationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

/**
 * Entity not found error
 */
export class NotFoundError extends ApplicationError {
  constructor(entityName: string, identifier: string | Record<string, unknown>) {
    const details = typeof identifier === 'string' 
      ? { id: identifier } 
      : identifier;
    
    super(
      `${entityName} not found`,
      'ENTITY_NOT_FOUND',
      404,
      { entityName, ...details }
    );
  }
}

/**
 * Validation error
 */
export class ValidationError extends ApplicationError {
  constructor(message: string, errors: Array<{ field: string; message: string }>) {
    super(
      message,
      'VALIDATION_ERROR',
      400,
      { errors }
    );
  }
}

/**
 * Business rule violation error
 */
export class BusinessRuleError extends ApplicationError {
  constructor(message: string, rule: string) {
    super(
      message,
      'BUSINESS_RULE_VIOLATION',
      422,
      { rule }
    );
  }
}

/**
 * Conflict error (duplicate, etc.)
 */
export class ConflictError extends ApplicationError {
  constructor(message: string, resource?: string) {
    super(
      message,
      'CONFLICT',
      409,
      resource ? { resource } : undefined
    );
  }
}

/**
 * Unauthorized error
 */
export class UnauthorizedError extends ApplicationError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

/**
 * Forbidden error
 */
export class ForbiddenError extends ApplicationError {
  constructor(message: string = 'Access denied') {
    super(message, 'FORBIDDEN', 403);
  }
}

/**
 * Internal server error
 */
export class InternalServerError extends ApplicationError {
  constructor(message: string = 'Internal server error', originalError?: Error) {
    super(
      message,
      'INTERNAL_SERVER_ERROR',
      500,
      originalError ? { originalError: originalError.message } : undefined
    );
  }
}

/**
 * Service unavailable error
 */
export class ServiceUnavailableError extends ApplicationError {
  constructor(serviceName: string, reason?: string) {
    super(
      `Service '${serviceName}' is unavailable`,
      'SERVICE_UNAVAILABLE',
      503,
      { serviceName, reason }
    );
  }
}
