# Dockerfile para Léxia Cloud Run
FROM node:22-alpine

WORKDIR /app

# Instala pnpm
RUN npm install -g pnpm@latest

# Copia package.json e pnpm-lock.yaml
COPY services/webhook-node/package.json services/webhook-node/pnpm-lock.yaml ./

# Instala dependências
RUN pnpm install --frozen-lockfile

# Copia código-fonte
COPY services/webhook-node/server ./server
COPY services/webhook-node/drizzle ./drizzle
COPY services/webhook-node/tsconfig.json ./

# Build do webhook
RUN pnpm run webhook:build

# Expõe porta 8080
EXPOSE 8080

# Inicia o webhook
CMD ["node", "dist/webhook.js"]
