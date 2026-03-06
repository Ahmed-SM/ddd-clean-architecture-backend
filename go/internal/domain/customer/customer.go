// Package customer contains the customer domain entity
package customer

import (
	"time"

	"github.com/enterprise/ddd-clean-architecture/internal/domain/shared"
)

// Customer represents a customer aggregate
type Customer struct {
	ID         shared.ID
	UserID     shared.ID
	Email      string
	FirstName  string
	LastName   string
	Phone      *string
	Addresses  []Address
	IsActive   bool
	TotalOrders int
	TotalSpent  float64
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// Address represents a customer address
type Address struct {
	ID         shared.ID
	Label      string
	Street     string
	Apartment  string
	City       string
	State      string
	PostalCode string
	Country    string
	IsDefault  bool
	Type       AddressType
}

// AddressType represents the type of address
type AddressType string

const (
	AddressTypeShipping AddressType = "shipping"
	AddressTypeBilling  AddressType = "billing"
	AddressTypeBoth     AddressType = "both"
)

// CreateCustomerParams contains parameters for creating a customer
type CreateCustomerParams struct {
	UserID    shared.ID
	Email     string
	FirstName string
	LastName  string
	Phone     *string
}

// NewCustomer creates a new customer
func NewCustomer(params CreateCustomerParams) (*Customer, error) {
	if params.Email == "" {
		return nil, &shared.DomainError{
			Code:    "INVALID_EMAIL",
			Message: "email is required",
		}
	}
	if params.FirstName == "" {
		return nil, &shared.DomainError{
			Code:    "INVALID_NAME",
			Message: "first name is required",
		}
	}
	if params.LastName == "" {
		return nil, &shared.DomainError{
			Code:    "INVALID_NAME",
			Message: "last name is required",
		}
	}

	now := time.Now()
	return &Customer{
		ID:          shared.NewID(),
		UserID:      params.UserID,
		Email:       params.Email,
		FirstName:   params.FirstName,
		LastName:    params.LastName,
		Phone:       params.Phone,
		Addresses:   []Address{},
		IsActive:    true,
		TotalOrders: 0,
		TotalSpent:  0,
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

// FullName returns the customer's full name
func (c *Customer) FullName() string {
	return c.FirstName + " " + c.LastName
}

// UpdateName updates the customer name
func (c *Customer) UpdateName(firstName, lastName string) error {
	if firstName == "" || lastName == "" {
		return &shared.DomainError{
			Code:    "INVALID_NAME",
			Message: "first and last name are required",
		}
	}
	c.FirstName = firstName
	c.LastName = lastName
	c.UpdatedAt = time.Now()
	return nil
}

// UpdateEmail updates the customer email
func (c *Customer) UpdateEmail(email string) error {
	if email == "" {
		return &shared.DomainError{
			Code:    "INVALID_EMAIL",
			Message: "email is required",
		}
	}
	c.Email = email
	c.UpdatedAt = time.Now()
	return nil
}

// AddAddress adds an address to the customer
func (c *Customer) AddAddress(addr Address) {
	if len(c.Addresses) == 0 {
		addr.IsDefault = true
	}
	if addr.IsDefault {
		// Remove default from other addresses
		for i := range c.Addresses {
			c.Addresses[i].IsDefault = false
		}
	}
	c.Addresses = append(c.Addresses, addr)
	c.UpdatedAt = time.Now()
}

// RemoveAddress removes an address
func (c *Customer) RemoveAddress(addressID shared.ID) error {
	for i, addr := range c.Addresses {
		if addr.ID == addressID {
			wasDefault := addr.IsDefault
			c.Addresses = append(c.Addresses[:i], c.Addresses[i+1:]...)
			// If removed address was default, make first remaining default
			if wasDefault && len(c.Addresses) > 0 {
				c.Addresses[0].IsDefault = true
			}
			c.UpdatedAt = time.Now()
			return nil
		}
	}
	return shared.ErrNotFound
}

// DefaultAddress returns the default address
func (c *Customer) DefaultAddress() *Address {
	for _, addr := range c.Addresses {
		if addr.IsDefault {
			return &addr
		}
	}
	if len(c.Addresses) > 0 {
		return &c.Addresses[0]
	}
	return nil
}

// RecordOrder records an order completion
func (c *Customer) RecordOrder(amount float64) {
	c.TotalOrders++
	c.TotalSpent += amount
	c.UpdatedAt = time.Now()
}

// Activate activates the customer
func (c *Customer) Activate() {
	c.IsActive = true
	c.UpdatedAt = time.Now()
}

// Deactivate deactivates the customer
func (c *Customer) Deactivate() {
	c.IsActive = false
	c.UpdatedAt = time.Now()
}

// Repository defines the interface for customer persistence
type Repository interface {
	FindByID(ctx context.Context, id shared.ID) (*Customer, error)
	FindByUserID(ctx context.Context, userID shared.ID) (*Customer, error)
	FindByEmail(ctx context.Context, email string) (*Customer, error)
	FindByIDs(ctx context.Context, ids []shared.ID) ([]*Customer, error)
	FindPaginated(ctx context.Context, params FindParams) (*FindResult, error)
	Search(ctx context.Context, query string, limit int) ([]*Customer, error)
	FindTopCustomers(ctx context.Context, limit int) ([]*Customer, error)
	FindInactive(ctx context.Context, days int) ([]*Customer, error)
	Save(ctx context.Context, customer *Customer) error
	Delete(ctx context.Context, id shared.ID) error
	Exists(ctx context.Context, id shared.ID) (bool, error)
	IsEmailTaken(ctx context.Context, email string, excludeID *shared.ID) (bool, error)
}

// FindParams contains parameters for finding customers
type FindParams struct {
	Pagination shared.Pagination
	Sort       shared.Sort
	Filters    FilterParams
}

// FilterParams contains filter parameters
type FilterParams struct {
	IsActive     *bool
	HasOrders    bool
	MinTotalSpent float64
	Search       string
}

// FindResult contains paginated results
type FindResult struct {
	Customers  []*Customer
	Total      int64
	Page       int
	PageSize   int
	TotalPages int
	HasMore    bool
}
