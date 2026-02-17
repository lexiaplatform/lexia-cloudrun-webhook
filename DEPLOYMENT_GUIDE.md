# Léxia Platform - Deployment Guide

## 🎯 Visão Geral

Guia completo para deployar o monorepo Léxia Platform com 3 serviços Cloud Run.

---

## 📋 Pré-requisitos

- ✅ Google Cloud Project: `lexia-platform-486621`
- ✅ Cloud SQL PostgreSQL: `lexia-postgres` (us-central1)
- ✅ Service Account com permissões
- ✅ gcloud CLI configurado
- ✅ Secrets no Secret Manager criados

---

## 🚀 Deploy dos Serviços

### 1. **Agent ADK** (Já Deployado)

**Status**: ✅ DEPLOYADO
**URL**: https://lexia-agent-adk-108902278293.southamerica-east1.run.app

```bash
# Verificar status
gcloud run services describe lexia-agent-adk \
  --region=southamerica-east1 \
  --project=lexia-platform-486621
```

### 2. **Webhook Node**

**Status**: ⏳ EM BUILD (ou pronto)
**URL**: https://lexia-whatsapp-webhook-xxxxx.run.app

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"

gcloud run deploy lexia-whatsapp-webhook \
  --source services/webhook-node \
  --region southamerica-east1 \
  --allow-unauthenticated \
  --set-env-vars \
    AGENT_URL=https://lexia-agent-adk-108902278293.southamerica-east1.run.app,\
    NODE_ENV=production,\
    PORT=8080 \
  --set-secrets \
    VERIFY_TOKEN=VERIFY_TOKEN:latest,\
    WHATSAPP_ACCESS_TOKEN=WHATSAPP_ACCESS_TOKEN:latest,\
    WHATSAPP_PHONE_NUMBER_ID=WHATSAPP_PHONE_NUMBER_ID:latest,\
    META_GRAPH_VERSION=META_GRAPH_VERSION:latest \
  --project=lexia-platform-486621
```

### 3. **Portal** (Frontend + Backend)

**Status**: 🟢 PRONTO PARA DEPLOY
**URL**: https://lexia-platform-xxxxx.run.app

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"

gcloud run deploy lexia-platform \
  --source services/portal \
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

## 🗄️ Database Setup

### 1. **Criar Tabelas**

```bash
# Via Cloud Shell
gcloud sql connect lexia-postgres --user=lexia_user

# Dentro do psql:
\i services/portal/drizzle/schema.sql
```

### 2. **Verificar Schema**

```bash
gcloud sql connect lexia-postgres --user=lexia_user

# Dentro do psql:
\dt  # Listar tabelas
\d sessions  # Ver estrutura
```

---

## 🔐 Secrets Management

### Criar/Atualizar Secrets

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"

# DATABASE_URL
echo -n "postgresql://lexia_user:LexiaSecure2026!@#@localhost/lexia?host=/cloudsql/lexia-platform-486621:us-central1:lexia-postgres" | \
  gcloud secrets versions add DATABASE_URL --data-file=- --project=lexia-platform-486621

# WHATSAPP_ACCESS_TOKEN (IMPORTANTE: usar token real)
echo -n "seu_token_real_aqui" | \
  gcloud secrets versions add WHATSAPP_ACCESS_TOKEN --data-file=- --project=lexia-platform-486621

# JWT_SECRET
echo -n "sua_chave_jwt_secreta_min_32_chars" | \
  gcloud secrets versions add JWT_SECRET --data-file=- --project=lexia-platform-486621

# VERIFY_TOKEN
echo -n "lexia_verify_token_secure_2026" | \
  gcloud secrets versions add VERIFY_TOKEN --data-file=- --project=lexia-platform-486621
```

### Listar Secrets

```bash
gcloud secrets list --project=lexia-platform-486621
```

---

## 🧪 Testes Pós-Deploy

### 1. **Health Checks**

```bash
# Agent ADK
curl https://lexia-agent-adk-108902278293.southamerica-east1.run.app/health

# Webhook
curl https://lexia-whatsapp-webhook-xxxxx.run.app/health

# Portal
curl https://lexia-platform-xxxxx.run.app/health
```

### 2. **Testar Integração**

```bash
# Webhook → Agent ADK
curl -X POST https://lexia-whatsapp-webhook-xxxxx.run.app/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "message"}'

# Portal API
curl https://lexia-platform-xxxxx.run.app/api/trpc/health
```

### 3. **Verificar Logs**

```bash
# Agent ADK
gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=lexia-agent-adk" \
  --limit 50 --project=lexia-platform-486621

# Webhook
gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=lexia-whatsapp-webhook" \
  --limit 50 --project=lexia-platform-486621

# Portal
gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=lexia-platform" \
  --limit 50 --project=lexia-platform-486621
```

---

## 🔗 Configurar Meta Webhook

### 1. **Obter URL do Webhook**

```bash
# Após deploy
gcloud run services describe lexia-whatsapp-webhook \
  --region=southamerica-east1 \
  --project=lexia-platform-486621 \
  --format='value(status.url)'
```

### 2. **Configurar no Meta Business Manager**

1. Acesse: https://developers.facebook.com/apps/
2. Selecione seu app
3. Vá para **Webhooks** → **WhatsApp**
4. Configure:
   - **Callback URL**: `https://lexia-whatsapp-webhook-xxxxx.run.app/webhook`
   - **Verify Token**: `lexia_verify_token_secure_2026`
5. Salve

### 3. **Testar Webhook**

```bash
# Meta enviará um teste
# Verificar logs para confirmar recebimento
gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=lexia-whatsapp-webhook" \
  --limit 10 --project=lexia-platform-486621
```

---

## 📊 Monitoramento

### Dashboards

```bash
# Criar dashboard
gcloud monitoring dashboards create --config-from-file=- <<EOF
{
  "displayName": "Léxia Platform",
  "mosaicLayout": {
    "columns": 12,
    "tiles": [
      {
        "width": 6,
        "height": 4,
        "widget": {
          "title": "Cloud Run Services",
          "xyChart": {
            "dataSets": [{
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "resource.type=cloud_run_revision"
                }
              }
            }]
          }
        }
      }
    ]
  }
}
EOF
```

### Alertas

```bash
# CPU alta
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="High CPU" \
  --condition-display-name="CPU > 80%" \
  --condition-threshold-value=0.8 \
  --condition-threshold-duration=300s
```

---

## 🔄 Atualizar Serviços

### Webhook

```bash
cd services/webhook-node
git add -A
git commit -m "update: webhook changes"
git push

gcloud run deploy lexia-whatsapp-webhook \
  --source services/webhook-node \
  --region southamerica-east1 \
  --project=lexia-platform-486621
```

### Agent ADK

```bash
cd services/agent-adk
git add -A
git commit -m "update: agent changes"
git push

gcloud run deploy lexia-agent-adk \
  --source services/agent-adk \
  --region southamerica-east1 \
  --project=lexia-platform-486621
```

### Portal

```bash
cd services/portal
git add -A
git commit -m "update: portal changes"
git push

gcloud run deploy lexia-platform \
  --source services/portal \
  --region southamerica-east1 \
  --add-cloudsql-instances lexia-platform-486621:us-central1:lexia-postgres \
  --project=lexia-platform-486621
```

---

## 🚨 Troubleshooting

### Erro: "Cannot connect to database"

```bash
# Verificar Cloud SQL
gcloud sql instances describe lexia-postgres --project=lexia-platform-486621

# Verificar conexão
gcloud sql connect lexia-postgres --user=lexia_user
```

### Erro: "Agent URL not responding"

```bash
# Verificar Agent ADK
curl https://lexia-agent-adk-108902278293.southamerica-east1.run.app/health

# Verificar logs
gcloud logs read "resource.labels.service_name=lexia-agent-adk" --limit 50
```

### Erro: "Secret not found"

```bash
# Verificar secrets
gcloud secrets list --project=lexia-platform-486621

# Verificar versão
gcloud secrets versions list WHATSAPP_ACCESS_TOKEN --project=lexia-platform-486621
```

---

## ✅ Checklist Final

- [ ] Cloud SQL PostgreSQL pronto
- [ ] Secrets criados e atualizados
- [ ] Agent ADK deployado
- [ ] Webhook deployado
- [ ] Portal deployado
- [ ] Health checks passando
- [ ] Meta Webhook configurado
- [ ] Testes de integração OK
- [ ] Logs monitorados
- [ ] Alertas configurados

---

**Status**: 🟢 **PRONTO PARA PRODUÇÃO**
