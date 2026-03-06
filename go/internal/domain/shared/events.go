// Package shared contains common domain types and interfaces
package shared

import "context"

// Event represents a domain event
type Event interface {
	// EventID returns the unique identifier for this event
	EventID() string
	// EventType returns the type of event
	EventType() string
	// OccurredAt returns when the event occurred
	OccurredAt() string
	// AggregateID returns the ID of the aggregate that produced the event
	AggregateID() string
}

// EventHandler handles domain events
type EventHandler func(ctx context.Context, event Event) error

// EventPublisher publishes domain events
type EventPublisher interface {
	Publish(ctx context.Context, events ...Event) error
	Subscribe(eventType string, handler EventHandler)
}

// AggregateRoot provides domain event management for aggregates
type AggregateRoot struct {
	events []Event
}

// AddEvent adds a domain event to the aggregate
func (a *AggregateRoot) AddEvent(event Event) {
	a.events = append(a.events, event)
}

// ClearEvents clears all domain events
func (a *AggregateRoot) ClearEvents() {
	a.events = a.events[:0]
}

// Events returns all domain events
func (a *AggregateRoot) Events() []Event {
	return a.events
}

// HasEvents returns true if there are uncommitted events
func (a *AggregateRoot) HasEvents() bool {
	return len(a.events) > 0
}
