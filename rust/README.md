# DDD Backend in Rust

Production-grade Domain-Driven Design backend following Rust community idioms and best practices.

## Rust Philosophy Applied

| Principle | How it's applied |
|-----------|-----------------|
| **Ownership model** | Aggregates own their data. `&mut self` for commands, `&self` for queries. `drain_events()` transfers ownership of events via `std::mem::take`. |
| **Exhaustive enums** | `Status` is a Rust enum — the compiler forces you to handle every variant in `match`. No string-based status can slip through unhandled. |
| **`Result<T, E>` everywhere** | Domain methods return `DomainResult<()>`. No panics in business logic, ever. |
| **`thiserror` for domain errors** | Each business rule violation is a typed enum variant with `#[error("...")]`. Callers pattern-match on variants, not string codes. |
| **`anyhow` for infra errors** | Infrastructure uses `anyhow::Result` (erased errors). Domain uses typed `DomainError`. The boundary converts between them. |
| **Newtypes** | `Money` wraps `i64` + `Currency`. `Currency` is an enum, not a string. |
| **`Copy` where appropriate** | `Money` and `Currency` are `Copy` — zero-cost stack values, no heap allocation. |
| **Monomorphization** | `Service<O, C, P, E>` is generic over repository traits. Compiled to concrete types at build time — zero vtable overhead. |
| **`Send + Sync` bounds** | Repository traits require `Send + Sync`, enforced at compile time. Data races are impossible. |
| **No `async_trait` macro** | Uses Rust 1.75+ native `async fn` in traits (RPITIT). |
| **`serde` derives** | DTOs use `#[derive(Serialize, Deserialize)]` — zero-copy where possible. |
| **`sqlx` compile-time queries** | Type-safe SQL. Can optionally verify queries against the real database at compile time. |

## What's NOT here (and why)

- **No `Box<dyn Trait>`** — Monomorphic generics instead. The compiler generates specialized code for each concrete repository type. Zero dynamic dispatch.
- **No `Arc<Mutex<T>>`** for shared state — Axum's `State<Arc<T>>` + `&self` methods mean no interior mutability needed for the service layer.
- **No ORM** — `sqlx` with raw SQL. Rust's type system + `FromRow` derive gives safety without the abstraction cost.
- **No `unwrap()` in business logic** — All domain code uses `?` propagation. `unwrap()` only appears in tests and `reconstitute` (where invalid data means a bug, not a user error).
- **No reflection / runtime type info** — Rust has none. All dispatch is resolved at compile time.

## Project Structure

```
src/
├── main.rs              # Entry point — tokio runtime, composition root
├── domain/              # Pure business logic (no external deps except uuid, chrono)
│   ├── mod.rs
│   ├── error.rs         # DomainError enum (thiserror)
│   ├── event.rs         # DomainEvent struct
│   ├── money.rs         # Money value object (Copy, tests inline)
│   ├── order.rs         # Order aggregate + OrderRepository trait + tests
│   ├── customer.rs      # Customer aggregate + CustomerRepository trait
│   └── product.rs       # Product aggregate + ProductRepository trait
├── app/
│   └── mod.rs           # Service<O,C,P,E> — generic use cases
├── infra/
│   ├── mod.rs
│   ├── postgres.rs      # sqlx implementations of all repository traits
│   └── eventbus.rs      # LogEventBus (tracing-based)
└── port/
    ├── mod.rs
    └── http.rs          # Axum handlers, error conversion, DTOs

migrations/
└── init.sql             # Database schema

Cargo.toml               # Dependencies
Dockerfile               # Multi-stage (scratch final image, ~8MB)
docker-compose.yml       # App + PostgreSQL
```

## Quick Start

```bash
# Docker (recommended)
docker compose up -d --build

# Or locally
cp .env.example .env
cargo run

# Tests (domain is pure, no DB needed)
cargo test
```

## API

```
GET  /health
POST /api/v1/customers
GET  /api/v1/customers/:id
POST /api/v1/products
GET  /api/v1/products
POST /api/v1/orders
GET  /api/v1/orders/:id
GET  /api/v1/orders?status=DRAFT
POST /api/v1/orders/:id/confirm
POST /api/v1/orders/:id/ship
POST /api/v1/orders/:id/cancel
```

## Order State Machine

```
DRAFT → CONFIRMED → SHIPPED → DELIVERED
  ↓         ↓
CANCELLED CANCELLED
```

Enforced at compile time via exhaustive `match` on `Status` enum.

## Docker

Two containers: **App** (scratch, ~8MB) + **PostgreSQL 16**. The Rust binary is statically linked — no libc, no runtime, no shell in the container.

Memory limit: **64MB** (vs 512MB for Node.js, 128MB for Go). Rust's zero-cost abstractions mean minimal runtime overhead.

## Error Handling Strategy

```
Layer           Error Type           Pattern
──────────────  ──────────────────   ────────────────────
Domain          DomainError          thiserror enum, Result<T, DomainError>
Application     anyhow::Error        ? propagation, DomainError auto-converts
HTTP            AppError             impl IntoResponse, downcast to DomainError for status codes
```

## Tech Stack

| What | Why |
|------|-----|
| Rust 1.80 | Latest stable, native async traits |
| Axum 0.8 | Tokio-native, type-safe extractors, community standard |
| sqlx 0.8 | Compile-time checked SQL, async, no ORM |
| thiserror 2 | Ergonomic error enums |
| anyhow 1 | Flexible error propagation in infra/app |
| tokio 1 | Async runtime, industry standard |
| tracing | Structured logging with spans |
| chrono | DateTime handling |
| uuid | UUID v4 generation |
| serde | Serialization framework |
