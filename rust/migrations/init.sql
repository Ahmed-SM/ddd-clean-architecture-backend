CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS customers (
    id           UUID PRIMARY KEY,
    name         VARCHAR(255) NOT NULL,
    email        VARCHAR(320) NOT NULL,
    status       VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    order_count  INTEGER      NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    version      INTEGER      NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

CREATE TABLE IF NOT EXISTS products (
    id             UUID PRIMARY KEY,
    name           VARCHAR(200) NOT NULL,
    description    TEXT         NOT NULL DEFAULT '',
    price_amount   BIGINT       NOT NULL,
    price_currency VARCHAR(3)   NOT NULL,
    stock_quantity INTEGER      NOT NULL DEFAULT 0,
    sku            VARCHAR(50)  NOT NULL,
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    version        INTEGER      NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

CREATE TABLE IF NOT EXISTS orders (
    id               UUID PRIMARY KEY,
    customer_id      VARCHAR(64) NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    currency         VARCHAR(3)  NOT NULL,
    shipping_address TEXT,
    tracking_number  VARCHAR(100),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version          INTEGER     NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders(status);

CREATE TABLE IF NOT EXISTS order_items (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id            UUID         NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id          VARCHAR(64)  NOT NULL,
    product_name        VARCHAR(200) NOT NULL,
    quantity            INTEGER      NOT NULL,
    unit_price_amount   BIGINT       NOT NULL,
    unit_price_currency VARCHAR(3)   NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS domain_events_outbox (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type   VARCHAR(100) NOT NULL,
    aggregate_id VARCHAR(64)  NOT NULL,
    payload      JSONB        NOT NULL DEFAULT '{}',
    occurred_on  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    retry_count  INTEGER      NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON domain_events_outbox(published_at) WHERE published_at IS NULL;
