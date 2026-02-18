# Dockerfile otimizado para Léxia Cloud Run
FROM node:22-alpine AS builder

# Instala pnpm
RUN npm install -g pnpm@latest

WORKDIR /app

# Copia arquivos de configuração do workspace (se houver) ou apenas do serviço
COPY services/webhook-node/package.json services/webhook-node/pnpm-lock.yaml ./services/webhook-node/

# Instala dependências apenas para o webhook-node
WORKDIR /app/services/webhook-node
RUN pnpm install --frozen-lockfile

# Copia o restante do código necessário
WORKDIR /app
COPY services/webhook-node/ ./services/webhook-node/

# Build do webhook usando esbuild (conforme definido no package.json)
WORKDIR /app/services/webhook-node
RUN pnpm run webhook:build

# Estágio final para uma imagem menor
FROM node:22-alpine

WORKDIR /app

# Instala pnpm no estágio final também (necessário se o start script usar pnpm)
RUN npm install -g pnpm@latest

# Copia apenas o necessário do estágio de build
COPY --from=builder /app/services/webhook-node/package.json ./
COPY --from=builder /app/services/webhook-node/node_modules ./node_modules
COPY --from=builder /app/services/webhook-node/dist ./dist

# Expõe a porta padrão do Cloud Run
EXPOSE 8080

# Define variáveis de ambiente padrão
ENV PORT=8080
ENV NODE_ENV=production

# Comando para iniciar o webhook
CMD ["node", "dist/webhook.js"]
