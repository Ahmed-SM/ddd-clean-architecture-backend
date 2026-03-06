use anyhow::Result;
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::customer::{self, Customer, CustomerRepository};
use crate::domain::money::{Currency, Money};
use crate::domain::order::{self, LineItem, Order, OrderRepository, Status};
use crate::domain::product::{Product, ProductRepository};

// ---------------------------------------------------------------------------
// Order Repository
// ---------------------------------------------------------------------------

pub struct PgOrderRepo {
    pool: PgPool,
}

impl PgOrderRepo {
    pub fn new(pool: PgPool) -> Self { Self { pool } }
}

impl OrderRepository for PgOrderRepo {
    async fn find_by_id(&self, id: Uuid) -> Result<Option<Order>> {
        let row = sqlx::query_as::<_, OrderRow>(
            "SELECT id, customer_id, status, currency, shipping_address, tracking_number, created_at, updated_at, version FROM orders WHERE id = $1"
        ).bind(id).fetch_optional(&self.pool).await?;

        let Some(row) = row else { return Ok(None) };

        let items = sqlx::query_as::<_, ItemRow>(
            "SELECT product_id, product_name, quantity, unit_price_amount, unit_price_currency FROM order_items WHERE order_id = $1"
        ).bind(id).fetch_all(&self.pool).await?;

        let line_items: Vec<LineItem> = items.into_iter().map(|i| {
            let price = Money::new(i.unit_price_amount, Currency::from_str(&i.unit_price_currency).unwrap_or(Currency::Usd)).unwrap_or(Money::zero(Currency::Usd));
            LineItem { product_id: i.product_id, product_name: i.product_name, quantity: i.quantity, unit_price: price }
        }).collect();

        Ok(Some(Order::reconstitute(
            row.id, row.customer_id, Status::from_str(&row.status).unwrap_or(Status::Draft),
            line_items, Currency::from_str(&row.currency).unwrap_or(Currency::Usd),
            row.shipping_address, row.tracking_number,
            row.created_at, row.updated_at, row.version,
        )))
    }

    async fn find_by_customer(&self, customer_id: &str, page: i64, page_size: i64) -> Result<(Vec<Order>, i64)> {
        let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM orders WHERE customer_id = $1")
            .bind(customer_id).fetch_one(&self.pool).await?;
        let ids: Vec<(Uuid,)> = sqlx::query_as(
            "SELECT id FROM orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
        ).bind(customer_id).bind(page_size).bind((page - 1) * page_size).fetch_all(&self.pool).await?;

        let mut orders = Vec::with_capacity(ids.len());
        for (id,) in ids {
            if let Some(o) = self.find_by_id(id).await? { orders.push(o); }
        }
        Ok((orders, total.0))
    }

    async fn find_by_status(&self, status: Status, page: i64, page_size: i64) -> Result<(Vec<Order>, i64)> {
        let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM orders WHERE status = $1")
            .bind(status.as_str()).fetch_one(&self.pool).await?;
        let ids: Vec<(Uuid,)> = sqlx::query_as(
            "SELECT id FROM orders WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
        ).bind(status.as_str()).bind(page_size).bind((page - 1) * page_size).fetch_all(&self.pool).await?;

        let mut orders = Vec::with_capacity(ids.len());
        for (id,) in ids {
            if let Some(o) = self.find_by_id(id).await? { orders.push(o); }
        }
        Ok((orders, total.0))
    }

    async fn save(&self, order: &Order) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        sqlx::query(
            "INSERT INTO orders (id, customer_id, status, currency, shipping_address, tracking_number, created_at, updated_at, version)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, shipping_address=EXCLUDED.shipping_address,
             tracking_number=EXCLUDED.tracking_number, updated_at=EXCLUDED.updated_at, version=EXCLUDED.version"
        ).bind(order.id()).bind(order.customer_id()).bind(order.status().as_str())
         .bind(order.currency().to_string())
         .bind(order.shipping_address()).bind(order.tracking_number())
         .bind(order.created_at()).bind(order.updated_at()).bind(order.version())
         .execute(&mut *tx).await?;

        sqlx::query("DELETE FROM order_items WHERE order_id = $1")
            .bind(order.id()).execute(&mut *tx).await?;

        for item in order.items() {
            sqlx::query(
                "INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price_amount, unit_price_currency)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)"
            ).bind(Uuid::new_v4()).bind(order.id())
             .bind(&item.product_id).bind(&item.product_name)
             .bind(item.quantity).bind(item.unit_price.amount())
             .bind(item.unit_price.currency().to_string())
             .execute(&mut *tx).await?;
        }

        tx.commit().await?;
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Customer Repository
// ---------------------------------------------------------------------------

pub struct PgCustomerRepo { pool: PgPool }
impl PgCustomerRepo { pub fn new(pool: PgPool) -> Self { Self { pool } } }

impl CustomerRepository for PgCustomerRepo {
    async fn find_by_id(&self, id: Uuid) -> Result<Option<Customer>> {
        let row = sqlx::query_as::<_, CustomerRow>(
            "SELECT id, name, email, status, order_count, created_at, updated_at, version FROM customers WHERE id = $1"
        ).bind(id).fetch_optional(&self.pool).await?;
        Ok(row.map(|r| Customer::reconstitute(r.id, r.name, r.email, customer::Status::from_str(&r.status).unwrap_or(customer::Status::Active), r.order_count, r.created_at, r.updated_at, r.version)))
    }

    async fn find_by_email(&self, email: &str) -> Result<Option<Customer>> {
        let row = sqlx::query_as::<_, CustomerRow>(
            "SELECT id, name, email, status, order_count, created_at, updated_at, version FROM customers WHERE email = $1"
        ).bind(email).fetch_optional(&self.pool).await?;
        Ok(row.map(|r| Customer::reconstitute(r.id, r.name, r.email, customer::Status::from_str(&r.status).unwrap_or(customer::Status::Active), r.order_count, r.created_at, r.updated_at, r.version)))
    }

    async fn save(&self, c: &Customer) -> Result<()> {
        sqlx::query(
            "INSERT INTO customers (id,name,email,status,order_count,created_at,updated_at,version)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,status=EXCLUDED.status,
             order_count=EXCLUDED.order_count,updated_at=EXCLUDED.updated_at,version=EXCLUDED.version"
        ).bind(c.id()).bind(c.name()).bind(c.email()).bind(c.status().as_str())
         .bind(c.order_count()).bind(c.created_at()).bind(c.updated_at()).bind(c.version())
         .execute(&self.pool).await?;
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Product Repository
// ---------------------------------------------------------------------------

pub struct PgProductRepo { pool: PgPool }
impl PgProductRepo { pub fn new(pool: PgPool) -> Self { Self { pool } } }

impl ProductRepository for PgProductRepo {
    async fn find_by_id(&self, id: Uuid) -> Result<Option<Product>> {
        let row = sqlx::query_as::<_, ProductRow>(
            "SELECT id,name,description,price_amount,price_currency,stock_quantity,sku,is_active,created_at,updated_at,version FROM products WHERE id = $1"
        ).bind(id).fetch_optional(&self.pool).await?;
        Ok(row.map(to_product))
    }

    async fn find_by_sku(&self, sku: &str) -> Result<Option<Product>> {
        let row = sqlx::query_as::<_, ProductRow>(
            "SELECT id,name,description,price_amount,price_currency,stock_quantity,sku,is_active,created_at,updated_at,version FROM products WHERE sku = $1"
        ).bind(sku).fetch_optional(&self.pool).await?;
        Ok(row.map(to_product))
    }

    async fn find_active(&self, page: i64, page_size: i64) -> Result<(Vec<Product>, i64)> {
        let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM products WHERE is_active = true")
            .fetch_one(&self.pool).await?;
        let rows = sqlx::query_as::<_, ProductRow>(
            "SELECT id,name,description,price_amount,price_currency,stock_quantity,sku,is_active,created_at,updated_at,version
             FROM products WHERE is_active = true ORDER BY created_at DESC LIMIT $1 OFFSET $2"
        ).bind(page_size).bind((page - 1) * page_size).fetch_all(&self.pool).await?;
        Ok((rows.into_iter().map(to_product).collect(), total.0))
    }

    async fn save(&self, p: &Product) -> Result<()> {
        sqlx::query(
            "INSERT INTO products (id,name,description,price_amount,price_currency,stock_quantity,sku,is_active,created_at,updated_at,version)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,
             price_amount=EXCLUDED.price_amount,price_currency=EXCLUDED.price_currency,
             stock_quantity=EXCLUDED.stock_quantity,is_active=EXCLUDED.is_active,
             updated_at=EXCLUDED.updated_at,version=EXCLUDED.version"
        ).bind(p.id()).bind(p.name()).bind(p.description())
         .bind(p.price().amount()).bind(p.price().currency().to_string())
         .bind(p.stock_quantity()).bind(p.sku()).bind(p.is_active())
         .bind(p.created_at()).bind(p.updated_at()).bind(p.version())
         .execute(&self.pool).await?;
        Ok(())
    }
}

fn to_product(r: ProductRow) -> Product {
    let price = Money::new(r.price_amount, Currency::from_str(&r.price_currency).unwrap_or(Currency::Usd)).unwrap_or(Money::zero(Currency::Usd));
    Product::reconstitute(r.id, r.name, r.description, price, r.stock_quantity, r.sku, r.is_active, r.created_at, r.updated_at, r.version)
}

// ---------------------------------------------------------------------------
// Row types for sqlx
// ---------------------------------------------------------------------------

#[derive(sqlx::FromRow)]
struct OrderRow { id: Uuid, customer_id: String, status: String, currency: String, shipping_address: Option<String>, tracking_number: Option<String>, created_at: DateTime<Utc>, updated_at: DateTime<Utc>, version: i32 }

#[derive(sqlx::FromRow)]
struct ItemRow { product_id: String, product_name: String, quantity: i32, unit_price_amount: i64, unit_price_currency: String }

#[derive(sqlx::FromRow)]
struct CustomerRow { id: Uuid, name: String, email: String, status: String, order_count: i32, created_at: DateTime<Utc>, updated_at: DateTime<Utc>, version: i32 }

#[derive(sqlx::FromRow)]
struct ProductRow { id: Uuid, name: String, description: String, price_amount: i64, price_currency: String, stock_quantity: i32, sku: String, is_active: bool, created_at: DateTime<Utc>, updated_at: DateTime<Utc>, version: i32 }
