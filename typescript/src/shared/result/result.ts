/**
 * @fileoverview Result Pattern for Functional Error Handling
 * @description Provides a type-safe way to handle operations that can fail
 */

/**
 * Result type for operations that can succeed or fail
 * @template T - The success value type
 * @template E - The error type (defaults to Error)
 */
export type Result<T, E = Error> = Success<T, E> | Failure<T, E>;

/**
 * Success case of a Result
 */
export class Success<T, E> {
  readonly isSuccess = true;
  readonly isFailure = false;

  constructor(readonly value: T) {}

  /**
   * Gets the success value
   */
  getValue(): T {
    return this.value;
  }

  /**
   * Gets the error (throws for success)
   */
  getError(): E {
    throw new Error('Cannot get error from a success result');
  }

  /**
   * Maps the success value to a new type
   */
  map<U>(fn: (value: T) => U): Result<U, E> {
    return ResultUtils.ok(fn(this.value));
  }

  /**
   * Maps the error to a new type (no-op for success)
   */
  mapError<F>(_fn: (error: E) => F): Result<T, F> {
    return ResultUtils.ok<T, F>(this.value);
  }

  /**
   * Flat maps the success value
   */
  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return fn(this.value);
  }

  /**
   * Executes a function for the success case
   */
  onSuccess(fn: (value: T) => void): Result<T, E> {
    fn(this.value);
    return this;
  }

  /**
   * Executes a function for the failure case (no-op for success)
   */
  onFailure(_fn: (error: E) => void): Result<T, E> {
    return this;
  }

  /**
   * Folds over the result to produce a value
   */
  fold<U>(onSuccess: (value: T) => U, _onFailure: (error: E) => U): U {
    return onSuccess(this.value);
  }

  /**
   * Gets the value or a default
   */
  getOrElse(_defaultValue: T): T {
    return this.value;
  }

  /**
   * Gets the value or throws the error
   */
  getOrThrow(): T {
    return this.value;
  }
}

/**
 * Failure case of a Result
 */
export class Failure<T, E> {
  readonly isSuccess = false;
  readonly isFailure = true;

  constructor(readonly error: E) {}

  /**
   * Gets the success value (throws for failure)
   */
  getValue(): T {
    throw new Error('Cannot get value from a failure result');
  }

  /**
   * Gets the error
   */
  getError(): E {
    return this.error;
  }

  /**
   * Maps the success value (no-op for failure)
   */
  map<U>(_fn: (value: T) => U): Result<U, E> {
    return ResultUtils.fail<U, E>(this.error);
  }

  /**
   * Maps the error to a new type
   */
  mapError<F>(fn: (error: E) => F): Result<T, F> {
    return ResultUtils.fail<T, F>(fn(this.error));
  }

  /**
   * Flat maps the success value (no-op for failure)
   */
  flatMap<U>(_fn: (value: T) => Result<U, E>): Result<U, E> {
    return ResultUtils.fail<U, E>(this.error);
  }

  /**
   * Executes a function for the success case (no-op for failure)
   */
  onSuccess(_fn: (value: T) => void): Result<T, E> {
    return this;
  }

  /**
   * Executes a function for the failure case
   */
  onFailure(fn: (error: E) => void): Result<T, E> {
    fn(this.error);
    return this;
  }

  /**
   * Folds over the result to produce a value
   */
  fold<U>(_onSuccess: (value: T) => U, onFailure: (error: E) => U): U {
    return onFailure(this.error);
  }

  /**
   * Gets the value or a default
   */
  getOrElse(defaultValue: T): T {
    return defaultValue;
  }

  /**
   * Gets the value or throws the error
   */
  getOrThrow(): T {
    if (this.error instanceof Error) {
      throw this.error;
    }
    throw new Error(String(this.error));
  }
}

/**
 * Result utility class with factory methods
 */
export class ResultUtils {
  /**
   * Creates a successful result
   */
  static ok<T, E = Error>(value: T): Result<T, E> {
    return new Success<T, E>(value);
  }

  /**
   * Creates a failed result
   */
  static fail<T, E = Error>(error: E): Result<T, E> {
    return new Failure<T, E>(error);
  }

  /**
   * Creates a result from a function that may throw
   */
  static tryCatch<T>(fn: () => T): Result<T, Error> {
    try {
      return ResultUtils.ok(fn());
    } catch (error) {
      return ResultUtils.fail(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Creates a result from an async function that may throw
   */
  static async tryAsync<T>(fn: () => Promise<T>): Promise<Result<T, Error>> {
    try {
      return ResultUtils.ok(await fn());
    } catch (error) {
      return ResultUtils.fail(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Combines multiple results into one
   */
  static combine<T, E = Error>(results: Result<T, E>[]): Result<T[], E> {
    const values: T[] = [];
    for (const result of results) {
      if (result.isFailure) {
        return ResultUtils.fail(result.getError());
      }
      values.push(result.getValue());
    }
    return ResultUtils.ok(values);
  }
}

// Export convenience object with factory methods
export const Result = ResultUtils;
