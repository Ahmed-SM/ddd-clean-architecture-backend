# =====================================================
# Multi-stage Dockerfile for DDD Clean Architecture
# =====================================================
# Production-grade Dockerfile with security best practices
# Uses multi-stage builds to minimize image size

# -----------------------------------------------------
# Stage 1: Base dependencies
# -----------------------------------------------------
FROM node:22-alpine AS deps

# Install system dependencies
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json bun.lock* package-lock.json* yarn.lock* ./

# Use bun if available, otherwise fall back to npm
RUN \
  if [ -f bun.lock ]; then npm install -g bun && bun install --frozen-lockfile; \
  elif [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  else npm ci; \
  fi

# Copy prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# -----------------------------------------------------
# Stage 2: Builder
# -----------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the application
RUN \
  if [ -f bun.lock ]; then npm install -g bun && bun run build; \
  elif [ -f yarn.lock ]; then yarn build; \
  else npm run build; \
  fi

# -----------------------------------------------------
# Stage 3: Runner (Production)
# -----------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

# Security: Run as non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy node_modules for runtime dependencies
COPY --from=builder /app/node_modules ./node_modules

# Set proper ownership
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

# Start the application
CMD ["node", "server.js"]
