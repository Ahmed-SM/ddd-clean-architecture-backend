// Package services contains application services
package services

import (
	"context"
	"fmt"

	"github.com/enterprise/ddd-clean-architecture/internal/domain/customer"
	"github.com/enterprise/ddd-clean-architecture/internal/domain/order"
	"github.com/enterprise/ddd-clean-architecture/internal/domain/product"
	"github.com/enterprise/ddd-clean-architecture/internal/domain/shared"
	"github.com/enterprise/ddd-clean-architecture/pkg/logger"
)

// OrderService provides order-related operations
type OrderService struct {
	orders    order.Repository
	products  product.Repository
	customers customer.Repository
	publisher shared.EventPublisher
	cache     CacheService
	log       *logger.Logger
}

// CacheService defines caching operations
type CacheService interface {
	Get(ctx context.Context, key string, dest any) error
	Set(ctx context.Context, key string, value any, ttlSeconds int) error
	Delete(ctx context.Context, key string) error
	DeletePattern(ctx context.Context, pattern string) error
}

// NewOrderService creates a new order service
func NewOrderService(
	orders order.Repository,
	products product.Repository,
	customers customer.Repository,
	publisher shared.EventPublisher,
	cache CacheService,
	log *logger.Logger,
) *OrderService {
	return &OrderService{
		orders:    orders,
		products:  products,
		customers: customers,
		publisher: publisher,
		cache:     cache,
		log:       log,
	}
}

// CreateOrderInput contains input for creating an order
type CreateOrderInput struct {
	CustomerID string
	Items      []CreateOrderItemInput
	Shipping   AddressInput
	Billing    *AddressInput
	Notes      string
}

// CreateOrderItemInput contains input for an order item
type CreateOrderItemInput struct {
	ProductID string
	Quantity  int
}

// AddressInput contains address input
type AddressInput struct {
	Street     string
	Apartment  string
	City       string
	State      string
	PostalCode string
	Country    string
}

// CreateOrderOutput contains output from creating an order
type CreateOrderOutput struct {
	ID          string
	Status      string
	TotalAmount float64
	Currency    string
	ItemCount   int
}

// CreateOrder creates a new order
func (s *OrderService) CreateOrder(ctx context.Context, input CreateOrderInput) (*CreateOrderOutput, error) {
	// Parse and validate customer ID
	customerID, err := shared.ParseID(input.CustomerID)
	if err != nil {
		return nil, fmt.Errorf("invalid customer ID: %w", err)
	}

	// Validate customer exists
	cust, err := s.customers.FindByID(ctx, customerID)
	if err != nil {
		return nil, fmt.Errorf("customer not found: %w", err)
	}
	if !cust.IsActive {
		return nil, &shared.DomainError{
			Code:    "CUSTOMER_INACTIVE",
			Message: "customer is not active",
		}
	}

	// Collect product IDs
	productIDs := make([]shared.ID, len(input.Items))
	for i, item := range input.Items {
		id, err := shared.ParseID(item.ProductID)
		if err != nil {
			return nil, fmt.Errorf("invalid product ID %s: %w", item.ProductID, err)
		}
		productIDs[i] = id
	}

	// Fetch products
	products, err := s.products.FindByIDs(ctx, productIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch products: %w", err)
	}

	// Create product map
	productMap := make(map[shared.ID]*product.Product)
	for _, p := range products {
		productMap[p.ID] = p
	}

	// Validate and create order items
	items := make([]*order.Item, 0, len(input.Items))
	currency := "USD"

	for _, inputItem := range input.Items {
		productID, _ := shared.ParseID(inputItem.ProductID)
		prod, exists := productMap[productID]
		if !exists {
			return nil, &shared.DomainError{
				Code:    "PRODUCT_NOT_FOUND",
				Message: fmt.Sprintf("product %s not found", inputItem.ProductID),
			}
		}

		if !prod.IsAvailable(inputItem.Quantity) {
			return nil, shared.ErrInsufficientStock.WithDetails(map[string]any{
				"product":   prod.Name,
				"available": prod.Stock,
				"requested": inputItem.Quantity,
			})
		}

		item, err := order.NewItem(
			prod.ID,
			prod.Name,
			prod.SKU,
			inputItem.Quantity,
			prod.Price,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to create order item: %w", err)
		}

		items = append(items, item)
		currency = prod.Price.Currency
	}

	// Create shipping address
	shippingAddr, err := order.NewAddress(
		input.Shipping.Street,
		input.Shipping.City,
		input.Shipping.State,
		input.Shipping.PostalCode,
		input.Shipping.Country,
	)
	if err != nil {
		return nil, fmt.Errorf("invalid shipping address: %w", err)
	}

	// Create billing address if provided
	var billingAddr *order.Address
	if input.Billing != nil {
		addr, err := order.NewAddress(
			input.Billing.Street,
			input.Billing.City,
			input.Billing.State,
			input.Billing.PostalCode,
			input.Billing.Country,
		)
		if err != nil {
			return nil, fmt.Errorf("invalid billing address: %w", err)
		}
		billingAddr = &addr
	}

	// Create order
	ord, err := order.NewOrder(order.CreateOrderParams{
		CustomerID:   customerID,
		Items:        items,
		ShippingAddr: shippingAddr,
		BillingAddr:  billingAddr,
		Notes:        input.Notes,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create order: %w", err)
	}

	// Reserve stock for products
	for _, inputItem := range input.Items {
		productID, _ := shared.ParseID(inputItem.ProductID)
		prod := productMap[productID]
		if err := prod.ReserveStock(inputItem.Quantity); err != nil {
			return nil, err
		}
		if err := s.products.Save(ctx, prod); err != nil {
			return nil, fmt.Errorf("failed to update product stock: %w", err)
		}
	}

	// Persist order
	if err := s.orders.Save(ctx, ord); err != nil {
		return nil, fmt.Errorf("failed to save order: %w", err)
	}

	// Publish domain events
	if ord.HasEvents() {
		if err := s.publisher.Publish(ctx, ord.Events()...); err != nil {
			s.log.Error("failed to publish events", "error", err)
		}
		ord.ClearEvents()
	}

	// Invalidate caches
	_ = s.cache.DeletePattern(ctx, "orders:*")
	_ = s.cache.Delete(ctx, "customer:"+customerID.String()+":orders")

	return &CreateOrderOutput{
		ID:          ord.ID.String(),
		Status:      string(ord.Status),
		TotalAmount: ord.TotalAmount.Amount,
		Currency:    ord.TotalAmount.Currency,
		ItemCount:   ord.ItemCount(),
	}, nil
}

// GetOrderOutput contains output for getting an order
type GetOrderOutput struct {
	ID            string
	CustomerID    string
	Status        string
	TotalAmount   float64
	Currency      string
	Items         []OrderItemOutput
	ShippingAddr  AddressOutput
	BillingAddr   *AddressOutput
	Notes         string
	ItemCount     int
	TotalQuantity int
	CreatedAt     string
	UpdatedAt     string
}

// OrderItemOutput contains order item output
type OrderItemOutput struct {
	ID          string
	ProductID   string
	ProductName string
	Quantity    int
	UnitPrice   float64
	Discount    float64
	Subtotal    float64
}

// AddressOutput contains address output
type AddressOutput struct {
	Street     string
	City       string
	State      string
	PostalCode string
	Country    string
	Formatted  string
}

// GetOrder retrieves an order by ID
func (s *OrderService) GetOrder(ctx context.Context, id string) (*GetOrderOutput, error) {
	orderID, err := shared.ParseID(id)
	if err != nil {
		return nil, fmt.Errorf("invalid order ID: %w", err)
	}

	// Try cache first
	cacheKey := "order:" + id
	var cached GetOrderOutput
	if err := s.cache.Get(ctx, cacheKey, &cached); err == nil {
		return &cached, nil
	}

	// Fetch from repository
	ord, err := s.orders.FindByIDWithItems(ctx, orderID)
	if err != nil {
		return nil, fmt.Errorf("order not found: %w", err)
	}

	output := s.toGetOrderOutput(ord)

	// Cache the result
	_ = s.cache.Set(ctx, cacheKey, output, 300)

	return output, nil
}

// ListOrdersInput contains input for listing orders
type ListOrdersInput struct {
	Page       int
	PageSize   int
	SortBy     string
	SortDesc   bool
	CustomerID string
	Status     string
}

// ListOrdersOutput contains output for listing orders
type ListOrdersOutput struct {
	Orders []GetOrderOutput
	Pagination PaginationOutput
}

// PaginationOutput contains pagination info
type PaginationOutput struct {
	Page       int
	PageSize   int
	Total      int64
	TotalPages int
	HasMore    bool
}

// ListOrders retrieves paginated orders
func (s *OrderService) ListOrders(ctx context.Context, input ListOrdersInput) (*ListOrdersOutput, error) {
	pagination := shared.NewPagination(input.Page, input.PageSize)

	sortDir := shared.SortAsc
	if input.SortDesc {
		sortDir = shared.SortDesc
	}

	params := order.FindParams{
		Pagination: pagination,
		Sort: shared.Sort{
			Field:     input.SortBy,
			Direction: sortDir,
		},
	}

	if input.CustomerID != "" {
		id, err := shared.ParseID(input.CustomerID)
		if err == nil {
			params.Filters.CustomerID = id
		}
	}

	if input.Status != "" {
		params.Filters.Status = order.Status(input.Status)
	}

	result, err := s.orders.FindPaginated(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to list orders: %w", err)
	}

	orders := make([]GetOrderOutput, len(result.Orders))
	for i, ord := range result.Orders {
		orders[i] = s.toGetOrderOutput(ord)
	}

	return &ListOrdersOutput{
		Orders: orders,
		Pagination: PaginationOutput{
			Page:       result.Page,
			PageSize:   result.PageSize,
			Total:      result.Total,
			TotalPages: result.TotalPages,
			HasMore:    result.HasMore,
		},
	}, nil
}

// UpdateOrderStatusInput contains input for updating order status
type UpdateOrderStatusInput struct {
	OrderID string
	Status  string
	Reason  string
}

// UpdateOrderStatus updates an order's status
func (s *OrderService) UpdateOrderStatus(ctx context.Context, input UpdateOrderStatusInput) (*GetOrderOutput, error) {
	orderID, err := shared.ParseID(input.OrderID)
	if err != nil {
		return nil, fmt.Errorf("invalid order ID: %w", err)
	}

	ord, err := s.orders.FindByIDWithItems(ctx, orderID)
	if err != nil {
		return nil, fmt.Errorf("order not found: %w", err)
	}

	status := order.Status(input.Status)
	if !status.IsValid() {
		return nil, &shared.DomainError{
			Code:    "INVALID_STATUS",
			Message: "invalid order status: " + input.Status,
		}
	}

	// Apply status change
	switch status {
	case order.StatusConfirmed:
		err = ord.Confirm()
	case order.StatusProcessing:
		err = ord.StartProcessing()
	case order.StatusShipped:
		err = ord.Ship()
	case order.StatusDelivered:
		err = ord.Deliver()
	case order.StatusCancelled:
		err = ord.Cancel(input.Reason)
	case order.StatusRefunded:
		err = ord.Refund(input.Reason)
	default:
		err = &shared.DomainError{
			Code:    "INVALID_TRANSITION",
			Message: "unsupported status transition",
		}
	}

	if err != nil {
		return nil, err
	}

	// Persist changes
	if err := s.orders.Save(ctx, ord); err != nil {
		return nil, fmt.Errorf("failed to save order: %w", err)
	}

	// Publish events
	if ord.HasEvents() {
		if err := s.publisher.Publish(ctx, ord.Events()...); err != nil {
			s.log.Error("failed to publish events", "error", err)
		}
		ord.ClearEvents()
	}

	// Invalidate caches
	_ = s.cache.Delete(ctx, "order:"+input.OrderID)

	return s.toGetOrderOutputPtr(ord), nil
}

func (s *OrderService) toGetOrderOutput(ord *order.Order) GetOrderOutput {
	items := make([]OrderItemOutput, len(ord.Items))
	for i, item := range ord.Items {
		items[i] = OrderItemOutput{
			ID:          item.ID.String(),
			ProductID:   item.ProductID.String(),
			ProductName: item.ProductName,
			Quantity:    item.Quantity,
			UnitPrice:   item.UnitPrice.Amount,
			Discount:    item.Discount.Amount,
			Subtotal:    item.Subtotal().Amount,
		}
	}

	output := GetOrderOutput{
		ID:          ord.ID.String(),
		CustomerID:  ord.CustomerID.String(),
		Status:      string(ord.Status),
		TotalAmount: ord.TotalAmount.Amount,
		Currency:    ord.TotalAmount.Currency,
		Items:       items,
		ShippingAddr: AddressOutput{
			Street:     ord.ShippingAddr.Street,
			City:       ord.ShippingAddr.City,
			State:      ord.ShippingAddr.State,
			PostalCode: ord.ShippingAddr.PostalCode,
			Country:    ord.ShippingAddr.Country,
			Formatted:  ord.ShippingAddr.Formatted(),
		},
		Notes:         ord.Notes,
		ItemCount:     ord.ItemCount(),
		TotalQuantity: ord.TotalQuantity(),
		CreatedAt:     ord.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:     ord.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	if ord.BillingAddr != nil {
		output.BillingAddr = &AddressOutput{
			Street:     ord.BillingAddr.Street,
			City:       ord.BillingAddr.City,
			State:      ord.BillingAddr.State,
			PostalCode: ord.BillingAddr.PostalCode,
			Country:    ord.BillingAddr.Country,
			Formatted:  ord.BillingAddr.Formatted(),
		}
	}

	return output
}

func (s *OrderService) toGetOrderOutputPtr(ord *order.Order) *GetOrderOutput {
	output := s.toGetOrderOutput(ord)
	return &output
}
