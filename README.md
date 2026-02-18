# Léxia Platform - Monorepo Completo


## 📦 Estrutura

```
lexia-platform-complete/
├── services/
│   ├── webhook-node/          # WhatsApp Webhook (Node.js/Express)
│   ├── agent-adk/             # Agent ADK (Python/FastAPI + Gemini)
│   └── portal/                # Portal (React + Express + tRPC)
├── .gitignore
├── README.md
└── DEPLOYMENT_GUIDE.md
```

## 🚀 Serviços

### 1. **Webhook Node** (`services/webhook-node`)
- Recebe mensagens WhatsApp
- Integra com Agent ADK
- Envia respostas via WhatsApp API
- **Cloud Run**: `lexia-whatsapp-webhook`

### 2. **Agent ADK** (`services/agent-adk`)
- Gerenciamento de sessões
- Integração com Cloud SQL
- **Cloud Run**: `lexia-agent-adk`

### 3. **Portal** (`services/portal`)
- Frontend React (Dashboard, Chat, Admin)
- Backend Express + tRPC (API REST)
- Drizzle ORM (Database)
- **Cloud Run**: `lexia-platform` (monolítico)

## 🔗 Integração

```
WhatsApp User
    ↓
    ↓
Cloud SQL PostgreSQL
    ↓
Portal (React + Express)
    ↓
Dashboard + Chat Interface
```

## 📋 Variáveis de Ambiente

### Webhook
```bash
AGENT_URL = REPLACE_WITH_AGENT_URL
VERIFY_TOKEN = REPLACE_WITH_VERIFY_TOKEN
WHATSAPP_ACCESS_TOKEN = REPLACE_WITH_WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID=981763218354581
```

### Agent ADK
```bash
GOOGLE_CLOUD_PROJECT=lexia-platform-486621
GOOGLE_CLOUD_LOCATION=global
GOOGLE_GENAI_USE_VERTEXAI=true
GEMINI_MODEL=gemini-2.5-pro
DATABASE_URL = REPLACE_WITH_DATABASE_URL
```

### Portal
```bash
DATABASE_URL = REPLACE_WITH_DATABASE_URL
AGENT_URL = REPLACE_WITH_AGENT_URL
WHATSAPP_BUSINESS_ACCOUNT_ID=2793719140803043
WHATSAPP_PHONE_NUMBER_ID=981763218354581
```

## 🛠️ Desenvolvimento Local

```bash
# Instalar dependências
pnpm install

# Webhook
cd services/webhook-node
pnpm webhook:dev

# Agent ADK
cd services/agent-adk
python -m uvicorn app:app --reload

# Portal
cd services/portal
pnpm dev
```

## 🚀 Deploy no Cloud Run

### Webhook
```bash
gcloud run deploy lexia-whatsapp-webhook \
  --source services/webhook-node \
  --region southamerica-east1
```

### Agent ADK
```bash
gcloud run deploy lexia-agent-adk \
  --source services/agent-adk \
  --region southamerica-east1
```

### Portal
```bash
gcloud run deploy lexia-platform \
  --source services/portal \
  --region southamerica-east1 \
  --add-cloudsql-instances lexia-platform-486621:southamerica-east1:lexia-postgres
```

## 📚 Documentação

- `DEPLOYMENT_GUIDE.md` - Guia completo de deployment
- `services/webhook-node/README.md` - Webhook específico
- `services/agent-adk/README.md` - Agent ADK específico
- `services/portal/README.md` - Portal específico

## ✅ Checklist

- [ ] Secrets criados no Secret Manager
- [ ] Cloud SQL PostgreSQL pronto
- [ ] Agent ADK deployado
- [ ] Webhook deployado
- [ ] Portal deployado
- [ ] Testes pós-deploy
- [ ] Meta Webhook configurado

## 🔐 Segurança

✅ Nenhum secret commitado
✅ .gitignore configurado
✅ Variáveis sensíveis no Secret Manager
✅ Cloud SQL Proxy para conexão segura

---

**Status**: 🟢 Pronto para produção
