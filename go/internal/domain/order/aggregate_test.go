package order_test

import (
	"testing"

	"github.com/enterprise/ddd-clean-architecture/internal/domain/order"
	"github.com/enterprise/ddd-clean-architecture/internal/domain/shared"
)

func TestNewOrder(t *testing.T) {
	tests := []struct {
		name      string
		params    order.CreateOrderParams
		wantError bool
	}{
		{
			name: "valid order",
			params: func() order.CreateOrderParams {
				customerID := shared.NewID()
				productID := shared.NewID()
				price, _ := order.NewMoney(29.99, "USD")
				item, _ := order.NewItem(productID, "Test Product", "SKU-001", 2, price)
				addr, _ := order.NewAddress("123 Main St", "City", "State", "12345", "US")
				return order.CreateOrderParams{
					CustomerID:   customerID,
					Items:        []*order.Item{item},
					ShippingAddr: addr,
				}
			}(),
			wantError: false,
		},
		{
			name: "empty items",
			params: func() order.CreateOrderParams {
				customerID := shared.NewID()
				addr, _ := order.NewAddress("123 Main St", "City", "State", "12345", "US")
				return order.CreateOrderParams{
					CustomerID:   customerID,
					Items:        []*order.Item{},
					ShippingAddr: addr,
				}
			}(),
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ord, err := order.NewOrder(tt.params)

			if tt.wantError {
				if err == nil {
					t.Error("expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}

			if ord == nil {
				t.Error("expected order, got nil")
				return
			}

			// Verify order has domain event
			if !ord.HasEvents() {
				t.Error("expected order to have domain events")
			}

			// Verify status is pending
			if ord.Status != order.StatusPending {
				t.Errorf("expected status pending, got %s", ord.Status)
			}
		})
	}
}

func TestOrderStatusTransitions(t *testing.T) {
	// Create a valid order
	customerID := shared.NewID()
	productID := shared.NewID()
	price, _ := order.NewMoney(29.99, "USD")
	item, _ := order.NewItem(productID, "Test Product", "SKU-001", 1, price)
	addr, _ := order.NewAddress("123 Main St", "City", "State", "12345", "US")

	ord, _ := order.NewOrder(order.CreateOrderParams{
		CustomerID:   customerID,
		Items:        []*order.Item{item},
		ShippingAddr: addr,
	})

	t.Run("confirm pending order", func(t *testing.T) {
		err := ord.Confirm()
		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}
		if ord.Status != order.StatusConfirmed {
			t.Errorf("expected confirmed, got %s", ord.Status)
		}
	})

	t.Run("cannot confirm twice", func(t *testing.T) {
		err := ord.Confirm()
		if err == nil {
			t.Error("expected error, got nil")
		}
	})

	t.Run("process confirmed order", func(t *testing.T) {
		err := ord.StartProcessing()
		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}
		if ord.Status != order.StatusProcessing {
			t.Errorf("expected processing, got %s", ord.Status)
		}
	})

	t.Run("ship processing order", func(t *testing.T) {
		err := ord.Ship()
		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}
		if ord.Status != order.StatusShipped {
			t.Errorf("expected shipped, got %s", ord.Status)
		}
	})

	t.Run("deliver shipped order", func(t *testing.T) {
		err := ord.Deliver()
		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}
		if ord.Status != order.StatusDelivered {
			t.Errorf("expected delivered, got %s", ord.Status)
		}
	})

	t.Run("cannot cancel delivered order", func(t *testing.T) {
		err := ord.Cancel("reason")
		if err == nil {
			t.Error("expected error, got nil")
		}
	})
}

func TestOrderAddItem(t *testing.T) {
	customerID := shared.NewID()
	productID := shared.NewID()
	price, _ := order.NewMoney(29.99, "USD")
	item, _ := order.NewItem(productID, "Test Product", "SKU-001", 1, price)
	addr, _ := order.NewAddress("123 Main St", "City", "State", "12345", "US")

	ord, _ := order.NewOrder(order.CreateOrderParams{
		CustomerID:   customerID,
		Items:        []*order.Item{item},
		ShippingAddr: addr,
	})

	t.Run("add item to pending order", func(t *testing.T) {
		productID2 := shared.NewID()
		newItem, _ := order.NewItem(productID2, "Another Product", "SKU-002", 1, price)
		err := ord.AddItem(newItem)
		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}
		if ord.ItemCount() != 2 {
			t.Errorf("expected 2 items, got %d", ord.ItemCount())
		}
	})

	t.Run("cannot add item to confirmed order", func(t *testing.T) {
		ord.Confirm()
		productID3 := shared.NewID()
		newItem, _ := order.NewItem(productID3, "Third Product", "SKU-003", 1, price)
		err := ord.AddItem(newItem)
		if err == nil {
			t.Error("expected error, got nil")
		}
	})
}

func TestMoneyOperations(t *testing.T) {
	t.Run("create money", func(t *testing.T) {
		m, err := order.NewMoney(100.50, "USD")
		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}
		if m.Amount != 100.50 {
			t.Errorf("expected 100.50, got %f", m.Amount)
		}
		if m.Currency != "USD" {
			t.Errorf("expected USD, got %s", m.Currency)
		}
	})

	t.Run("add money", func(t *testing.T) {
		m1, _ := order.NewMoney(50, "USD")
		m2, _ := order.NewMoney(30, "USD")
		result, err := m1.Add(m2)
		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}
		if result.Amount != 80 {
			t.Errorf("expected 80, got %f", result.Amount)
		}
	})

	t.Run("cannot add different currencies", func(t *testing.T) {
		m1, _ := order.NewMoney(50, "USD")
		m2, _ := order.NewMoney(30, "EUR")
		_, err := m1.Add(m2)
		if err == nil {
			t.Error("expected error for currency mismatch")
		}
	})

	t.Run("multiply money", func(t *testing.T) {
		m, _ := order.NewMoney(10, "USD")
		result := m.Multiply(3)
		if result.Amount != 30 {
			t.Errorf("expected 30, got %f", result.Amount)
		}
	})
}

func TestStatusValidation(t *testing.T) {
	tests := []struct {
		status order.Status
		valid  bool
	}{
		{order.StatusPending, true},
		{order.StatusConfirmed, true},
		{order.StatusCancelled, true},
		{order.Status("invalid"), false},
		{order.Status(""), false},
	}

	for _, tt := range tests {
		t.Run(string(tt.status), func(t *testing.T) {
			if tt.status.IsValid() != tt.valid {
				t.Errorf("expected IsValid() = %v for status %s", tt.valid, tt.status)
			}
		})
	}
}

func TestStatusTransitions(t *testing.T) {
	tests := []struct {
		from     order.Status
		to       order.Status
		canTrans bool
	}{
		{order.StatusPending, order.StatusConfirmed, true},
		{order.StatusPending, order.StatusCancelled, true},
		{order.StatusPending, order.StatusShipped, false},
		{order.StatusConfirmed, order.StatusProcessing, true},
		{order.StatusCancelled, order.StatusPending, false},
		{order.StatusDelivered, order.StatusRefunded, true},
	}

	for _, tt := range tests {
		t.Run(string(tt.from)+"->"+string(tt.to), func(t *testing.T) {
			if tt.from.CanTransitionTo(tt.to) != tt.canTrans {
				t.Errorf("expected CanTransitionTo(%s) = %v for status %s", tt.to, tt.canTrans, tt.from)
			}
		})
	}
}
