# Léxia WhatsApp Webhook (Cloud Run)

This service exposes:
- `GET /webhook` Meta verification
- `POST /webhook` WhatsApp events
- `GET /health` health check

## Required env vars
- VERIFY_TOKEN
- WHATSAPP_ACCESS_TOKEN
- WHATSAPP_PHONE_NUMBER_ID
- (optional) WHATSAPP_BUSINESS_ACCOUNT_ID
- (optional) META_GRAPH_VERSION (default: v18.0)

## Local run
```bash
pnpm install
pnpm webhook:build
PORT=8080 node dist/webhook.js
```

## Cloud Run
Builds with the provided `Dockerfile`.
