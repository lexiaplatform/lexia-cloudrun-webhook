# Léxia Platform - Cloud Run Dockerfile
# Frontend + Backend + Webhook (Monolítico)

# Stage 1: Build
FROM node:20-slim as builder

WORKDIR /app

# Enable pnpm
RUN corepack enable

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build frontend (React + Vite)
RUN pnpm build

# Build backend (Express + tRPC)
RUN pnpm run build

# Stage 2: Runtime
FROM node:20-slim

WORKDIR /app

# Enable pnpm
RUN corepack enable

# Install production dependencies only
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle

# Environment
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start server
CMD ["node", "dist/index.js"]
