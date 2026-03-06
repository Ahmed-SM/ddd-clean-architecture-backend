/// Domain errors using `thiserror` — the Rust community standard.
///
/// Each variant is a specific business rule violation.
/// Callers pattern-match on variants, not string codes.
use thiserror::Error;

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum DomainError {
    // Order errors
    #[error("order is not in draft status")]
    OrderNotDraft,
    #[error("order has no items")]
    EmptyOrder,
    #[error("invalid state transition: {from} → {to}")]
    InvalidTransition { from: String, to: String },
    #[error("item not found: {0}")]
    ItemNotFound(String),
    #[error("maximum {0} items exceeded")]
    MaxItemsExceeded(usize),
    #[error("invalid quantity: {0}")]
    InvalidQuantity(String),
    #[error("shipping address is required")]
    MissingAddress,
    #[error("tracking number is required")]
    MissingTracking,
    #[error("cancellation reason is required")]
    MissingReason,

    // Money errors
    #[error("currency mismatch: {0} vs {1}")]
    CurrencyMismatch(String, String),
    #[error("amount cannot be negative")]
    NegativeAmount,
    #[error("insufficient funds")]
    InsufficientFunds,

    // Customer errors
    #[error("invalid email: {0}")]
    InvalidEmail(String),
    #[error("name must be at least 2 characters")]
    InvalidName,
    #[error("customer is not active")]
    CustomerNotActive,
    #[error("email already registered: {0}")]
    DuplicateEmail(String),

    // Product errors
    #[error("product name must be 2-200 characters")]
    InvalidProductName,
    #[error("stock cannot be negative")]
    NegativeStock,
    #[error("insufficient stock: have {available}, need {requested}")]
    InsufficientStock { available: i32, requested: i32 },
    #[error("product is inactive")]
    ProductInactive,
    #[error("SKU already exists: {0}")]
    DuplicateSku(String),

    // Generic
    #[error("{0} not found")]
    NotFound(String),
}

/// Type alias used throughout the domain.
pub type DomainResult<T> = Result<T, DomainError>;
