// Package server provides HTTP handlers
package server

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/enterprise/ddd-clean-architecture/internal/domain/order"
	"github.com/enterprise/ddd-clean-architecture/internal/domain/shared"
	"github.com/enterprise/ddd-clean-architecture/pkg/errors"
	"github.com/enterprise/ddd-clean-architecture/pkg/logger"
	"github.com/enterprise/ddd-clean-architecture/pkg/validator"
	"github.com/gorilla/mux"
)

// OrderHandler handles order HTTP requests
type OrderHandler struct {
	orderRepo order.Repository
	log       *logger.Logger
}

// NewOrderHandler creates a new order handler
func NewOrderHandler(orderRepo order.Repository, log *logger.Logger) *OrderHandler {
	return &OrderHandler{
		orderRepo: orderRepo,
		log:       log,
	}
}

// CreateOrderRequest represents create order request body
type CreateOrderRequest struct {
	CustomerID string                 `json:"customerId"`
	Items      []CreateOrderItemReq   `json:"items"`
	Shipping   AddressRequest         `json:"shippingAddress"`
	Billing    *AddressRequest        `json:"billingAddress,omitempty"`
	Notes      string                 `json:"notes,omitempty"`
}

// CreateOrderItemReq represents create order item request
type CreateOrderItemReq struct {
	ProductID string `json:"productId"`
	Quantity  int    `json:"quantity"`
}

// AddressRequest represents address request body
type AddressRequest struct {
	Street     string `json:"street"`
	Apartment  string `json:"apartment,omitempty"`
	City       string `json:"city"`
	State      string `json:"state"`
	PostalCode string `json:"postalCode"`
	Country    string `json:"country"`
}

// createOrder handles POST /orders
func (s *Server) createOrder(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req CreateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_JSON", "Invalid request body")
		return
	}

	// Validate
	v := validator.New()
	v.Required("customerId", req.CustomerID)
	v.UUID("customerId", req.CustomerID)

	if len(req.Items) == 0 {
		v.AddError("items", "at least one item is required")
	}

	for i, item := range req.Items {
		prefix := "items[" + strconv.Itoa(i) + "]"
		v.UUID(prefix+".productId", item.ProductID)
		v.Positive(prefix+".quantity", item.Quantity)
	}

	v.Required("shippingAddress.street", req.Shipping.Street)
	v.Required("shippingAddress.city", req.Shipping.City)
	v.Required("shippingAddress.state", req.Shipping.State)
	v.Required("shippingAddress.postalCode", req.Shipping.PostalCode)
	v.Required("shippingAddress.country", req.Shipping.Country)

	if v.HasErrors() {
		respondJSON(w, http.StatusBadRequest, map[string]any{
			"success": false,
			"error": map[string]any{
				"code":    "VALIDATION_ERROR",
				"message": "Validation failed",
				"errors":  v.Errors(),
			},
		})
		return
	}

	// Create order (simplified - would normally fetch products, validate, etc.)
	shippingAddr, _ := order.NewAddress(
		req.Shipping.Street,
		req.Shipping.City,
		req.Shipping.State,
		req.Shipping.PostalCode,
		req.Shipping.Country,
	)

	customerID, _ := shared.ParseID(req.CustomerID)

	items := make([]*order.Item, len(req.Items))
	for i, itemReq := range req.Items {
		productID, _ := shared.ParseID(itemReq.ProductID)
		unitPrice, _ := order.NewMoney(99.99, "USD") // Would fetch from product
		item, _ := order.NewItem(productID, "Product", "SKU", itemReq.Quantity, unitPrice)
		items[i] = item
	}

	ord, err := order.NewOrder(order.CreateOrderParams{
		CustomerID:   customerID,
		Items:        items,
		ShippingAddr: shippingAddr,
		Notes:        req.Notes,
	})

	if err != nil {
		respondError(w, http.StatusUnprocessableEntity, "BUSINESS_RULE", err.Error())
		return
	}

	if err := s.orderRepo.Save(ctx, ord); err != nil {
		s.log.Error("failed to save order", "error", err)
		respondError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to create order")
		return
	}

	respondJSON(w, http.StatusCreated, map[string]any{
		"success": true,
		"data":    toOrderResponse(ord),
	})
}

// getOrder handles GET /orders/{id}
func (s *Server) getOrder(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	id := vars["id"]

	v := validator.New()
	v.UUID("id", id)
	if v.HasErrors() {
		respondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid order ID format")
		return
	}

	orderID, _ := shared.ParseID(id)
	ord, err := s.orderRepo.FindByIDWithItems(ctx, orderID)
	if err != nil {
		if err == shared.ErrNotFound {
			respondError(w, http.StatusNotFound, "NOT_FOUND", "Order not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to get order")
		return
	}

	respondJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data":    toOrderResponse(ord),
	})
}

// listOrders handles GET /orders
func (s *Server) listOrders(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	query := r.URL.Query()

	page, _ := strconv.Atoi(query.Get("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(query.Get("pageSize"))
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	sortBy := query.Get("sortBy")
	if sortBy == "" {
		sortBy = "created_at"
	}
	sortDesc := query.Get("sortOrder") == "desc"

	params := order.FindParams{
		Pagination: shared.NewPagination(page, pageSize),
		Sort: shared.Sort{
			Field:     sortBy,
			Direction: shared.SortAsc,
		},
	}
	if sortDesc {
		params.Sort.Direction = shared.SortDesc
	}

	result, err := s.orderRepo.FindPaginated(ctx, params)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to list orders")
		return
	}

	orders := make([]OrderResponse, len(result.Orders))
	for i, ord := range result.Orders {
		orders[i] = toOrderResponse(ord)
	}

	respondJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data":    orders,
		"pagination": map[string]any{
			"page":       result.Page,
			"pageSize":   result.PageSize,
			"total":      result.Total,
			"totalPages": result.TotalPages,
			"hasMore":    result.HasMore,
		},
	})
}

// UpdateStatusRequest represents update status request
type UpdateStatusRequest struct {
	Status string `json:"status"`
	Reason string `json:"reason,omitempty"`
}

// updateStatus handles PUT /orders/{id}/status
func (s *Server) updateStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	id := vars["id"]

	v := validator.New()
	v.UUID("id", id)
	if v.HasErrors() {
		respondError(w, http.StatusBadRequest, "INVALID_ID", "Invalid order ID format")
		return
	}

	var req UpdateStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_JSON", "Invalid request body")
		return
	}

	v.Required("status", req.Status)
	v.In("status", req.Status, "pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded")
	if v.HasErrors() {
		respondJSON(w, http.StatusBadRequest, map[string]any{
			"success": false,
			"error": map[string]any{
				"code":    "VALIDATION_ERROR",
				"message": "Validation failed",
				"errors":  v.Errors(),
			},
		})
		return
	}

	orderID, _ := shared.ParseID(id)
	ord, err := s.orderRepo.FindByIDWithItems(ctx, orderID)
	if err != nil {
		if err == shared.ErrNotFound {
			respondError(w, http.StatusNotFound, "NOT_FOUND", "Order not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to get order")
		return
	}

	status := order.Status(req.Status)
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
		err = ord.Cancel(req.Reason)
	case order.StatusRefunded:
		err = ord.Refund(req.Reason)
	default:
		err = &errors.AppError{Code: "INVALID_STATUS", Message: "Invalid status transition"}
	}

	if err != nil {
		respondError(w, http.StatusUnprocessableEntity, "BUSINESS_RULE", err.Error())
		return
	}

	if err := s.orderRepo.Save(ctx, ord); err != nil {
		respondError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to update order")
		return
	}

	respondJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data":    toOrderResponse(ord),
	})
}

// OrderResponse represents order response
type OrderResponse struct {
	ID          string             `json:"id"`
	CustomerID  string             `json:"customerId"`
	Status      string             `json:"status"`
	TotalAmount float64            `json:"totalAmount"`
	Currency    string             `json:"currency"`
	Items       []OrderItemResponse `json:"items"`
	Notes       string             `json:"notes"`
	ItemCount   int                `json:"itemCount"`
	CreatedAt   string             `json:"createdAt"`
	UpdatedAt   string             `json:"updatedAt"`
}

// OrderItemResponse represents order item response
type OrderItemResponse struct {
	ID          string  `json:"id"`
	ProductID   string  `json:"productId"`
	ProductName string  `json:"productName"`
	Quantity    int     `json:"quantity"`
	UnitPrice   float64 `json:"unitPrice"`
	Subtotal    float64 `json:"subtotal"`
}

func toOrderResponse(ord *order.Order) OrderResponse {
	items := make([]OrderItemResponse, len(ord.Items))
	for i, item := range ord.Items {
		items[i] = OrderItemResponse{
			ID:          item.ID.String(),
			ProductID:   item.ProductID.String(),
			ProductName: item.ProductName,
			Quantity:    item.Quantity,
			UnitPrice:   item.UnitPrice.Amount,
			Subtotal:    item.Subtotal().Amount,
		}
	}

	return OrderResponse{
		ID:          ord.ID.String(),
		CustomerID:  ord.CustomerID.String(),
		Status:      string(ord.Status),
		TotalAmount: ord.TotalAmount.Amount,
		Currency:    ord.TotalAmount.Currency,
		Items:       items,
		Notes:       ord.Notes,
		ItemCount:   ord.ItemCount(),
		CreatedAt:   ord.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   ord.UpdatedAt.Format(time.RFC3339),
	}
}
