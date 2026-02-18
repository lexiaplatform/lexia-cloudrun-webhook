# Dockerfile para Léxia Cloud Run - Versão Simplificada
# Foca apenas no webhook, sem build do client

FROM node:22-alpine

WORKDIR /app

# Instala pnpm
RUN npm install -g pnpm@latest

# Copia apenas os arquivos necessários do webhook-node
COPY services/webhook-node/package.json services/webhook-node/pnpm-lock.yaml ./

# Instala dependências
RUN pnpm install --frozen-lockfile --prod

# Copia código-fonte do webhook
COPY services/webhook-node/server ./server
COPY services/webhook-node/drizzle ./drizzle
COPY services/webhook-node/tsconfig.json ./

# Instala TypeScript globalmente para compilação
RUN npm install -g typescript@latest

# Compila TypeScript para JavaScript
RUN tsc --outDir dist --module commonjs --target es2020 server/webhook.ts

# Remove node_modules de desenvolvimento
RUN pnpm install --frozen-lockfile --prod --no-optional

# Expõe porta 8080
EXPOSE 8080

# Inicia o webhook
CMD ["node", "dist/server/webhook.js"]
