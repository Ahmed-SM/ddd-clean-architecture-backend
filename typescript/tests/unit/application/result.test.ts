/**
 * @fileoverview Result Pattern Tests
 */

import { describe, it, expect } from 'bun:test';
import { Result } from '../../../src/shared/result/result';

describe('Result Pattern', () => {
  describe('success result', () => {
    it('should create a successful result', () => {
      const result = Result.ok(42);
      expect(result.isSuccess).toBe(true);
      expect(result.isFailure).toBe(false);
      expect(result.getValue()).toBe(42);
    });

    it('should map a success value', () => {
      const result = Result.ok(5);
      const mapped = result.map(x => x * 2);
      expect(mapped.getValue()).toBe(10);
    });

    it('should flatMap a success value', () => {
      const result = Result.ok(5);
      const mapped = result.flatMap(x => Result.ok(x * 2));
      expect(mapped.getValue()).toBe(10);
    });

    it('should execute onSuccess callback', () => {
      let called = false;
      Result.ok(42).onSuccess(() => (called = true));
      expect(called).toBe(true);
    });

    it('should not execute onFailure callback', () => {
      let called = false;
      Result.ok(42).onFailure(() => (called = true));
      expect(called).toBe(false);
    });

    it('should fold to success case', () => {
      const result = Result.ok(42);
      const value = result.fold(
        x => x * 2,
        () => 0
      );
      expect(value).toBe(84);
    });

    it('should get value or default', () => {
      const result = Result.ok(42);
      expect(result.getOrElse(0)).toBe(42);
    });
  });

  describe('failure result', () => {
    it('should create a failed result', () => {
      const error = new Error('Something went wrong');
      const result = Result.fail<number>(error);
      expect(result.isSuccess).toBe(false);
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBe(error);
    });

    it('should throw when getting value from failure', () => {
      const result = Result.fail<number>(new Error('Failed'));
      expect(() => result.getValue()).toThrow('Cannot get value from a failure result');
    });

    it('should map error', () => {
      const result = Result.fail<number, string>('original');
      const mapped = result.mapError(e => e.toUpperCase());
      expect(mapped.getError()).toBe('ORIGINAL');
    });

    it('should not execute onSuccess callback', () => {
      let called = false;
      Result.fail<number>(new Error()).onSuccess(() => (called = true));
      expect(called).toBe(false);
    });

    it('should execute onFailure callback', () => {
      let captured: Error | null = null;
      const error = new Error('test');
      Result.fail<number>(error).onFailure(e => (captured = e));
      expect(captured).toBe(error);
    });

    it('should fold to failure case', () => {
      const result = Result.fail<number>(new Error('error'));
      const value = result.fold(
        () => 1,
        () => 0
      );
      expect(value).toBe(0);
    });

    it('should get default value', () => {
      const result = Result.fail<number>(new Error());
      expect(result.getOrElse(42)).toBe(42);
    });

    it('should throw on getOrThrow', () => {
      const result = Result.fail<number>(new Error('test error'));
      expect(() => result.getOrThrow()).toThrow('test error');
    });
  });

  describe('tryCatch', () => {
    it('should return success for successful function', () => {
      const result = Result.tryCatch(() => 42);
      expect(result.isSuccess).toBe(true);
      expect(result.getValue()).toBe(42);
    });

    it('should return failure for throwing function', () => {
      const result = Result.tryCatch(() => {
        throw new Error('oops');
      });
      expect(result.isFailure).toBe(true);
      expect(result.getError().message).toBe('oops');
    });
  });

  describe('combine', () => {
    it('should combine multiple successes', () => {
      const results = [Result.ok(1), Result.ok(2), Result.ok(3)];
      const combined = Result.combine(results);
      expect(combined.isSuccess).toBe(true);
      expect(combined.getValue()).toEqual([1, 2, 3]);
    });

    it('should return first failure', () => {
      const error = new Error('failed');
      const results = [Result.ok(1), Result.fail(error), Result.ok(3)];
      const combined = Result.combine(results);
      expect(combined.isFailure).toBe(true);
      expect(combined.getError()).toBe(error);
    });
  });
});
