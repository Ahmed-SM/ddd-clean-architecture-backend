// Package order contains the order domain aggregate and related types
package order

import (
	"time"

	"github.com/enterprise/ddd-clean-architecture/internal/domain/shared"
)

// Status represents the order status
type Status string

const (
	StatusPending    Status = "pending"
	StatusConfirmed  Status = "confirmed"
	StatusProcessing Status = "processing"
	StatusShipped    Status = "shipped"
	StatusDelivered  Status = "delivered"
	StatusCancelled  Status = "cancelled"
	StatusRefunded   Status = "refunded"
)

// ValidTransitions defines allowed status transitions
var ValidTransitions = map[Status][]Status{
	StatusPending:    {StatusConfirmed, StatusCancelled},
	StatusConfirmed:  {StatusProcessing, StatusCancelled},
	StatusProcessing: {StatusShipped, StatusCancelled},
	StatusShipped:    {StatusDelivered, StatusCancelled},
	StatusDelivered:  {StatusRefunded},
	StatusCancelled:  {},
	StatusRefunded:   {},
}

// IsValid returns true if the status is valid
func (s Status) IsValid() bool {
	switch s {
	case StatusPending, StatusConfirmed, StatusProcessing, StatusShipped, StatusDelivered, StatusCancelled, StatusRefunded:
		return true
	default:
		return false
	}
}

// CanTransitionTo returns true if transition to target status is allowed
func (s Status) CanTransitionTo(target Status) bool {
	allowed, exists := ValidTransitions[s]
	if !exists {
		return false
	}
	for _, t := range allowed {
		if t == target {
			return true
		}
	}
	return false
}

// IsFinal returns true if no further transitions are allowed
func (s Status) IsFinal() bool {
	return s == StatusCancelled || s == StatusRefunded
}

// Item represents an order line item
type Item struct {
	ID          shared.ID
	ProductID   shared.ID
	ProductName string
	ProductSKU  string
	Quantity    int
	UnitPrice   Money
	Discount    Money
}

// NewItem creates a new order item
func NewItem(productID shared.ID, productName, productSKU string, quantity int, unitPrice Money) (*Item, error) {
	if quantity <= 0 {
		return nil, &shared.DomainError{
			Code:    "INVALID_QUANTITY",
			Message: "quantity must be positive",
		}
	}
	if unitPrice.IsNegative() {
		return nil, &shared.DomainError{
			Code:    "INVALID_PRICE",
			Message: "unit price cannot be negative",
		}
	}

	return &Item{
		ID:          shared.NewID(),
		ProductID:   productID,
		ProductName: productName,
		ProductSKU:  productSKU,
		Quantity:    quantity,
		UnitPrice:  unitPrice,
		Discount:   Money{Amount: 0, Currency: unitPrice.Currency},
	}, nil
}

// Subtotal returns the item subtotal after discount
func (i *Item) Subtotal() Money {
	total := i.UnitPrice.Multiply(i.Quantity)
	return total.Subtract(i.Discount)
}

// ApplyDiscount applies a discount to the item
func (i *Item) ApplyDiscount(discount Money) error {
	if discount.Currency != i.UnitPrice.Currency {
		return &shared.DomainError{
			Code:    "CURRENCY_MISMATCH",
			Message: "discount currency must match item currency",
		}
	}
	if discount.IsGreaterThan(i.UnitPrice.Multiply(i.Quantity)) {
		return &shared.DomainError{
			Code:    "INVALID_DISCOUNT",
			Message: "discount cannot exceed item total",
		}
	}
	i.Discount = discount
	return nil
}

// Money represents a monetary value
type Money struct {
	Amount   float64
	Currency string
}

// NewMoney creates a new Money value
func NewMoney(amount float64, currency string) (Money, error) {
	if amount < 0 {
		return Money{}, &shared.DomainError{
			Code:    "INVALID_AMOUNT",
			Message: "money amount cannot be negative",
		}
	}
	if currency == "" {
		return Money{}, &shared.DomainError{
			Code:    "INVALID_CURRENCY",
			Message: "currency is required",
		}
	}
	return Money{Amount: amount, Currency: currency}, nil
}

// Zero creates zero money in the given currency
func ZeroMoney(currency string) Money {
	return Money{Amount: 0, Currency: currency}
}

// Add adds two money values
func (m Money) Add(other Money) (Money, error) {
	if m.Currency != other.Currency {
		return Money{}, &shared.DomainError{
			Code:    "CURRENCY_MISMATCH",
			Message: "cannot add different currencies",
		}
	}
	return Money{Amount: m.Amount + other.Amount, Currency: m.Currency}, nil
}

// Subtract subtracts money from another
func (m Money) Subtract(other Money) (Money, error) {
	if m.Currency != other.Currency {
		return Money{}, &shared.DomainError{
			Code:    "CURRENCY_MISMATCH",
			Message: "cannot subtract different currencies",
		}
	}
	return Money{Amount: m.Amount - other.Amount, Currency: m.Currency}, nil
}

// Multiply multiplies money by a factor
func (m Money) Multiply(factor int) Money {
	return Money{Amount: m.Amount * float64(factor), Currency: m.Currency}
}

// IsNegative returns true if amount is negative
func (m Money) IsNegative() bool {
	return m.Amount < 0
}

// IsZero returns true if amount is zero
func (m Money) IsZero() bool {
	return m.Amount == 0
}

// IsGreaterThan compares two money values
func (m Money) IsGreaterThan(other Money) bool {
	return m.Amount > other.Amount
}

// Order represents the order aggregate root
type Order struct {
	shared.AggregateRoot
	ID             shared.ID
	CustomerID     shared.ID
	Items          []*Item
	Status         Status
	TotalAmount    Money
	ShippingAddr   Address
	BillingAddr    *Address
	Notes          string
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// Address represents a physical address
type Address struct {
	Street     string
	Apartment  string
	City       string
	State      string
	PostalCode string
	Country    string
}

// NewAddress creates a new address
func NewAddress(street, city, state, postalCode, country string) (Address, error) {
	if street == "" || city == "" || state == "" || postalCode == "" || country == "" {
		return Address{}, &shared.DomainError{
			Code:    "INVALID_ADDRESS",
			Message: "all address fields are required",
		}
	}
	return Address{
		Street:     street,
		City:       city,
		State:      state,
		PostalCode: postalCode,
		Country:    country,
	}, nil
}

// Formatted returns the formatted address string
func (a Address) Formatted() string {
	return a.Street + ", " + a.City + ", " + a.State + " " + a.PostalCode + ", " + a.Country
}

// CreateOrderParams contains parameters for creating an order
type CreateOrderParams struct {
	CustomerID     shared.ID
	Items          []*Item
	ShippingAddr   Address
	BillingAddr    *Address
	Notes          string
}

// NewOrder creates a new order
func NewOrder(params CreateOrderParams) (*Order, error) {
	if len(params.Items) == 0 {
		return nil, &shared.DomainError{
			Code:    "EMPTY_ORDER",
			Message: "order must have at least one item",
		}
	}

	// Calculate total
	currency := params.Items[0].UnitPrice.Currency
	total := ZeroMoney(currency)
	for _, item := range params.Items {
		var err error
		total, err = total.Add(item.Subtotal())
		if err != nil {
			return nil, err
		}
	}

	now := time.Now()
	order := &Order{
		AggregateRoot: shared.AggregateRoot{},
		ID:            shared.NewID(),
		CustomerID:    params.CustomerID,
		Items:         params.Items,
		Status:        StatusPending,
		TotalAmount:   total,
		ShippingAddr:  params.ShippingAddr,
		BillingAddr:   params.BillingAddr,
		Notes:         params.Notes,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	// Add domain event
	order.AddEvent(&OrderCreatedEvent{
		EventBase: EventBase{
			ID:      shared.NewID(),
			At:      now,
			AggID:   order.ID,
		},
		CustomerID:  order.CustomerID,
		ItemCount:   len(order.Items),
		TotalAmount: order.TotalAmount.Amount,
		Currency:    order.TotalAmount.Currency,
	})

	return order, nil
}

// AddItem adds an item to the order
func (o *Order) AddItem(item *Item) error {
	if !o.CanBeModified() {
		return &shared.DomainError{
			Code:    "ORDER_NOT_MODIFIABLE",
			Message: "order cannot be modified in current status",
		}
	}

	// Check for existing item with same product
	for i, existing := range o.Items {
		if existing.ProductID == item.ProductID {
			// Update quantity
			o.Items[i].Quantity += item.Quantity
			o.recalculateTotal()
			o.UpdatedAt = time.Now()
			return nil
		}
	}

	o.Items = append(o.Items, item)
	o.recalculateTotal()
	o.UpdatedAt = time.Now()
	return nil
}

// RemoveItem removes an item from the order
func (o *Order) RemoveItem(itemID shared.ID) error {
	if !o.CanBeModified() {
		return &shared.DomainError{
			Code:    "ORDER_NOT_MODIFIABLE",
			Message: "order cannot be modified in current status",
		}
	}

	if len(o.Items) == 1 {
		return &shared.DomainError{
			Code:    "LAST_ITEM",
			Message: "cannot remove the last item from an order",
		}
	}

	for i, item := range o.Items {
		if item.ID == itemID {
			o.Items = append(o.Items[:i], o.Items[i+1:]...)
			o.recalculateTotal()
			o.UpdatedAt = time.Now()
			return nil
		}
	}

	return shared.ErrNotFound
}

// Confirm confirms the order
func (o *Order) Confirm() error {
	if !o.Status.CanTransitionTo(StatusConfirmed) {
		return &shared.DomainError{
			Code:    "INVALID_TRANSITION",
			Message: "cannot confirm order in current status",
		}
	}

	prevStatus := o.Status
	o.Status = StatusConfirmed
	o.UpdatedAt = time.Now()

	o.AddEvent(&OrderStatusChangedEvent{
		EventBase: EventBase{
			ID:    shared.NewID(),
			At:    time.Now(),
			AggID: o.ID,
		},
		PreviousStatus: string(prevStatus),
		NewStatus:      string(o.Status),
	})

	return nil
}

// StartProcessing starts processing the order
func (o *Order) StartProcessing() error {
	if !o.Status.CanTransitionTo(StatusProcessing) {
		return &shared.DomainError{
			Code:    "INVALID_TRANSITION",
			Message: "cannot start processing order in current status",
		}
	}

	prevStatus := o.Status
	o.Status = StatusProcessing
	o.UpdatedAt = time.Now()

	o.AddEvent(&OrderStatusChangedEvent{
		EventBase: EventBase{
			ID:    shared.NewID(),
			At:    time.Now(),
			AggID: o.ID,
		},
		PreviousStatus: string(prevStatus),
		NewStatus:      string(o.Status),
	})

	return nil
}

// Ship marks the order as shipped
func (o *Order) Ship() error {
	if !o.Status.CanTransitionTo(StatusShipped) {
		return &shared.DomainError{
			Code:    "INVALID_TRANSITION",
			Message: "cannot ship order in current status",
		}
	}

	prevStatus := o.Status
	o.Status = StatusShipped
	o.UpdatedAt = time.Now()

	o.AddEvent(&OrderStatusChangedEvent{
		EventBase: EventBase{
			ID:    shared.NewID(),
			At:    time.Now(),
			AggID: o.ID,
		},
		PreviousStatus: string(prevStatus),
		NewStatus:      string(o.Status),
	})

	return nil
}

// Deliver marks the order as delivered
func (o *Order) Deliver() error {
	if !o.Status.CanTransitionTo(StatusDelivered) {
		return &shared.DomainError{
			Code:    "INVALID_TRANSITION",
			Message: "cannot deliver order in current status",
		}
	}

	prevStatus := o.Status
	o.Status = StatusDelivered
	o.UpdatedAt = time.Now()

	o.AddEvent(&OrderStatusChangedEvent{
		EventBase: EventBase{
			ID:    shared.NewID(),
			At:    time.Now(),
			AggID: o.ID,
		},
		PreviousStatus: string(prevStatus),
		NewStatus:      string(o.Status),
	})

	return nil
}

// Cancel cancels the order
func (o *Order) Cancel(reason string) error {
	if !o.Status.CanTransitionTo(StatusCancelled) {
		return &shared.DomainError{
			Code:    "INVALID_TRANSITION",
			Message: "cannot cancel order in current status",
		}
	}

	prevStatus := o.Status
	o.Status = StatusCancelled
	if reason != "" {
		o.Notes = o.Notes + " | Cancellation reason: " + reason
	}
	o.UpdatedAt = time.Now()

	o.AddEvent(&OrderStatusChangedEvent{
		EventBase: EventBase{
			ID:    shared.NewID(),
			At:    time.Now(),
			AggID: o.ID,
		},
		PreviousStatus: string(prevStatus),
		NewStatus:      string(o.Status),
		Reason:         reason,
	})

	return nil
}

// Refund marks the order as refunded
func (o *Order) Refund(reason string) error {
	if !o.Status.CanTransitionTo(StatusRefunded) {
		return &shared.DomainError{
			Code:    "INVALID_TRANSITION",
			Message: "cannot refund order in current status",
		}
	}

	prevStatus := o.Status
	o.Status = StatusRefunded
	if reason != "" {
		o.Notes = o.Notes + " | Refund reason: " + reason
	}
	o.UpdatedAt = time.Now()

	o.AddEvent(&OrderStatusChangedEvent{
		EventBase: EventBase{
			ID:    shared.NewID(),
			At:    time.Now(),
			AggID: o.ID,
		},
		PreviousStatus: string(prevStatus),
		NewStatus:      string(o.Status),
		Reason:         reason,
	})

	return nil
}

// CanBeModified returns true if order can be modified
func (o *Order) CanBeModified() bool {
	return o.Status == StatusPending
}

// ItemCount returns the number of items
func (o *Order) ItemCount() int {
	return len(o.Items)
}

// TotalQuantity returns the total quantity of all items
func (o *Order) TotalQuantity() int {
	total := 0
	for _, item := range o.Items {
		total += item.Quantity
	}
	return total
}

// recalculateTotal recalculates the order total
func (o *Order) recalculateTotal() {
	if len(o.Items) == 0 {
		return
	}

	currency := o.Items[0].UnitPrice.Currency
	total := ZeroMoney(currency)
	for _, item := range o.Items {
		total, _ = total.Add(item.Subtotal())
	}
	o.TotalAmount = total
}
