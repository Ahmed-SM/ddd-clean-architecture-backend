/// Money value object — cents-based, `Copy`, currency-safe.
///
/// Rust idiom: newtype struct with `Copy` (stack-allocated, zero-cost).
/// Implements `Display` and arithmetic via methods (not trait overloads, to keep
/// the currency-mismatch check explicit via `Result`).
use serde::{Deserialize, Serialize};
use std::fmt;

use super::error::{DomainError, DomainResult};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum Currency {
    Usd,
    Eur,
    Gbp,
    Zar,
}

impl fmt::Display for Currency {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Currency::Usd => write!(f, "USD"),
            Currency::Eur => write!(f, "EUR"),
            Currency::Gbp => write!(f, "GBP"),
            Currency::Zar => write!(f, "ZAR"),
        }
    }
}

impl Currency {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_uppercase().as_str() {
            "USD" => Some(Currency::Usd),
            "EUR" => Some(Currency::Eur),
            "GBP" => Some(Currency::Gbp),
            "ZAR" => Some(Currency::Zar),
            _ => None,
        }
    }
}

/// Money is a value object. `Copy` because it's just two machine words.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Money {
    /// Amount in minor units (cents).
    amount: i64,
    currency: Currency,
}

impl Money {
    /// Create from minor units. Errors on negative amount.
    pub fn new(amount: i64, currency: Currency) -> DomainResult<Self> {
        if amount < 0 {
            return Err(DomainError::NegativeAmount);
        }
        Ok(Self { amount, currency })
    }

    /// Convenience: panics on error. Use only in tests.
    #[cfg(test)]
    pub fn must(amount: i64, currency: Currency) -> Self {
        Self::new(amount, currency).expect("invalid money")
    }

    pub fn zero(currency: Currency) -> Self {
        Self { amount: 0, currency }
    }

    pub fn amount(&self) -> i64 {
        self.amount
    }

    pub fn currency(&self) -> Currency {
        self.currency
    }

    pub fn display_amount(&self) -> f64 {
        self.amount as f64 / 100.0
    }

    pub fn is_zero(&self) -> bool {
        self.amount == 0
    }

    pub fn add(&self, other: Money) -> DomainResult<Money> {
        if self.currency != other.currency {
            return Err(DomainError::CurrencyMismatch(
                self.currency.to_string(),
                other.currency.to_string(),
            ));
        }
        Ok(Money {
            amount: self.amount + other.amount,
            currency: self.currency,
        })
    }

    pub fn sub(&self, other: Money) -> DomainResult<Money> {
        if self.currency != other.currency {
            return Err(DomainError::CurrencyMismatch(
                self.currency.to_string(),
                other.currency.to_string(),
            ));
        }
        if self.amount < other.amount {
            return Err(DomainError::InsufficientFunds);
        }
        Ok(Money {
            amount: self.amount - other.amount,
            currency: self.currency,
        })
    }

    pub fn multiply(&self, qty: i32) -> Money {
        Money {
            amount: self.amount * qty as i64,
            currency: self.currency,
        }
    }
}

impl fmt::Display for Money {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:.2} {}", self.display_amount(), self.currency)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_money() {
        let m = Money::new(1500, Currency::Usd).unwrap();
        assert_eq!(m.amount(), 1500);
        assert_eq!(m.display_amount(), 15.0);
    }

    #[test]
    fn reject_negative() {
        assert!(Money::new(-100, Currency::Usd).is_err());
    }

    #[test]
    fn add_same_currency() {
        let a = Money::must(1000, Currency::Usd);
        let b = Money::must(500, Currency::Usd);
        assert_eq!(a.add(b).unwrap().amount(), 1500);
    }

    #[test]
    fn add_different_currency_fails() {
        let usd = Money::must(1000, Currency::Usd);
        let eur = Money::must(500, Currency::Eur);
        assert!(usd.add(eur).is_err());
    }

    #[test]
    fn subtract_insufficient_fails() {
        let a = Money::must(100, Currency::Usd);
        let b = Money::must(500, Currency::Usd);
        assert!(a.sub(b).is_err());
    }

    #[test]
    fn multiply() {
        let m = Money::must(1500, Currency::Usd);
        assert_eq!(m.multiply(3).amount(), 4500);
    }

    #[test]
    fn display() {
        let m = Money::must(1599, Currency::Usd);
        assert_eq!(format!("{m}"), "15.99 USD");
    }
}
