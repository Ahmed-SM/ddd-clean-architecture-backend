mod domain;
mod app;
mod infra;
mod port;

use std::sync::Arc;
use sqlx::postgres::PgPoolOptions;
use tokio::net::TcpListener;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use crate::app::Service;
use crate::infra::eventbus::LogEventBus;
use crate::infra::postgres::{PgCustomerRepo, PgOrderRepo, PgProductRepo};
use crate::port::http::{routes, AppState};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // --- Logging ---
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info,sqlx=warn".into()))
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    // --- Config ---
    dotenvy::dotenv().ok();
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");
    let host = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".into());
    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".into());

    // --- Database ---
    let pool = PgPoolOptions::new()
        .max_connections(20)
        .min_connections(2)
        .connect(&database_url)
        .await?;

    tracing::info!("database connected");

    // --- Repositories ---
    let order_repo = PgOrderRepo::new(pool.clone());
    let customer_repo = PgCustomerRepo::new(pool.clone());
    let product_repo = PgProductRepo::new(pool);

    // --- Application Service ---
    let svc = Service::new(order_repo, customer_repo, product_repo, LogEventBus);

    // --- HTTP Server ---
    let state = Arc::new(AppState { svc });
    let app = routes(state).layer(TraceLayer::new_for_http());

    let addr = format!("{host}:{port}");
    let listener = TcpListener::bind(&addr).await?;
    tracing::info!(%addr, "server starting");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    tracing::info!("server stopped");
    Ok(())
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("failed to install CTRL+C signal handler");
    tracing::info!("shutdown signal received");
}
