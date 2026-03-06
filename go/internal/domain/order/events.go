// Package order contains order domain events
package order

import (
	"time"

	"github.com/enterprise/ddd-clean-architecture/internal/domain/shared"
)

// EventBase provides common event fields
type EventBase struct {
	ID    shared.ID
	At    time.Time
	AggID shared.ID
}

// EventID returns the event ID
func (e *EventBase) EventID() string {
	return e.ID.String()
}

// OccurredAt returns when the event occurred
func (e *EventBase) OccurredAt() string {
	return e.At.Format(time.RFC3339)
}

// AggregateID returns the aggregate ID
func (e *EventBase) AggregateID() string {
	return e.AggID.String()
}

// OrderCreatedEvent is emitted when an order is created
type OrderCreatedEvent struct {
	EventBase
	CustomerID  shared.ID
	ItemCount   int
	TotalAmount float64
	Currency    string
}

// EventType returns the event type
func (e *OrderCreatedEvent) EventType() string {
	return "order.created"
}

// OrderStatusChangedEvent is emitted when order status changes
type OrderStatusChangedEvent struct {
	EventBase
	PreviousStatus string
	NewStatus      string
	Reason         string
}

// EventType returns the event type
func (e *OrderStatusChangedEvent) EventType() string {
	return "order.status_changed"
}

// IsCancellation returns true if this is a cancellation event
func (e *OrderStatusChangedEvent) IsCancellation() bool {
	return e.NewStatus == string(StatusCancelled)
}

// PaymentProcessedEvent is emitted when a payment is processed
type PaymentProcessedEvent struct {
	EventBase
	PaymentID     shared.ID
	Amount        float64
	Currency      string
	PaymentMethod string
	Status        string
	TransactionID string
}

// EventType returns the event type
func (e *PaymentProcessedEvent) EventType() string {
	return "payment.processed"
}
