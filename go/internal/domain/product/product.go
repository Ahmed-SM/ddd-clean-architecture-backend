// Package product contains the product domain entity
package product

import (
	"time"

	"github.com/enterprise/ddd-clean-architecture/internal/domain/shared"
	"github.com/enterprise/ddd-clean-architecture/internal/domain/order"
)

// Product represents a product in the catalog
type Product struct {
	ID          shared.ID
	SKU         string
	Name        string
	Description string
	Price       order.Money
	Stock       int
	CategoryID  *shared.ID
	IsActive    bool
	Images      []Image
	Attributes  map[string]string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// Image represents a product image
type Image struct {
	ID        shared.ID
	URL       string
	Alt       string
	IsPrimary bool
	Order     int
}

// CreateProductParams contains parameters for creating a product
type CreateProductParams struct {
	SKU         string
	Name        string
	Description string
	Price       order.Money
	Stock       int
	CategoryID  *shared.ID
	Images      []Image
	Attributes  map[string]string
}

// NewProduct creates a new product
func NewProduct(params CreateProductParams) (*Product, error) {
	if params.SKU == "" {
		return nil, &shared.DomainError{
			Code:    "INVALID_SKU",
			Message: "SKU is required",
		}
	}
	if params.Name == "" {
		return nil, &shared.DomainError{
			Code:    "INVALID_NAME",
			Message: "product name is required",
		}
	}
	if params.Stock < 0 {
		return nil, &shared.DomainError{
			Code:    "INVALID_STOCK",
			Message: "stock cannot be negative",
		}
	}

	now := time.Now()
	return &Product{
		ID:          shared.NewID(),
		SKU:         params.SKU,
		Name:        params.Name,
		Description: params.Description,
		Price:       params.Price,
		Stock:       params.Stock,
		CategoryID:  params.CategoryID,
		IsActive:    true,
		Images:      params.Images,
		Attributes:  params.Attributes,
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

// IsAvailable checks if the product is available in the requested quantity
func (p *Product) IsAvailable(quantity int) bool {
	return p.IsActive && p.Stock >= quantity
}

// ReserveStock reserves stock for an order
func (p *Product) ReserveStock(quantity int) error {
	if !p.IsAvailable(quantity) {
		return shared.ErrInsufficientStock.WithDetails(map[string]any{
			"product":    p.Name,
			"available":  p.Stock,
			"requested":  quantity,
		})
	}
	p.Stock -= quantity
	p.UpdatedAt = time.Now()
	return nil
}

// ReleaseStock releases reserved stock
func (p *Product) ReleaseStock(quantity int) {
	p.Stock += quantity
	p.UpdatedAt = time.Now()
}

// AddStock adds stock (for inventory replenishment)
func (p *Product) AddStock(quantity int) {
	p.Stock += quantity
	p.UpdatedAt = time.Now()
}

// UpdatePrice updates the product price
func (p *Product) UpdatePrice(price order.Money) {
	p.Price = price
	p.UpdatedAt = time.Now()
}

// Activate activates the product
func (p *Product) Activate() {
	p.IsActive = true
	p.UpdatedAt = time.Now()
}

// Deactivate deactivates the product
func (p *Product) Deactivate() {
	p.IsActive = false
	p.UpdatedAt = time.Now()
}

// AddImage adds an image to the product
func (p *Product) AddImage(image Image) {
	if len(p.Images) == 0 {
		image.IsPrimary = true
	}
	p.Images = append(p.Images, image)
	p.UpdatedAt = time.Now()
}

// SetPrimaryImage sets the primary image
func (p *Product) SetPrimaryImage(imageID shared.ID) {
	for i := range p.Images {
		p.Images[i].IsPrimary = p.Images[i].ID == imageID
	}
	p.UpdatedAt = time.Now()
}

// PrimaryImage returns the primary image
func (p *Product) PrimaryImage() *Image {
	for _, img := range p.Images {
		if img.IsPrimary {
			return &img
		}
	}
	if len(p.Images) > 0 {
		return &p.Images[0]
	}
	return nil
}

// Repository defines the interface for product persistence
type Repository interface {
	FindByID(ctx context.Context, id shared.ID) (*Product, error)
	FindBySKU(ctx context.Context, sku string) (*Product, error)
	FindByIDs(ctx context.Context, ids []shared.ID) ([]*Product, error)
	FindAllActive(ctx context.Context) ([]*Product, error)
	FindByCategory(ctx context.Context, categoryID shared.ID) ([]*Product, error)
	FindPaginated(ctx context.Context, params FindParams) (*FindResult, error)
	Search(ctx context.Context, query string, limit int) ([]*Product, error)
	FindLowStock(ctx context.Context, threshold int) ([]*Product, error)
	Save(ctx context.Context, product *Product) error
	Delete(ctx context.Context, id shared.ID) error
	Exists(ctx context.Context, id shared.ID) (bool, error)
	IsSKUTaken(ctx context.Context, sku string, excludeID *shared.ID) (bool, error)
	UpdateStock(ctx context.Context, id shared.ID, delta int) error
}

// FindParams contains parameters for finding products
type FindParams struct {
	Pagination shared.Pagination
	Sort       shared.Sort
	Filters    FilterParams
}

// FilterParams contains filter parameters
type FilterParams struct {
	CategoryID *shared.ID
	MinPrice   float64
	MaxPrice   float64
	InStock    bool
	IsActive   *bool
	Search     string
}

// FindResult contains paginated results
type FindResult struct {
	Products   []*Product
	Total      int64
	Page       int
	PageSize   int
	TotalPages int
	HasMore    bool
}
