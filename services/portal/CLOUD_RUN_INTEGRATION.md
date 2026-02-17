# Léxia Platform - Cloud Run Integration Guide

## 📋 Visão Geral

Este documento descreve como integrar o projeto unificado (Front + Back + DB) com a infraestrutura Cloud Run já deployada.

---

## 🏗️ Arquitetura Completa

```
┌─────────────────────────────────────────────────────────────┐
│                    LÉXIA PLATFORM COMPLETA                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  FRONTEND (React + Vite)                             │  │
│  │  - Dashboard                                         │  │
│  │  - Chat Interface                                    │  │
│  │  - Admin Panel                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  BACKEND (Express + tRPC)                            │  │
│  │  - API REST                                          │  │
│  │  - Webhook WhatsApp                                  │  │
│  │  - Integração com Agent ADK                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  AGENT ADK (Python/FastAPI) - Cloud Run              │  │
│  │  - Processamento com Gemini/Vertex AI                │  │
│  │  - Responde mensagens                                │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  DATABASE (PostgreSQL - Cloud SQL)                   │  │
│  │  - Histórico de mensagens                            │  │
│  │  - Sessões de chat                                   │  │
│  │  - Contatos                                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Configuração de Variáveis de Ambiente

### 1. **Database (Cloud SQL PostgreSQL)**

```bash
# .env
DATABASE_URL=postgresql://lexia_user:LexiaSecure2026!@#@localhost/lexia?host=/cloudsql/lexia-platform-486621:us-central1:lexia-postgres

# Cloud Run: Use Cloud SQL Proxy
# Configurar via --add-cloudsql-instances
```

### 2. **Agent ADK Integration**

```bash
# .env
GOOGLE_CLOUD_PROJECT=lexia-platform-486621
GOOGLE_CLOUD_LOCATION=global
GOOGLE_GENAI_USE_VERTEXAI=true
GEMINI_MODEL=gemini-2.5-pro

# Base URL do Agent ADK (SEM /chat)
AGENT_URL=https://lexia-agent-adk-108902278293.southamerica-east1.run.app
```

### 3. **WhatsApp Configuration**

```bash
# .env
VERIFY_TOKEN=lexia_verify_token_secure_2026
WHATSAPP_ACCESS_TOKEN=<seu_token_real>  # Use Secret Manager em produção
WHATSAPP_BUSINESS_ACCOUNT_ID=2793719140803043
WHATSAPP_PHONE_NUMBER_ID=981763218354581
META_GRAPH_VERSION=v18.0
```

---

## 🚀 Deploy no Cloud Run

### Backend + Frontend (Monolítico)

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"

gcloud run deploy lexia-platform \
  --source . \
  --region southamerica-east1 \
  --allow-unauthenticated \
  --add-cloudsql-instances lexia-platform-486621:us-central1:lexia-postgres \
  --set-env-vars \
    NODE_ENV=production,\
    PORT=8080,\
    GOOGLE_CLOUD_PROJECT=lexia-platform-486621,\
    GOOGLE_CLOUD_LOCATION=global,\
    GOOGLE_GENAI_USE_VERTEXAI=true,\
    GEMINI_MODEL=gemini-2.5-pro,\
    AGENT_URL=https://lexia-agent-adk-108902278293.southamerica-east1.run.app,\
    WHATSAPP_BUSINESS_ACCOUNT_ID=2793719140803043,\
    WHATSAPP_PHONE_NUMBER_ID=981763218354581,\
    META_GRAPH_VERSION=v18.0 \
  --set-secrets \
    DATABASE_URL=DATABASE_URL:latest,\
    VERIFY_TOKEN=VERIFY_TOKEN:latest,\
    WHATSAPP_ACCESS_TOKEN=WHATSAPP_ACCESS_TOKEN:latest,\
    JWT_SECRET=JWT_SECRET:latest \
  --project=lexia-platform-486621
```

---

## 📦 Estrutura de Deployment

### Opção 1: Monolítico (Recomendado)

```
lexia-platform (Cloud Run)
├── Frontend (React)
├── Backend (Express + tRPC)
└── Webhook WhatsApp
    ↓
lexia-agent-adk (Cloud Run) - Já deployado
    ↓
lexia-postgres (Cloud SQL) - Já criado
```

### Opção 2: Separado (Microserviços)

```
lexia-frontend (Cloud Run)
    ↓
lexia-backend (Cloud Run)
    ↓
lexia-agent-adk (Cloud Run) - Já deployado
    ↓
lexia-postgres (Cloud SQL) - Já criado
```

---

## 🗄️ Database Migration

### 1. **Criar tabelas com Drizzle**

```bash
# Local
export DATABASE_URL="postgresql://user:pass@localhost/lexia"
pnpm db:push

# Cloud SQL via Cloud Shell
gcloud sql connect lexia-postgres --user=lexia_user
# Dentro do psql:
# \i drizzle/migrations.sql
```

### 2. **Verificar schema**

```bash
gcloud sql connect lexia-postgres --user=lexia_user

# Dentro do psql:
\dt  # Listar tabelas
\d sessions  # Ver estrutura da tabela
```

---

## 🔐 Secrets Management

### Criar Secrets no Secret Manager

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"

# Database URL
echo -n "postgresql://lexia_user:LexiaSecure2026!@#@localhost/lexia?host=/cloudsql/lexia-platform-486621:us-central1:lexia-postgres" | \
  gcloud secrets versions add DATABASE_URL --data-file=- --project=lexia-platform-486621

# WhatsApp Token
echo -n "seu_token_real" | \
  gcloud secrets versions add WHATSAPP_ACCESS_TOKEN --data-file=- --project=lexia-platform-486621

# JWT Secret
echo -n "sua_chave_jwt_secreta_min_32_chars" | \
  gcloud secrets versions add JWT_SECRET --data-file=- --project=lexia-platform-486621

# Verify Token
echo -n "lexia_verify_token_secure_2026" | \
  gcloud secrets versions add VERIFY_TOKEN --data-file=- --project=lexia-platform-486621
```

---

## 🧪 Testes Pós-Deploy

### 1. **Health Check**

```bash
curl https://lexia-platform-xxxxx.run.app/health
```

### 2. **Webhook Health**

```bash
curl https://lexia-platform-xxxxx.run.app/webhook/health
```

### 3. **API tRPC**

```bash
curl https://lexia-platform-xxxxx.run.app/trpc/health
```

### 4. **Testar integração com Agent**

```bash
curl -X POST https://lexia-platform-xxxxx.run.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Olá", "sessionId": "test-123"}'
```

---

## 📊 Monitoramento

### Logs

```bash
gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=lexia-platform" \
  --limit 50 \
  --project=lexia-platform-486621
```

### Métricas

```bash
gcloud monitoring dashboards list --project=lexia-platform-486621
```

---

## ✅ Checklist de Integração

- [ ] `.env.example` atualizado com Cloud Run config
- [ ] `DATABASE_URL` apontando para Cloud SQL PostgreSQL
- [ ] `AGENT_URL` configurado (base URL sem `/chat`)
- [ ] Secrets criados no Secret Manager
- [ ] Dockerfile preparado para Cloud Run
- [ ] `PORT=8080` configurado
- [ ] Cloud SQL Proxy configurado (`--add-cloudsql-instances`)
- [ ] Permissões do Compute Service Account configuradas
- [ ] Health endpoints implementados
- [ ] Logs estruturados
- [ ] Testes pós-deploy passando

---

## 🚨 Troubleshooting

### Erro: "Cannot connect to database"

```bash
# Verificar Cloud SQL Proxy
gcloud sql instances describe lexia-postgres --project=lexia-platform-486621

# Verificar permissões
gcloud projects get-iam-policy lexia-platform-486621 \
  --flatten="bindings[].members" \
  --filter="bindings.members:108902278293-compute@developer.gserviceaccount.com"
```

### Erro: "Agent URL not responding"

```bash
# Verificar Agent ADK
curl https://lexia-agent-adk-108902278293.southamerica-east1.run.app/health

# Verificar AGENT_URL no deployment
gcloud run services describe lexia-platform \
  --region=southamerica-east1 \
  --project=lexia-platform-486621 \
  --format='value(spec.template.spec.containers[0].env[?name==AGENT_URL].value)'
```

---

**Status**: ✅ Pronto para integração completa
