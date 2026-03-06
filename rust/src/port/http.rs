/// HTTP API using Axum — Rust community's preferred async web framework.
///
/// Rust idioms:
/// - `State<Arc<AppState>>` for shared state (Send + Sync guaranteed by compiler)
/// - `Json<T>` extractors for request/response
/// - `impl IntoResponse` for flexible return types
/// - `thiserror` + `From` impl for automatic error conversion
use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::app::{self, Service};
use crate::domain::customer::CustomerRepository;
use crate::domain::error::DomainError;
use crate::domain::order::{Order, OrderRepository};
use crate::domain::product::ProductRepository;

// ---------------------------------------------------------------------------
// App State — shared across all handlers via Arc
// ---------------------------------------------------------------------------

pub struct AppState<O, C, P, E>
where O: OrderRepository, C: CustomerRepository, P: ProductRepository, E: app::EventPublisher,
{
    pub svc: Service<O, C, P, E>,
}

// ---------------------------------------------------------------------------
// Error response
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct ErrorBody {
    success: bool,
    error: ErrorDetail,
}

#[derive(Serialize)]
struct ErrorDetail {
    message: String,
}

/// Convert `anyhow::Error` into an Axum response.
struct AppError(anyhow::Error);

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let err = self.0;

        // Try to downcast to DomainError for specific status codes
        let (status, message) = if let Some(de) = err.downcast_ref::<DomainError>() {
            let status = match de {
                DomainError::OrderNotDraft | DomainError::InvalidTransition { .. }
                | DomainError::DuplicateEmail(_) | DomainError::DuplicateSku(_)
                | DomainError::InsufficientStock { .. } => StatusCode::CONFLICT,

                DomainError::EmptyOrder | DomainError::InvalidQuantity(_)
                | DomainError::MissingAddress | DomainError::MissingTracking
                | DomainError::MissingReason | DomainError::InvalidEmail(_)
                | DomainError::InvalidName | DomainError::InvalidProductName
                | DomainError::NegativeAmount | DomainError::NegativeStock
                | DomainError::CurrencyMismatch(_, _) => StatusCode::BAD_REQUEST,

                DomainError::CustomerNotActive | DomainError::ProductInactive => StatusCode::FORBIDDEN,
                DomainError::NotFound(_) => StatusCode::NOT_FOUND,

                _ => StatusCode::INTERNAL_SERVER_ERROR,
            };
            (status, de.to_string())
        } else {
            // Check for "not found" in message
            let msg = err.to_string();
            if msg.contains("not found") {
                (StatusCode::NOT_FOUND, msg)
            } else {
                tracing::error!(%err, "unhandled error");
                (StatusCode::INTERNAL_SERVER_ERROR, "internal server error".to_string())
            }
        };

        (status, Json(ErrorBody { success: false, error: ErrorDetail { message } })).into_response()
    }
}

impl<E: Into<anyhow::Error>> From<E> for AppError {
    fn from(err: E) -> Self { AppError(err.into()) }
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct ApiResponse<T: Serialize> {
    success: bool,
    data: T,
}

fn ok_json<T: Serialize>(data: T) -> impl IntoResponse {
    Json(ApiResponse { success: true, data })
}

fn created_json<T: Serialize>(data: T) -> impl IntoResponse {
    (StatusCode::CREATED, Json(ApiResponse { success: true, data }))
}

#[derive(Serialize)]
struct OrderDto {
    id: String, customer_id: String, status: String, currency: String,
    total_amount_cents: i64, total_display: f64, item_count: i32,
    items: Vec<ItemDto>,
    shipping_address: Option<String>, tracking_number: Option<String>,
    created_at: String, updated_at: String,
}

#[derive(Serialize)]
struct ItemDto {
    product_id: String, product_name: String, quantity: i32,
    unit_price_cents: i64, line_total_cents: i64,
}

fn to_order_dto(o: &Order) -> OrderDto {
    OrderDto {
        id: o.id().to_string(), customer_id: o.customer_id().to_string(),
        status: o.status().as_str().to_string(), currency: o.currency().to_string(),
        total_amount_cents: o.total_amount().amount(), total_display: o.total_amount().display_amount(),
        item_count: o.item_count(),
        items: o.items().iter().map(|i| ItemDto {
            product_id: i.product_id.clone(), product_name: i.product_name.clone(),
            quantity: i.quantity, unit_price_cents: i.unit_price.amount(),
            line_total_cents: i.line_total().amount(),
        }).collect(),
        shipping_address: o.shipping_address().map(String::from),
        tracking_number: o.tracking_number().map(String::from),
        created_at: o.created_at().to_rfc3339(), updated_at: o.updated_at().to_rfc3339(),
    }
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct PaginationParams {
    #[serde(default = "default_page")]
    page: i64,
    #[serde(default = "default_page_size")]
    page_size: i64,
}
fn default_page() -> i64 { 1 }
fn default_page_size() -> i64 { 20 }

#[derive(Deserialize)]
struct StatusFilter {
    #[serde(default = "default_status")]
    status: String,
}
fn default_status() -> String { "DRAFT".to_string() }

#[derive(Serialize)]
struct PaginatedResponse<T: Serialize> {
    items: Vec<T>, total: i64, page: i64, page_size: i64, total_pages: i64,
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

pub fn routes<O, C, P, E>(state: Arc<AppState<O, C, P, E>>) -> Router
where
    O: OrderRepository + 'static,
    C: CustomerRepository + 'static,
    P: ProductRepository + 'static,
    E: app::EventPublisher + 'static,
{
    Router::new()
        .route("/health", get(health))
        .route("/api/v1/orders", post(create_order::<O, C, P, E>).get(list_orders::<O, C, P, E>))
        .route("/api/v1/orders/{id}", get(get_order::<O, C, P, E>))
        .route("/api/v1/orders/{id}/confirm", post(confirm_order::<O, C, P, E>))
        .route("/api/v1/orders/{id}/ship", post(ship_order::<O, C, P, E>))
        .route("/api/v1/orders/{id}/cancel", post(cancel_order::<O, C, P, E>))
        .route("/api/v1/customers", post(create_customer::<O, C, P, E>))
        .route("/api/v1/customers/{id}", get(get_customer::<O, C, P, E>))
        .route("/api/v1/products", post(create_product::<O, C, P, E>).get(list_products::<O, C, P, E>))
        .with_state(state)
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async fn health() -> impl IntoResponse {
    ok_json(serde_json::json!({ "status": "healthy" }))
}

async fn create_order<O: OrderRepository, C: CustomerRepository, P: ProductRepository, E: app::EventPublisher>(
    State(state): State<Arc<AppState<O, C, P, E>>>,
    Json(req): Json<app::CreateOrderReq>,
) -> Result<impl IntoResponse, AppError> {
    let order = state.svc.create_order(req).await?;
    Ok(created_json(to_order_dto(&order)))
}

async fn get_order<O: OrderRepository, C: CustomerRepository, P: ProductRepository, E: app::EventPublisher>(
    State(state): State<Arc<AppState<O, C, P, E>>>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let order = state.svc.get_order(id).await?;
    Ok(ok_json(to_order_dto(&order)))
}

async fn list_orders<O: OrderRepository, C: CustomerRepository, P: ProductRepository, E: app::EventPublisher>(
    State(state): State<Arc<AppState<O, C, P, E>>>,
    Query(filter): Query<StatusFilter>,
    Query(pg): Query<PaginationParams>,
) -> Result<impl IntoResponse, AppError> {
    let (orders, total) = state.svc.get_orders_by_status(&filter.status, pg.page, pg.page_size).await?;
    let dtos: Vec<OrderDto> = orders.iter().map(to_order_dto).collect();
    let total_pages = (total + pg.page_size - 1) / pg.page_size;
    Ok(ok_json(PaginatedResponse { items: dtos, total, page: pg.page, page_size: pg.page_size, total_pages }))
}

async fn confirm_order<O: OrderRepository, C: CustomerRepository, P: ProductRepository, E: app::EventPublisher>(
    State(state): State<Arc<AppState<O, C, P, E>>>,
    Path(id): Path<Uuid>,
    Json(req): Json<app::ConfirmOrderReq>,
) -> Result<impl IntoResponse, AppError> {
    let order = state.svc.confirm_order(id, req).await?;
    Ok(ok_json(to_order_dto(&order)))
}

async fn ship_order<O: OrderRepository, C: CustomerRepository, P: ProductRepository, E: app::EventPublisher>(
    State(state): State<Arc<AppState<O, C, P, E>>>,
    Path(id): Path<Uuid>,
    Json(req): Json<app::ShipOrderReq>,
) -> Result<impl IntoResponse, AppError> {
    let order = state.svc.ship_order(id, req).await?;
    Ok(ok_json(to_order_dto(&order)))
}

async fn cancel_order<O: OrderRepository, C: CustomerRepository, P: ProductRepository, E: app::EventPublisher>(
    State(state): State<Arc<AppState<O, C, P, E>>>,
    Path(id): Path<Uuid>,
    Json(req): Json<app::CancelOrderReq>,
) -> Result<impl IntoResponse, AppError> {
    let order = state.svc.cancel_order(id, req).await?;
    Ok(ok_json(to_order_dto(&order)))
}

async fn create_customer<O: OrderRepository, C: CustomerRepository, P: ProductRepository, E: app::EventPublisher>(
    State(state): State<Arc<AppState<O, C, P, E>>>,
    Json(req): Json<app::CreateCustomerReq>,
) -> Result<impl IntoResponse, AppError> {
    let c = state.svc.create_customer(req).await?;
    Ok(created_json(serde_json::json!({
        "id": c.id().to_string(), "name": c.name(), "email": c.email(),
        "status": c.status().as_str(), "order_count": c.order_count(),
        "created_at": c.created_at().to_rfc3339(), "updated_at": c.updated_at().to_rfc3339(),
    })))
}

async fn get_customer<O: OrderRepository, C: CustomerRepository, P: ProductRepository, E: app::EventPublisher>(
    State(state): State<Arc<AppState<O, C, P, E>>>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let c = state.svc.get_customer(id).await?;
    Ok(ok_json(serde_json::json!({
        "id": c.id().to_string(), "name": c.name(), "email": c.email(),
        "status": c.status().as_str(), "order_count": c.order_count(),
    })))
}

async fn create_product<O: OrderRepository, C: CustomerRepository, P: ProductRepository, E: app::EventPublisher>(
    State(state): State<Arc<AppState<O, C, P, E>>>,
    Json(req): Json<app::CreateProductReq>,
) -> Result<impl IntoResponse, AppError> {
    let p = state.svc.create_product(req).await?;
    Ok(created_json(serde_json::json!({
        "id": p.id().to_string(), "name": p.name(), "sku": p.sku(),
        "price_cents": p.price().amount(), "stock_quantity": p.stock_quantity(),
    })))
}

async fn list_products<O: OrderRepository, C: CustomerRepository, P: ProductRepository, E: app::EventPublisher>(
    State(state): State<Arc<AppState<O, C, P, E>>>,
    Query(pg): Query<PaginationParams>,
) -> Result<impl IntoResponse, AppError> {
    let (products, total) = state.svc.get_active_products(pg.page, pg.page_size).await?;
    let dtos: Vec<serde_json::Value> = products.iter().map(|p| serde_json::json!({
        "id": p.id().to_string(), "name": p.name(), "sku": p.sku(),
        "price_cents": p.price().amount(), "price_display": p.price().display_amount(),
        "stock_quantity": p.stock_quantity(), "in_stock": p.in_stock(),
    })).collect();
    let total_pages = (total + pg.page_size - 1) / pg.page_size;
    Ok(ok_json(PaginatedResponse { items: dtos, total, page: pg.page, page_size: pg.page_size, total_pages }))
}
