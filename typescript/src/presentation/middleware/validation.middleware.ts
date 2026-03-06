/**
 * @fileoverview Validation Middleware
 * @description Request validation using Zod schemas
 */

import { NextRequest } from 'next/server';
import { ZodSchema, ZodError } from 'zod';
import { validationError } from '../responses';

/**
 * Validates request body against a Zod schema
 */
export async function validateBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: ReturnType<typeof validationError> }> {
  try {
    const body = await request.json();
    const data = schema.parse(body);
    return { success: true, data };
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return { success: false, error: validationError(errors) };
    }
    throw err;
  }
}

/**
 * Validates query parameters against a Zod schema
 */
export function validateQuery<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): { success: true; data: T } | { success: false; error: ReturnType<typeof validationError> } {
  try {
    const { searchParams } = new URL(request.url);
    const queryObj = Object.fromEntries(searchParams.entries());
    const data = schema.parse(queryObj);
    return { success: true, data };
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return { success: false, error: validationError(errors) };
    }
    throw err;
  }
}

/**
 * Validates path parameters
 */
export function validateParams<T>(
  params: Record<string, string>,
  schema: ZodSchema<T>
): { success: true; data: T } | { success: false; error: ReturnType<typeof validationError> } {
  try {
    const data = schema.parse(params);
    return { success: true, data };
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return { success: false, error: validationError(errors) };
    }
    throw err;
  }
}
