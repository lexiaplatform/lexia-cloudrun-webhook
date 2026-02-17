# Simplified Cloud Run container for WhatsApp webhook
FROM node:20-slim

WORKDIR /app

# Enable pnpm via Corepack
RUN corepack enable

# Install deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copy source
COPY server ./server
COPY shared ./shared
COPY drizzle ./drizzle
COPY tsconfig.json ./
COPY drizzle.config.ts ./

# Build webhook
RUN pnpm webhook:build

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["node", "dist/webhook.js"]
