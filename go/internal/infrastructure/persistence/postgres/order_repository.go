// Package postgres provides order repository implementation
package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/enterprise/ddd-clean-architecture/internal/domain/order"
	"github.com/enterprise/ddd-clean-architecture/internal/domain/shared"
	"github.com/jmoiron/sqlx"
)

// OrderRepository implements order.Repository using PostgreSQL
type OrderRepository struct {
	db *sqlx.DB
}

// NewOrderRepository creates a new order repository
func NewOrderRepository(db *sqlx.DB) *OrderRepository {
	return &OrderRepository{db: db}
}

// OrderRow represents a database row
type OrderRow struct {
	ID                 string         `db:"id"`
	CustomerID         string         `db:"customer_id"`
	Status             string         `db:"status"`
	TotalAmount        float64        `db:"total_amount"`
	Currency           string         `db:"currency"`
	ShippingStreet     string         `db:"shipping_street"`
	ShippingApartment  sql.NullString `db:"shipping_apartment"`
	ShippingCity       string         `db:"shipping_city"`
	ShippingState      string         `db:"shipping_state"`
	ShippingPostalCode string         `db:"shipping_postal_code"`
	ShippingCountry    string         `db:"shipping_country"`
	BillingStreet      sql.NullString `db:"billing_street"`
	BillingCity        sql.NullString `db:"billing_city"`
	BillingState       sql.NullString `db:"billing_state"`
	BillingPostalCode  sql.NullString `db:"billing_postal_code"`
	BillingCountry     sql.NullString `db:"billing_country"`
	Notes              sql.NullString `db:"notes"`
	CreatedAt          time.Time      `db:"created_at"`
	UpdatedAt          time.Time      `db:"updated_at"`
}

// OrderItemRow represents an order item database row
type OrderItemRow struct {
	ID          string    `db:"id"`
	OrderID     string    `db:"order_id"`
	ProductID   string    `db:"product_id"`
	ProductName string    `db:"product_name"`
	ProductSKU  string    `db:"product_sku"`
	Quantity    int       `db:"quantity"`
	UnitPrice   float64   `db:"unit_price"`
	Discount    float64   `db:"discount"`
	Currency    string    `db:"currency"`
	CreatedAt   time.Time `db:"created_at"`
}

// FindByID finds an order by ID
func (r *OrderRepository) FindByID(ctx context.Context, id shared.ID) (*order.Order, error) {
	var row OrderRow
	query := `SELECT * FROM orders WHERE id = $1`
	if err := r.db.GetContext(ctx, &row, query, id.String()); err != nil {
		if err == sql.ErrNoRows {
			return nil, shared.ErrNotFound
		}
		return nil, fmt.Errorf("failed to find order: %w", err)
	}
	return r.toDomain(row)
}

// FindByIDWithItems finds an order with items loaded
func (r *OrderRepository) FindByIDWithItems(ctx context.Context, id shared.ID) (*order.Order, error) {
	ord, err := r.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}

	items, err := r.findItemsByOrderID(ctx, id.String())
	if err != nil {
		return nil, err
	}

	ord.Items = items
	return ord, nil
}

// FindByCustomerID finds all orders for a customer
func (r *OrderRepository) FindByCustomerID(ctx context.Context, customerID shared.ID) ([]*order.Order, error) {
	var rows []OrderRow
	query := `SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC`
	if err := r.db.SelectContext(ctx, &rows, query, customerID.String()); err != nil {
		return nil, fmt.Errorf("failed to find orders: %w", err)
	}

	orders := make([]*order.Order, len(rows))
	for i, row := range rows {
		ord, err := r.toDomain(row)
		if err != nil {
			return nil, err
		}
		orders[i] = ord
	}
	return orders, nil
}

// FindByStatus finds orders by status
func (r *OrderRepository) FindByStatus(ctx context.Context, status order.Status) ([]*order.Order, error) {
	var rows []OrderRow
	query := `SELECT * FROM orders WHERE status = $1 ORDER BY created_at DESC`
	if err := r.db.SelectContext(ctx, &rows, query, string(status)); err != nil {
		return nil, fmt.Errorf("failed to find orders: %w", err)
	}

	orders := make([]*order.Order, len(rows))
	for i, row := range rows {
		ord, err := r.toDomain(row)
		if err != nil {
			return nil, err
		}
		orders[i] = ord
	}
	return orders, nil
}

// FindPaginated finds orders with pagination
func (r *OrderRepository) FindPaginated(ctx context.Context, params order.FindParams) (*order.FindResult, error) {
	where := "WHERE 1=1"
	args := make([]any, 0)
	argNum := 1

	if !params.Filters.CustomerID.IsEmpty() {
		where += fmt.Sprintf(" AND customer_id = $%d", argNum)
		args = append(args, params.Filters.CustomerID.String())
		argNum++
	}
	if params.Filters.Status != "" {
		where += fmt.Sprintf(" AND status = $%d", argNum)
		args = append(args, string(params.Filters.Status))
		argNum++
	}

	// Count query
	countQuery := "SELECT COUNT(*) FROM orders " + where
	var total int64
	if err := r.db.GetContext(ctx, &total, countQuery, args...); err != nil {
		return nil, fmt.Errorf("failed to count orders: %w", err)
	}

	// Data query
	sortDir := "ASC"
	if params.Sort.Direction == shared.SortDesc {
		sortDir = "DESC"
	}
	sortField := params.Sort.Field
	if sortField == "" {
		sortField = "created_at"
	}

	offset := params.Pagination.Offset()
	query := fmt.Sprintf(
		"SELECT * FROM orders %s ORDER BY %s %s LIMIT $%d OFFSET $%d",
		where, sortField, sortDir, argNum, argNum+1,
	)
	args = append(args, params.Pagination.PageSize, offset)

	var rows []OrderRow
	if err := r.db.SelectContext(ctx, &rows, query, args...); err != nil {
		return nil, fmt.Errorf("failed to find orders: %w", err)
	}

	orders := make([]*order.Order, len(rows))
	for i, row := range rows {
		ord, err := r.toDomain(row)
		if err != nil {
			return nil, err
		}
		orders[i] = ord
	}

	totalPages := int(total) / params.Pagination.PageSize
	if int(total)%params.Pagination.PageSize > 0 {
		totalPages++
	}

	return &order.FindResult{
		Orders:     orders,
		Total:      total,
		Page:       params.Pagination.Page,
		PageSize:   params.Pagination.PageSize,
		TotalPages: totalPages,
		HasMore:    offset+params.Pagination.PageSize < int(total),
	}, nil
}

// Save persists an order
func (r *OrderRepository) Save(ctx context.Context, ord *order.Order) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Upsert order
	orderQuery := `
		INSERT INTO orders (
			id, customer_id, status, total_amount, currency,
			shipping_street, shipping_apartment, shipping_city, shipping_state,
			shipping_postal_code, shipping_country,
			billing_street, billing_city, billing_state,
			billing_postal_code, billing_country, notes, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
		ON CONFLICT (id) DO UPDATE SET
			status = EXCLUDED.status,
			total_amount = EXCLUDED.total_amount,
			notes = EXCLUDED.notes,
			updated_at = EXCLUDED.updated_at
	`

	_, err = tx.ExecContext(ctx, orderQuery,
		ord.ID.String(),
		ord.CustomerID.String(),
		string(ord.Status),
		ord.TotalAmount.Amount,
		ord.TotalAmount.Currency,
		ord.ShippingAddr.Street,
		nullString(ord.ShippingAddr.Apartment),
		ord.ShippingAddr.City,
		ord.ShippingAddr.State,
		ord.ShippingAddr.PostalCode,
		ord.ShippingAddr.Country,
		nullStringFromAddr(ord.BillingAddr, func(a order.Address) string { return a.Street }),
		nullStringFromAddr(ord.BillingAddr, func(a order.Address) string { return a.City }),
		nullStringFromAddr(ord.BillingAddr, func(a order.Address) string { return a.State }),
		nullStringFromAddr(ord.BillingAddr, func(a order.Address) string { return a.PostalCode }),
		nullStringFromAddr(ord.BillingAddr, func(a order.Address) string { return a.Country }),
		nullString(ord.Notes),
		ord.CreatedAt,
		ord.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to save order: %w", err)
	}

	// Delete existing items
	_, err = tx.ExecContext(ctx, "DELETE FROM order_items WHERE order_id = $1", ord.ID.String())
	if err != nil {
		return fmt.Errorf("failed to delete order items: %w", err)
	}

	// Insert items
	itemQuery := `
		INSERT INTO order_items (
			id, order_id, product_id, product_name, product_sku,
			quantity, unit_price, discount, currency, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	for _, item := range ord.Items {
		_, err = tx.ExecContext(ctx, itemQuery,
			item.ID.String(),
			ord.ID.String(),
			item.ProductID.String(),
			item.ProductName,
			item.ProductSKU,
			item.Quantity,
			item.UnitPrice.Amount,
			item.Discount.Amount,
			item.UnitPrice.Currency,
			time.Now(),
		)
		if err != nil {
			return fmt.Errorf("failed to save order item: %w", err)
		}
	}

	return tx.Commit()
}

// Delete deletes an order
func (r *OrderRepository) Delete(ctx context.Context, id shared.ID) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM orders WHERE id = $1", id.String())
	if err != nil {
		return fmt.Errorf("failed to delete order: %w", err)
	}
	return nil
}

// Exists checks if an order exists
func (r *OrderRepository) Exists(ctx context.Context, id shared.ID) (bool, error) {
	var exists bool
	query := "SELECT EXISTS(SELECT 1 FROM orders WHERE id = $1)"
	if err := r.db.GetContext(ctx, &exists, query, id.String()); err != nil {
		return false, fmt.Errorf("failed to check order existence: %w", err)
	}
	return exists, nil
}

// Count counts orders matching filters
func (r *OrderRepository) Count(ctx context.Context, filters order.FilterParams) (int64, error) {
	query := "SELECT COUNT(*) FROM orders WHERE 1=1"
	args := make([]any, 0)
	argNum := 1

	if !filters.CustomerID.IsEmpty() {
		query += fmt.Sprintf(" AND customer_id = $%d", argNum)
		args = append(args, filters.CustomerID.String())
		argNum++
	}
	if filters.Status != "" {
		query += fmt.Sprintf(" AND status = $%d", argNum)
		args = append(args, string(filters.Status))
	}

	var count int64
	if err := r.db.GetContext(ctx, &count, query, args...); err != nil {
		return 0, fmt.Errorf("failed to count orders: %w", err)
	}
	return count, nil
}

func (r *OrderRepository) findItemsByOrderID(ctx context.Context, orderID string) ([]*order.Item, error) {
	var rows []OrderItemRow
	query := "SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at"
	if err := r.db.SelectContext(ctx, &rows, query, orderID); err != nil {
		return nil, fmt.Errorf("failed to find order items: %w", err)
	}

	items := make([]*order.Item, len(rows))
	for i, row := range rows {
		items[i] = &order.Item{
			ID:          shared.ID(row.ID),
			ProductID:   shared.ID(row.ProductID),
			ProductName: row.ProductName,
			ProductSKU:  row.ProductSKU,
			Quantity:    row.Quantity,
			UnitPrice:   order.Money{Amount: row.UnitPrice, Currency: row.Currency},
			Discount:    order.Money{Amount: row.Discount, Currency: row.Currency},
		}
	}
	return items, nil
}

func (r *OrderRepository) toDomain(row OrderRow) (*order.Order, error) {
	shippingAddr := order.Address{
		Street:     row.ShippingStreet,
		Apartment:  row.ShippingApartment.String,
		City:       row.ShippingCity,
		State:      row.ShippingState,
		PostalCode: row.ShippingPostalCode,
		Country:    row.ShippingCountry,
	}

	var billingAddr *order.Address
	if row.BillingStreet.Valid {
		billingAddr = &order.Address{
			Street:     row.BillingStreet.String,
			City:       row.BillingCity.String,
			State:      row.BillingState.String,
			PostalCode: row.BillingPostalCode.String,
			Country:    row.BillingCountry.String,
		}
	}

	return &order.Order{
		ID:           shared.ID(row.ID),
		CustomerID:   shared.ID(row.CustomerID),
		Status:       order.Status(row.Status),
		TotalAmount:  order.Money{Amount: row.TotalAmount, Currency: row.Currency},
		ShippingAddr: shippingAddr,
		BillingAddr:  billingAddr,
		Notes:        row.Notes.String,
		CreatedAt:    row.CreatedAt,
		UpdatedAt:    row.UpdatedAt,
	}, nil
}

func nullString(s string) sql.NullString {
	if s == "" {
		return sql.NullString{Valid: false}
	}
	return sql.NullString{String: s, Valid: true}
}

func nullStringFromAddr(addr *order.Address, get func(order.Address) string) sql.NullString {
	if addr == nil {
		return sql.NullString{Valid: false}
	}
	return nullString(get(*addr))
}
