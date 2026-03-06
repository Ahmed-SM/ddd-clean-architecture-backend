# =====================================================
# Multi-stage Dockerfile for Go DDD Clean Architecture
# =====================================================

# -----------------------------------------------------
# Stage 1: Build
# -----------------------------------------------------
FROM golang:1.22-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /app

# Copy go mod files first for caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags='-w -s -extldflags "-static"' \
    -a -o /app/server ./cmd/server

# -----------------------------------------------------
# Stage 2: Runner (Production)
# -----------------------------------------------------
FROM alpine:3.19 AS runner

# Install runtime dependencies
RUN apk --no-cache add ca-certificates tzdata

# Create non-root user
RUN adduser -D -g '' appuser

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/server .

# Copy config files
COPY --from=builder /app/configs ./configs

# Set ownership
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/v1/health || exit 1

# Run the binary
ENTRYPOINT ["./server"]
