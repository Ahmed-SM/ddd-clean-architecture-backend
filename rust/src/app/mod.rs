/// Application service — use cases parameterized by repository traits.
///
/// Rust idiom: generic structs over trait bounds, monomorphized at compile time.
/// No `dyn`, no vtable — zero-cost abstraction.
use anyhow::{Context, Result};
use serde::Deserialize;
use tracing::info;

use crate::domain::customer::{self, Customer, CustomerRepository};
use crate::domain::error::DomainError;
use crate::domain::event::DomainEvent;
use crate::domain::money::{Currency, Money};
use crate::domain::order::{self, LineItem, Order, OrderRepository};
use crate::domain::product::{Product, ProductRepository};

// ---------------------------------------------------------------------------
// Event publisher trait
// ---------------------------------------------------------------------------

pub trait EventPublisher: Send + Sync {
    fn publish(
        &self,
        events: Vec<DomainEvent>,
    ) -> impl std::future::Future<Output = ()> + Send;
}

// ---------------------------------------------------------------------------
// Request DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct CreateOrderReq {
    pub customer_id: String,
    pub currency: String,
    pub items: Vec<CreateOrderItemReq>,
}

#[derive(Debug, Deserialize)]
pub struct CreateOrderItemReq {
    pub product_id: String,
    pub product_name: String,
    pub quantity: i32,
    pub unit_price_cents: i64,
}

#[derive(Debug, Deserialize)]
pub struct ConfirmOrderReq {
    pub shipping_address: String,
}

#[derive(Debug, Deserialize)]
pub struct ShipOrderReq {
    pub tracking_number: String,
}

#[derive(Debug, Deserialize)]
pub struct CancelOrderReq {
    pub reason: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateCustomerReq {
    pub name: String,
    pub email: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateProductReq {
    pub name: String,
    pub description: String,
    pub price_cents: i64,
    pub currency: String,
    pub sku: String,
    pub initial_stock: i32,
}

// ---------------------------------------------------------------------------
// Service — generic over repositories (monomorphized, zero-cost)
// ---------------------------------------------------------------------------

pub struct Service<O, C, P, E>
where
    O: OrderRepository,
    C: CustomerRepository,
    P: ProductRepository,
    E: EventPublisher,
{
    orders: O,
    customers: C,
    products: P,
    events: E,
}

impl<O, C, P, E> Service<O, C, P, E>
where
    O: OrderRepository,
    C: CustomerRepository,
    P: ProductRepository,
    E: EventPublisher,
{
    pub fn new(orders: O, customers: C, products: P, events: E) -> Self {
        Self { orders, customers, products, events }
    }

    // --- Commands ---

    pub async fn create_order(&self, req: CreateOrderReq) -> Result<Order> {
        let cust_uuid = uuid::Uuid::parse_str(&req.customer_id)
            .context("invalid customer_id")?;
        let mut cust = self.customers.find_by_id(cust_uuid).await?
            .ok_or_else(|| anyhow::anyhow!("customer {} not found", req.customer_id))?;

        if !cust.is_active() {
            return Err(DomainError::CustomerNotActive.into());
        }

        let currency = Currency::from_str(&req.currency)
            .ok_or_else(|| anyhow::anyhow!("invalid currency: {}", req.currency))?;

        let mut order = Order::new(&req.customer_id, currency);

        for item in &req.items {
            let price = Money::new(item.unit_price_cents, currency)?;
            order.add_item(LineItem {
                product_id: item.product_id.clone(),
                product_name: item.product_name.clone(),
                quantity: item.quantity,
                unit_price: price,
            })?;
        }

        // Reserve stock
        for item in order.items() {
            let prod_uuid = uuid::Uuid::parse_str(&item.product_id)
                .context("invalid product_id")?;
            let mut prod = self.products.find_by_id(prod_uuid).await?
                .ok_or_else(|| anyhow::anyhow!("product {} not found", item.product_id))?;
            prod.adjust_stock(-item.quantity)?;
            self.products.save(&prod).await?;
        }

        self.orders.save(&order).await?;
        cust.increment_order_count();
        let _ = self.customers.save(&cust).await;

        let events = order.drain_events();
        self.events.publish(events).await;
        info!(order_id = %order.id(), customer_id = %req.customer_id, "order created");
        Ok(order)
    }

    pub async fn confirm_order(&self, id: uuid::Uuid, req: ConfirmOrderReq) -> Result<Order> {
        let mut order = self.must_find_order(id).await?;
        order.confirm(&req.shipping_address)?;
        self.orders.save(&order).await?;
        self.events.publish(order.drain_events()).await;
        Ok(order)
    }

    pub async fn ship_order(&self, id: uuid::Uuid, req: ShipOrderReq) -> Result<Order> {
        let mut order = self.must_find_order(id).await?;
        order.ship(&req.tracking_number)?;
        self.orders.save(&order).await?;
        self.events.publish(order.drain_events()).await;
        Ok(order)
    }

    pub async fn cancel_order(&self, id: uuid::Uuid, req: CancelOrderReq) -> Result<Order> {
        let mut order = self.must_find_order(id).await?;
        order.cancel(&req.reason)?;

        // Release stock (best effort)
        for item in order.items() {
            if let Ok(Some(mut prod)) = self.products
                .find_by_id(uuid::Uuid::parse_str(&item.product_id).unwrap_or_default()).await
            {
                let _ = prod.adjust_stock(item.quantity);
                let _ = self.products.save(&prod).await;
            }
        }

        self.orders.save(&order).await?;
        self.events.publish(order.drain_events()).await;
        Ok(order)
    }

    pub async fn create_customer(&self, req: CreateCustomerReq) -> Result<Customer> {
        if let Some(_) = self.customers.find_by_email(&req.email).await? {
            return Err(DomainError::DuplicateEmail(req.email).into());
        }
        let mut cust = Customer::new(&req.name, &req.email)?;
        self.customers.save(&cust).await?;
        self.events.publish(cust.drain_events()).await;
        info!(customer_id = %cust.id(), "customer created");
        Ok(cust)
    }

    pub async fn create_product(&self, req: CreateProductReq) -> Result<Product> {
        if let Some(_) = self.products.find_by_sku(&req.sku).await? {
            return Err(DomainError::DuplicateSku(req.sku).into());
        }
        let currency = Currency::from_str(&req.currency)
            .ok_or_else(|| anyhow::anyhow!("invalid currency"))?;
        let price = Money::new(req.price_cents, currency)?;
        let mut prod = Product::new(&req.name, &req.description, price, &req.sku, req.initial_stock)?;
        self.products.save(&prod).await?;
        self.events.publish(prod.drain_events()).await;
        Ok(prod)
    }

    // --- Queries ---

    pub async fn get_order(&self, id: uuid::Uuid) -> Result<Order> {
        self.must_find_order(id).await
    }

    pub async fn get_orders_by_status(&self, status: &str, page: i64, page_size: i64) -> Result<(Vec<Order>, i64)> {
        let s = order::Status::from_str(status)
            .ok_or_else(|| anyhow::anyhow!("invalid status: {status}"))?;
        self.orders.find_by_status(s, page, page_size).await
    }

    pub async fn get_customer(&self, id: uuid::Uuid) -> Result<Customer> {
        self.customers.find_by_id(id).await?
            .ok_or_else(|| anyhow::anyhow!("customer not found"))
    }

    pub async fn get_customer_orders(&self, customer_id: &str, page: i64, page_size: i64) -> Result<(Vec<Order>, i64)> {
        self.orders.find_by_customer(customer_id, page, page_size).await
    }

    pub async fn get_active_products(&self, page: i64, page_size: i64) -> Result<(Vec<Product>, i64)> {
        self.products.find_active(page, page_size).await
    }

    // --- Helpers ---

    async fn must_find_order(&self, id: uuid::Uuid) -> Result<Order> {
        self.orders.find_by_id(id).await?
            .ok_or_else(|| anyhow::anyhow!("order {id} not found"))
    }
}
