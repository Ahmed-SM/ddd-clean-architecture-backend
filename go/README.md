# DDD Clean Architecture - Go

Enterprise-grade Domain-Driven Design (DDD) backend with Clean Architecture in Go, following Go idioms and community best practices.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│         (HTTP Handlers, Middleware, Routes)                  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                          │
│              (Services, DTOs, Ports)                         │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     DOMAIN LAYER                             │
│    (Entities, Value Objects, Aggregates, Domain Events,     │
│         Repository Interfaces, Domain Services)              │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
┌───────────────────────────┴─────────────────────────────────┐
│                  INFRASTRUCTURE LAYER                        │
│   (Repositories, Database, HTTP Server, External Services)   │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
.
├── cmd/
│   └── server/
│       └── main.go              # Application entry point
├── internal/
│   ├── domain/                  # Domain Layer
│   │   ├── shared/              # Shared domain primitives
│   │   │   ├── domain.go        # ID, errors, pagination
│   │   │   └── events.go        # Event interfaces
│   │   ├── order/               # Order bounded context
│   │   │   ├── aggregate.go     # Order entity & business rules
│   │   │   ├── events.go        # Order domain events
│   │   │   └── repository.go    # Repository interface
│   │   ├── product/             # Product bounded context
│   │   │   └── product.go       # Product entity
│   │   └── customer/            # Customer bounded context
│   │       └── customer.go      # Customer entity
│   │
│   ├── application/             # Application Layer
│   │   └── services/
│   │       └── order_service.go # Order application service
│   │
│   └── infrastructure/          # Infrastructure Layer
│       ├── persistence/
│       │   └── postgres/
│       │       ├── postgres.go          # Database connection
│       │       └── order_repository.go  # Order repository impl
│       └── http/
│           └── server/
│               ├── server.go        # HTTP server setup
│               └── order_handler.go # Order HTTP handlers
│
├── pkg/                         # Public packages
│   ├── errors/                  # Application errors
│   ├── logger/                  # Structured logging
│   └── validator/               # Request validation
│
├── configs/                     # Configuration files
├── scripts/                     # Database scripts
├── Dockerfile
├── docker-compose.yml
└── go.mod
```

## 🚀 Quick Start

### Prerequisites
- Go 1.22+
- PostgreSQL 16+
- Docker (optional)

### Local Development

```bash
# Clone and navigate
cd go-ddd-clean-architecture

# Install dependencies
go mod download

# Set environment variables
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=postgres
export DB_PASSWORD=postgres
export DB_NAME=ddd_db

# Run
go run ./cmd/server
```

### Docker

```bash
# Build and run all services
docker compose up -d

# View logs
docker compose logs -f app

# Stop
docker compose down
```

## 📡 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/orders` | List orders (paginated) |
| POST | `/api/v1/orders` | Create order |
| GET | `/api/v1/orders/:id` | Get order by ID |
| PUT | `/api/v1/orders/:id/status` | Update order status |

### Example Requests

**Create Order:**
```bash
curl -X POST http://localhost:8080/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "clx123456789",
    "items": [
      {"productId": "clxproduct001", "quantity": 2}
    ],
    "shippingAddress": {
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "postalCode": "10001",
      "country": "US"
    }
  }'
```

**List Orders:**
```bash
curl "http://localhost:8080/api/v1/orders?page=1&pageSize=10&status=pending"
```

## 🧪 Testing

```bash
# Run all tests
go test ./...

# Run with coverage
go test -cover ./...

# Run specific package
go test ./internal/domain/order/...

# Verbose output
go test -v ./...
```

## 🎯 Go Philosophy & Best Practices

This project follows Go community best practices:

### 1. **Idiomatic Error Handling**
```go
// Return errors as values
func (s *OrderService) CreateOrder(ctx context.Context, input CreateOrderInput) (*CreateOrderOutput, error) {
    if err != nil {
        return nil, fmt.Errorf("failed to create order: %w", err)
    }
    return output, nil
}
```

### 2. **Interface Segregation**
```go
// Small, focused interfaces
type Repository interface {
    FindByID(ctx context.Context, id shared.ID) (*Order, error)
    Save(ctx context.Context, order *Order) error
}
```

### 3. **Constructor Functions**
```go
// NewXxx constructor pattern
func NewOrder(params CreateOrderParams) (*Order, error) {
    // validation and construction
}
```

### 4. **Context for Cancellation**
```go
// Context as first parameter
func (r *OrderRepository) FindByID(ctx context.Context, id shared.ID) (*Order, error)
```

### 5. **Package Organization by Domain**
- `internal/domain/order/` - Order bounded context
- `internal/domain/product/` - Product bounded context
- `internal/domain/customer/` - Customer bounded context

### 6. **No DI Containers**
- Manual dependency injection via constructors
- Explicit dependencies make testing easy

### 7. **Standard Library First**
- `net/http` for HTTP
- `database/sql` for database
- `encoding/json` for JSON

### 8. **Structured Logging**
- Using `log/slog` (Go 1.21+)
- JSON format for production

## 🏛️ Domain-Driven Design Patterns

| Pattern | Implementation |
|---------|---------------|
| **Aggregate** | `Order` with `Items` |
| **Entity** | `Order`, `Product`, `Customer` |
| **Value Object** | `Money`, `Address`, `Status` |
| **Domain Event** | `OrderCreatedEvent`, `OrderStatusChangedEvent` |
| **Repository** | Interface in domain, implementation in infrastructure |
| **Domain Service** | `OrderPricingService` |

## 🔧 Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_ADDR` | `:8080` | Server address |
| `DB_HOST` | `localhost` | Database host |
| `DB_PORT` | `5432` | Database port |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | `postgres` | Database password |
| `DB_NAME` | `ddd_db` | Database name |
| `LOG_LEVEL` | `info` | Log level |
| `LOG_FORMAT` | `json` | Log format (json/text) |

## 📝 License

MIT License
