/// Order aggregate root.
///
/// Rust idioms applied:
/// - `enum` for state machine (exhaustive matching enforced by compiler)
/// - Methods return `DomainResult<()>` for business rule violations
/// - `Vec<DomainEvent>` collected internally, drained by caller
/// - Private fields, public methods — encapsulation via module visibility
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::event::DomainEvent;
use crate::domain::money::{Currency, Money};

const MAX_ITEMS: usize = 50;
const MAX_QTY: i32 = 999;

// ---------------------------------------------------------------------------
// Status — exhaustive enum, the compiler guarantees all arms are handled
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Status {
    Draft,
    Confirmed,
    Shipped,
    Delivered,
    Cancelled,
}

impl Status {
    fn can_transition_to(&self, target: Status) -> bool {
        matches!(
            (self, target),
            (Status::Draft, Status::Confirmed)
                | (Status::Draft, Status::Cancelled)
                | (Status::Confirmed, Status::Shipped)
                | (Status::Confirmed, Status::Cancelled)
                | (Status::Shipped, Status::Delivered)
        )
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Status::Draft => "DRAFT",
            Status::Confirmed => "CONFIRMED",
            Status::Shipped => "SHIPPED",
            Status::Delivered => "DELIVERED",
            Status::Cancelled => "CANCELLED",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "DRAFT" => Some(Status::Draft),
            "CONFIRMED" => Some(Status::Confirmed),
            "SHIPPED" => Some(Status::Shipped),
            "DELIVERED" => Some(Status::Delivered),
            "CANCELLED" => Some(Status::Cancelled),
            _ => None,
        }
    }
}

impl std::fmt::Display for Status {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

// ---------------------------------------------------------------------------
// Line Item — value object, Clone + derive
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct LineItem {
    pub product_id: String,
    pub product_name: String,
    pub quantity: i32,
    pub unit_price: Money,
}

impl LineItem {
    pub fn line_total(&self) -> Money {
        self.unit_price.multiply(self.quantity)
    }
}

// ---------------------------------------------------------------------------
// Order aggregate root
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct Order {
    id: Uuid,
    customer_id: String,
    status: Status,
    items: Vec<LineItem>,
    currency: Currency,
    shipping_address: Option<String>,
    tracking_number: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    version: i32,
    events: Vec<DomainEvent>,
}

impl Order {
    // --- Factory ---

    /// Create a new draft order. This is the only public constructor.
    pub fn new(customer_id: impl Into<String>, currency: Currency) -> Self {
        let id = Uuid::new_v4();
        let customer_id = customer_id.into();
        let now = Utc::now();

        let mut order = Self {
            id,
            customer_id: customer_id.clone(),
            status: Status::Draft,
            items: Vec::new(),
            currency,
            shipping_address: None,
            tracking_number: None,
            created_at: now,
            updated_at: now,
            version: 0,
            events: Vec::new(),
        };

        order.record(
            DomainEvent::new("order.created", id.to_string())
                .with("customer_id", &customer_id)
                .with("currency", currency.to_string()),
        );

        order
    }

    /// Reconstitute from persistence (no validation, no events).
    pub fn reconstitute(
        id: Uuid,
        customer_id: String,
        status: Status,
        items: Vec<LineItem>,
        currency: Currency,
        shipping_address: Option<String>,
        tracking_number: Option<String>,
        created_at: DateTime<Utc>,
        updated_at: DateTime<Utc>,
        version: i32,
    ) -> Self {
        Self {
            id, customer_id, status, items, currency,
            shipping_address, tracking_number,
            created_at, updated_at, version,
            events: Vec::new(),
        }
    }

    // --- Getters ---

    pub fn id(&self) -> Uuid { self.id }
    pub fn customer_id(&self) -> &str { &self.customer_id }
    pub fn status(&self) -> Status { self.status }
    pub fn items(&self) -> &[LineItem] { &self.items }
    pub fn currency(&self) -> Currency { self.currency }
    pub fn shipping_address(&self) -> Option<&str> { self.shipping_address.as_deref() }
    pub fn tracking_number(&self) -> Option<&str> { self.tracking_number.as_deref() }
    pub fn created_at(&self) -> DateTime<Utc> { self.created_at }
    pub fn updated_at(&self) -> DateTime<Utc> { self.updated_at }
    pub fn version(&self) -> i32 { self.version }
    pub fn is_empty(&self) -> bool { self.items.is_empty() }

    pub fn item_count(&self) -> i32 {
        self.items.iter().map(|i| i.quantity).sum()
    }

    pub fn total_amount(&self) -> Money {
        self.items
            .iter()
            .fold(Money::zero(self.currency), |acc, item| {
                acc.add(item.line_total()).unwrap_or(acc)
            })
    }

    /// Drain and return all pending domain events.
    pub fn drain_events(&mut self) -> Vec<DomainEvent> {
        std::mem::take(&mut self.events)
    }

    // --- Commands ---

    pub fn add_item(&mut self, item: LineItem) -> DomainResult<()> {
        if self.status != Status::Draft {
            return Err(DomainError::OrderNotDraft);
        }
        if self.items.len() >= MAX_ITEMS {
            return Err(DomainError::MaxItemsExceeded(MAX_ITEMS));
        }
        if item.quantity <= 0 || item.quantity > MAX_QTY {
            return Err(DomainError::InvalidQuantity(format!(
                "must be 1-{MAX_QTY}"
            )));
        }

        // Merge duplicate products
        if let Some(existing) = self.items.iter_mut().find(|i| i.product_id == item.product_id) {
            let new_qty = existing.quantity + item.quantity;
            if new_qty > MAX_QTY {
                return Err(DomainError::InvalidQuantity(format!(
                    "combined would exceed {MAX_QTY}"
                )));
            }
            existing.quantity = new_qty;
        } else {
            self.items.push(item.clone());
        }

        self.touch();
        self.record(
            DomainEvent::new("order.item_added", self.id.to_string())
                .with("product_id", &item.product_id)
                .with("quantity", item.quantity),
        );
        Ok(())
    }

    pub fn remove_item(&mut self, product_id: &str) -> DomainResult<()> {
        if self.status != Status::Draft {
            return Err(DomainError::OrderNotDraft);
        }
        let pos = self
            .items
            .iter()
            .position(|i| i.product_id == product_id)
            .ok_or_else(|| DomainError::ItemNotFound(product_id.to_string()))?;

        self.items.remove(pos);
        self.touch();
        self.record(
            DomainEvent::new("order.item_removed", self.id.to_string())
                .with("product_id", product_id),
        );
        Ok(())
    }

    pub fn confirm(&mut self, shipping_address: impl Into<String>) -> DomainResult<()> {
        if self.is_empty() {
            return Err(DomainError::EmptyOrder);
        }
        let addr = shipping_address.into();
        if addr.trim().is_empty() {
            return Err(DomainError::MissingAddress);
        }
        self.transition_to(Status::Confirmed)?;
        self.shipping_address = Some(addr);
        self.record(DomainEvent::new("order.confirmed", self.id.to_string()));
        Ok(())
    }

    pub fn ship(&mut self, tracking_number: impl Into<String>) -> DomainResult<()> {
        let tracking = tracking_number.into();
        if tracking.trim().is_empty() {
            return Err(DomainError::MissingTracking);
        }
        self.transition_to(Status::Shipped)?;
        self.tracking_number = Some(tracking.clone());
        self.record(
            DomainEvent::new("order.shipped", self.id.to_string())
                .with("tracking_number", &tracking),
        );
        Ok(())
    }

    pub fn deliver(&mut self) -> DomainResult<()> {
        self.transition_to(Status::Delivered)?;
        self.record(DomainEvent::new("order.delivered", self.id.to_string()));
        Ok(())
    }

    pub fn cancel(&mut self, reason: impl Into<String>) -> DomainResult<()> {
        let reason = reason.into();
        if reason.trim().is_empty() {
            return Err(DomainError::MissingReason);
        }
        self.transition_to(Status::Cancelled)?;
        self.record(
            DomainEvent::new("order.cancelled", self.id.to_string())
                .with("reason", &reason),
        );
        Ok(())
    }

    // --- Private ---

    fn transition_to(&mut self, target: Status) -> DomainResult<()> {
        if !self.status.can_transition_to(target) {
            return Err(DomainError::InvalidTransition {
                from: self.status.to_string(),
                to: target.to_string(),
            });
        }
        self.status = target;
        self.touch();
        Ok(())
    }

    fn touch(&mut self) {
        self.updated_at = Utc::now();
        self.version += 1;
    }

    fn record(&mut self, event: DomainEvent) {
        self.events.push(event);
    }
}

// ---------------------------------------------------------------------------
// Repository trait — async, object-safe, defined where consumed
// ---------------------------------------------------------------------------

/// Rust idiom: `async_trait` is no longer needed with RPITIT in Rust 1.75+.
/// We use `-> impl Future` or just `async fn` in traits (stabilized).
/// For object safety with `dyn`, we still need `#[async_trait]` or boxed futures.
/// Using `async fn` in trait directly (Rust 1.75+).
pub trait OrderRepository: Send + Sync {
    fn find_by_id(
        &self,
        id: Uuid,
    ) -> impl std::future::Future<Output = anyhow::Result<Option<Order>>> + Send;

    fn find_by_customer(
        &self,
        customer_id: &str,
        page: i64,
        page_size: i64,
    ) -> impl std::future::Future<Output = anyhow::Result<(Vec<Order>, i64)>> + Send;

    fn find_by_status(
        &self,
        status: Status,
        page: i64,
        page_size: i64,
    ) -> impl std::future::Future<Output = anyhow::Result<(Vec<Order>, i64)>> + Send;

    fn save(
        &self,
        order: &Order,
    ) -> impl std::future::Future<Output = anyhow::Result<()>> + Send;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn make_item(product_id: &str, qty: i32) -> LineItem {
        LineItem {
            product_id: product_id.to_string(),
            product_name: "Test Product".to_string(),
            quantity: qty,
            unit_price: Money::new(1500, Currency::Usd).unwrap(),
        }
    }

    #[test]
    fn new_order_is_draft() {
        let o = Order::new("cust-1", Currency::Usd);
        assert_eq!(o.status(), Status::Draft);
        assert!(o.is_empty());
    }

    #[test]
    fn add_item() {
        let mut o = Order::new("cust-1", Currency::Usd);
        o.add_item(make_item("p1", 2)).unwrap();
        assert_eq!(o.item_count(), 2);
        assert_eq!(o.items().len(), 1);
    }

    #[test]
    fn merge_duplicates() {
        let mut o = Order::new("cust-1", Currency::Usd);
        o.add_item(make_item("p1", 3)).unwrap();
        o.add_item(make_item("p1", 2)).unwrap();
        assert_eq!(o.items().len(), 1);
        assert_eq!(o.items()[0].quantity, 5);
    }

    #[test]
    fn total_amount() {
        let mut o = Order::new("cust-1", Currency::Usd);
        o.add_item(make_item("p1", 2)).unwrap(); // 3000
        o.add_item(make_item("p2", 1)).unwrap(); // 1500
        assert_eq!(o.total_amount().amount(), 4500);
    }

    #[test]
    fn confirm_order() {
        let mut o = Order::new("cust-1", Currency::Usd);
        o.add_item(make_item("p1", 1)).unwrap();
        o.confirm("123 Main St").unwrap();
        assert_eq!(o.status(), Status::Confirmed);
    }

    #[test]
    fn cannot_confirm_empty() {
        let mut o = Order::new("cust-1", Currency::Usd);
        assert_eq!(o.confirm("addr"), Err(DomainError::EmptyOrder));
    }

    #[test]
    fn cannot_add_to_confirmed() {
        let mut o = Order::new("cust-1", Currency::Usd);
        o.add_item(make_item("p1", 1)).unwrap();
        o.confirm("addr").unwrap();
        assert_eq!(o.add_item(make_item("p2", 1)), Err(DomainError::OrderNotDraft));
    }

    #[test]
    fn full_lifecycle() {
        let mut o = Order::new("cust-1", Currency::Usd);
        o.add_item(make_item("p1", 1)).unwrap();
        o.confirm("123 Main St").unwrap();
        o.ship("TRACK-123").unwrap();
        o.deliver().unwrap();
        assert_eq!(o.status(), Status::Delivered);
    }

    #[test]
    fn invalid_transitions() {
        let mut o = Order::new("cust-1", Currency::Usd);
        o.add_item(make_item("p1", 1)).unwrap();
        // Cannot ship a draft
        assert!(o.ship("T-1").is_err());
        // Cannot deliver a draft
        assert!(o.deliver().is_err());
    }

    #[test]
    fn cancel_from_draft() {
        let mut o = Order::new("cust-1", Currency::Usd);
        o.add_item(make_item("p1", 1)).unwrap();
        o.cancel("changed mind").unwrap();
        assert_eq!(o.status(), Status::Cancelled);
    }

    #[test]
    fn cannot_cancel_shipped() {
        let mut o = Order::new("cust-1", Currency::Usd);
        o.add_item(make_item("p1", 1)).unwrap();
        o.confirm("addr").unwrap();
        o.ship("T-1").unwrap();
        assert!(o.cancel("too late").is_err());
    }

    #[test]
    fn events_emitted() {
        let mut o = Order::new("cust-1", Currency::Usd);
        o.add_item(make_item("p1", 1)).unwrap();
        o.confirm("addr").unwrap();

        let events = o.drain_events();
        let types: Vec<&str> = events.iter().map(|e| e.event_type.as_str()).collect();
        assert!(types.contains(&"order.created"));
        assert!(types.contains(&"order.item_added"));
        assert!(types.contains(&"order.confirmed"));
    }

    #[test]
    fn remove_item() {
        let mut o = Order::new("cust-1", Currency::Usd);
        o.add_item(make_item("p1", 1)).unwrap();
        o.add_item(make_item("p2", 1)).unwrap();
        o.remove_item("p1").unwrap();
        assert_eq!(o.items().len(), 1);
        assert_eq!(o.items()[0].product_id, "p2");
    }
}
