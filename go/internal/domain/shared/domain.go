// Package shared contains common domain types and interfaces
package shared

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// ID represents a unique identifier using UUID
type ID string

// NewID creates a new unique identifier
func NewID() ID {
	return ID(uuid.New().String())
}

// ParseID parses a string into an ID
func ParseID(s string) (ID, error) {
	id, err := uuid.Parse(s)
	if err != nil {
		return "", ErrInvalidID
	}
	return ID(id.String()), nil
}

// String returns the string representation of the ID
func (id ID) String() string {
	return string(id)
}

// IsEmpty returns true if the ID is empty
func (id ID) IsEmpty() bool {
	return id == ""
}

// Time represents a timestamp
type Time time.Time

// Now returns the current time
func Now() Time {
	return Time(time.Now())
}

// Context provides request-scoped values
type Context struct {
	context.Context
	UserID   ID
	TraceID  string
	Metadata map[string]any
}

// Auditable provides audit fields for entities
type Auditable struct {
	CreatedAt time.Time
	UpdatedAt time.Time
	CreatedBy ID
	UpdatedBy ID
}

// Pagination represents pagination parameters
type Pagination struct {
	Page     int
	PageSize int
}

// NewPagination creates a new pagination with defaults
func NewPagination(page, pageSize int) Pagination {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return Pagination{
		Page:     page,
		PageSize: pageSize,
	}
}

// Offset returns the offset for database queries
func (p Pagination) Offset() int {
	return (p.Page - 1) * p.PageSize
}

// SortDirection represents sort direction
type SortDirection string

const (
	SortAsc  SortDirection = "ASC"
	SortDesc SortDirection = "DESC"
)

// Sort represents sort parameters
type Sort struct {
	Field     string
	Direction SortDirection
}

// Domain errors
var (
	ErrInvalidID      = &DomainError{Code: "INVALID_ID", Message: "invalid identifier format"}
	ErrNotFound       = &DomainError{Code: "NOT_FOUND", Message: "resource not found"}
	ErrAlreadyExists  = &DomainError{Code: "ALREADY_EXISTS", Message: "resource already exists"}
	ErrInvalidState   = &DomainError{Code: "INVALID_STATE", Message: "invalid state for operation"}
	ErrBusinessRule   = &DomainError{Code: "BUSINESS_RULE", Message: "business rule violation"}
	ErrInsufficientStock = &DomainError{Code: "INSUFFICIENT_STOCK", Message: "insufficient stock available"}
)

// DomainError represents a domain-level error
type DomainError struct {
	Code    string
	Message string
	Details map[string]any
}

// Error implements the error interface
func (e *DomainError) Error() string {
	return e.Message
}

// WithDetails adds details to the error
func (e *DomainError) WithDetails(details map[string]any) *DomainError {
	e.Details = details
	return e
}
