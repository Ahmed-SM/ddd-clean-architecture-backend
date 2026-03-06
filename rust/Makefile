.PHONY: build run test check clippy fmt docker-up docker-down

# Build release binary
build:
	cargo build --release

# Run in development
run:
	cargo run

# Run all tests
test:
	cargo test

# Type-check without building
check:
	cargo check

# Lint with clippy
clippy:
	cargo clippy -- -D warnings

# Format code
fmt:
	cargo fmt

# Full CI check
ci: fmt clippy test

# Docker
docker-up:
	docker compose up -d --build

docker-down:
	docker compose down -v

docker-logs:
	docker compose logs -f app
