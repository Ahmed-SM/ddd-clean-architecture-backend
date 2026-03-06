// Package errors provides application error types
package errors

import (
	"encoding/json"
	"fmt"
	"net/http"
)

// AppError represents an application error
type AppError struct {
	Code       string         `json:"code"`
	Message    string         `json:"message"`
	StatusCode int            `json:"-"`
	Details    map[string]any `json:"details,omitempty"`
}

// Error implements the error interface
func (e *AppError) Error() string {
	return e.Message
}

// JSON returns JSON representation
func (e *AppError) JSON() []byte {
	b, _ := json.Marshal(e)
	return b
}

// NewAppError creates a new application error
func NewAppError(code, message string, statusCode int) *AppError {
	return &AppError{
		Code:       code,
		Message:    message,
		StatusCode: statusCode,
	}
}

// WithDetails adds details to the error
func (e *AppError) WithDetails(details map[string]any) *AppError {
	e.Details = details
	return e
}

// Common errors
var (
	ErrNotFound     = NewAppError("NOT_FOUND", "resource not found", http.StatusNotFound)
	ErrBadRequest   = NewAppError("BAD_REQUEST", "invalid request", http.StatusBadRequest)
	ErrUnauthorized = NewAppError("UNAUTHORIZED", "unauthorized", http.StatusUnauthorized)
	ErrForbidden    = NewAppError("FORBIDDEN", "access denied", http.StatusForbidden)
	ErrConflict     = NewAppError("CONFLICT", "resource conflict", http.StatusConflict)
	ErrInternal     = NewAppError("INTERNAL_ERROR", "internal server error", http.StatusInternalServerError)
	ErrValidation   = NewAppError("VALIDATION_ERROR", "validation failed", http.StatusBadRequest)
)

// ValidationError represents validation errors
type ValidationError struct {
	Errors []FieldError `json:"errors"`
}

// FieldError represents a field validation error
type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// Error implements the error interface
func (e *ValidationError) Error() string {
	return "validation failed"
}

// NewValidationError creates a validation error
func NewValidationError(errors []FieldError) *ValidationError {
	return &ValidationError{Errors: errors}
}

// Wrap wraps an error with context
func Wrap(err error, message string) error {
	return fmt.Errorf("%s: %w", message, err)
}
