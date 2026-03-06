// Package shared provides shared domain types
package shared

import "time"

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

// FilterParams represents filter parameters
type FilterParams struct {
	CustomerID ID
	Status     string
	FromDate   string
	ToDate     string
}

// FindParams contains parameters for finding entities
type FindParams struct {
	Pagination Pagination
	Sort       Sort
	Filters    FilterParams
}

// FindResult contains paginated results
type FindResult[T any] struct {
	Data       []T
	Total      int64
	Page       int
	PageSize   int
	TotalPages int
	HasMore    bool
}

// Time represents a timestamp wrapper
type Time time.Time

// Now returns the current time
func Now() Time {
	return Time(time.Now())
}

// Format returns formatted time string
func (t Time) Format(layout string) string {
	return time.Time(t).Format(layout)
}
