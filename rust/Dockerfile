# ===========================================================================
# Multi-Stage Dockerfile for Rust DDD Backend
# Stage 1: Build with cargo (musl for fully static binary)
# Stage 2: scratch — literally empty image + the binary (~8MB)
# ===========================================================================

# --- Build ---
FROM rust:1.80-alpine AS builder

RUN apk add --no-cache musl-dev pkgconfig openssl-dev

WORKDIR /app

# Cache deps via cargo-chef pattern
COPY Cargo.toml Cargo.lock* ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release 2>/dev/null || true

# Build real app
COPY . .
RUN touch src/main.rs  # force rebuild
RUN cargo build --release --target x86_64-unknown-linux-musl 2>/dev/null || cargo build --release

# --- Runtime ---
FROM scratch

COPY --from=builder /app/target/release/ddd-rust /server
# Copy CA certs for TLS
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

EXPOSE 8080

ENTRYPOINT ["/server"]
