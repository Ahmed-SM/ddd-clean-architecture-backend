// Package order contains repository interfaces
package order

import (
	"context"

	"github.com/enterprise/ddd-clean-architecture/internal/domain/shared"
)

// Repository defines the interface for order persistence
// This interface follows Go's interface segregation principle
type Repository interface {
	// FindByID finds an order by ID
	FindByID(ctx context.Context, id shared.ID) (*Order, error)

	// FindByIDWithItems finds an order with items loaded
	FindByIDWithItems(ctx context.Context, id shared.ID) (*Order, error)

	// FindByCustomerID finds all orders for a customer
	FindByCustomerID(ctx context.Context, customerID shared.ID) ([]*Order, error)

	// FindByStatus finds orders by status
	FindByStatus(ctx context.Context, status Status) ([]*Order, error)

	// FindPaginated finds orders with pagination
	FindPaginated(ctx context.Context, params FindParams) (*FindResult, error)

	// Save persists an order
	Save(ctx context.Context, order *Order) error

	// Delete deletes an order
	Delete(ctx context.Context, id shared.ID) error

	// Exists checks if an order exists
	Exists(ctx context.Context, id shared.ID) (bool, error)

	// Count counts orders matching filters
	Count(ctx context.Context, filters FilterParams) (int64, error)
}

// FindParams contains parameters for finding orders
type FindParams struct {
	Pagination shared.Pagination
	Sort       shared.Sort
	Filters    FilterParams
}

// FilterParams contains filter parameters
type FilterParams struct {
	CustomerID shared.ID
	Status     Status
	FromDate   string
	ToDate     string
	MinAmount  float64
	MaxAmount  float64
}

// FindResult contains paginated results
type FindResult struct {
	Orders     []*Order
	Total      int64
	Page       int
	PageSize   int
	TotalPages int
	HasMore    bool
}
