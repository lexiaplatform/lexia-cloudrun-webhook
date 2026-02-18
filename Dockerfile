# Multi-stage build para Léxia Cloud Run
FROM node:22-alpine AS builder

WORKDIR /app

# Copia arquivos de dependências
COPY package.json pnpm-lock.yaml ./

# Instala pnpm e dependências
RUN npm install -g pnpm@latest
RUN pnpm install --frozen-lockfile

# Copia código-fonte
COPY . .

# Build do TypeScript
RUN pnpm run build

# Stage final
FROM node:22-alpine

WORKDIR /app

# Instala pnpm
RUN npm install -g pnpm@latest

# Copia node_modules e build do stage anterior
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/package.json ./package.json

# Copia scripts de inicialização
COPY --from=builder /app/services/webhook-node/server ./server

# Expõe porta 8080 (Cloud Run padrão)
EXPOSE 8080

# Script de inicialização que:
# 1. Executa migrações do banco de dados
# 2. Inicia webhook na porta 8080
# 3. Inicia worker em background
CMD ["sh", "-c", "\
  echo 'Starting Léxia on Cloud Run...' && \
  echo 'Step 1: Running database migrations...' && \
  pnpm run db:push && \
  echo 'Step 2: Starting webhook and worker...' && \
  pnpm run webhook:start & \
  pnpm run worker:start & \
  wait \
"]
