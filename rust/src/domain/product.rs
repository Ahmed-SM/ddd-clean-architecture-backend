use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::event::DomainEvent;
use crate::domain::money::Money;

#[derive(Debug, Clone)]
pub struct Product {
    id: Uuid,
    name: String,
    description: String,
    price: Money,
    stock_quantity: i32,
    sku: String,
    active: bool,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    version: i32,
    events: Vec<DomainEvent>,
}

impl Product {
    pub fn new(
        name: impl Into<String>, description: impl Into<String>,
        price: Money, sku: impl Into<String>, initial_stock: i32,
    ) -> DomainResult<Self> {
        let name = name.into();
        if name.trim().len() < 2 || name.len() > 200 { return Err(DomainError::InvalidProductName); }
        if initial_stock < 0 { return Err(DomainError::NegativeStock); }

        let id = Uuid::new_v4();
        let now = Utc::now();
        let sku = sku.into().trim().to_uppercase();
        let mut p = Self {
            id, name: name.trim().to_string(), description: description.into().trim().to_string(),
            price, stock_quantity: initial_stock, sku: sku.clone(),
            active: true, created_at: now, updated_at: now, version: 0,
            events: Vec::new(),
        };
        p.events.push(DomainEvent::new("product.created", id.to_string()).with("sku", &sku));
        Ok(p)
    }

    pub fn reconstitute(
        id: Uuid, name: String, description: String, price: Money,
        stock_quantity: i32, sku: String, active: bool,
        created_at: DateTime<Utc>, updated_at: DateTime<Utc>, version: i32,
    ) -> Self {
        Self { id, name, description, price, stock_quantity, sku, active, created_at, updated_at, version, events: Vec::new() }
    }

    pub fn id(&self) -> Uuid { self.id }
    pub fn name(&self) -> &str { &self.name }
    pub fn description(&self) -> &str { &self.description }
    pub fn price(&self) -> Money { self.price }
    pub fn stock_quantity(&self) -> i32 { self.stock_quantity }
    pub fn sku(&self) -> &str { &self.sku }
    pub fn is_active(&self) -> bool { self.active }
    pub fn in_stock(&self) -> bool { self.stock_quantity > 0 }
    pub fn created_at(&self) -> DateTime<Utc> { self.created_at }
    pub fn updated_at(&self) -> DateTime<Utc> { self.updated_at }
    pub fn version(&self) -> i32 { self.version }
    pub fn drain_events(&mut self) -> Vec<DomainEvent> { std::mem::take(&mut self.events) }

    pub fn adjust_stock(&mut self, qty: i32) -> DomainResult<()> {
        let new_qty = self.stock_quantity + qty;
        if new_qty < 0 {
            return Err(DomainError::InsufficientStock {
                available: self.stock_quantity, requested: -qty,
            });
        }
        self.stock_quantity = new_qty;
        self.touch();
        self.events.push(
            DomainEvent::new("product.stock_adjusted", self.id.to_string())
                .with("adjustment", qty).with("new_quantity", new_qty),
        );
        Ok(())
    }

    pub fn deactivate(&mut self) { self.active = false; self.touch(); }

    fn touch(&mut self) { self.updated_at = Utc::now(); self.version += 1; }
}

pub trait ProductRepository: Send + Sync {
    fn find_by_id(&self, id: Uuid) -> impl std::future::Future<Output = anyhow::Result<Option<Product>>> + Send;
    fn find_by_sku(&self, sku: &str) -> impl std::future::Future<Output = anyhow::Result<Option<Product>>> + Send;
    fn find_active(&self, page: i64, page_size: i64) -> impl std::future::Future<Output = anyhow::Result<(Vec<Product>, i64)>> + Send;
    fn save(&self, product: &Product) -> impl std::future::Future<Output = anyhow::Result<()>> + Send;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::money::Currency;

    fn usd(amount: i64) -> Money {
        Money::new(amount, Currency::Usd).unwrap()
    }

    #[test]
    fn new_product_normalizes_fields_and_emits_event() {
        let mut product = Product::new(
            "  Keyboard  ",
            "  Mechanical keyboard  ",
            usd(15999),
            "  kb-001 ",
            10,
        )
        .unwrap();

        assert_eq!(product.name(), "Keyboard");
        assert_eq!(product.description(), "Mechanical keyboard");
        assert_eq!(product.sku(), "KB-001");
        assert_eq!(product.stock_quantity(), 10);
        assert!(product.is_active());

        let events = product.drain_events();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].event_type, "product.created");
    }

    #[test]
    fn new_product_rejects_bad_name() {
        let result = Product::new("x", "desc", usd(100), "sku-1", 1);
        assert_eq!(result.unwrap_err(), DomainError::InvalidProductName);
    }

    #[test]
    fn new_product_rejects_negative_stock() {
        let result = Product::new("Keyboard", "desc", usd(100), "sku-1", -1);
        assert_eq!(result.unwrap_err(), DomainError::NegativeStock);
    }

    #[test]
    fn adjust_stock_increases_and_decreases() {
        let mut product = Product::new("Keyboard", "desc", usd(100), "sku-1", 5).unwrap();
        product.drain_events();

        product.adjust_stock(3).unwrap();
        assert_eq!(product.stock_quantity(), 8);

        product.adjust_stock(-2).unwrap();
        assert_eq!(product.stock_quantity(), 6);

        let events = product.drain_events();
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].event_type, "product.stock_adjusted");
        assert_eq!(events[1].event_type, "product.stock_adjusted");
    }

    #[test]
    fn adjust_stock_rejects_insufficient_stock() {
        let mut product = Product::new("Keyboard", "desc", usd(100), "sku-1", 2).unwrap();
        let result = product.adjust_stock(-5);
        assert_eq!(
            result.unwrap_err(),
            DomainError::InsufficientStock {
                available: 2,
                requested: 5
            }
        );
    }

    #[test]
    fn deactivate_marks_inactive() {
        let mut product = Product::new("Keyboard", "desc", usd(100), "sku-1", 2).unwrap();
        product.deactivate();
        assert!(!product.is_active());
    }
}
