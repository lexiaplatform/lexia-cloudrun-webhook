# Léxia WhatsApp Webhook – Cloud Run Deployment Guide

Servidor webhook de WhatsApp para a plataforma Léxia, otimizado para deploy no **Google Cloud Run**.

## 📋 Visão Geral

Este projeto implementa um webhook de WhatsApp integrado com:

- **Express.js** – Framework web Node.js
- **TypeScript** – Type safety em produção
- **MySQL/Drizzle ORM** – Persistência de dados
- **Google Cloud Run** – Container serverless
- **Docker** – Containerização

## 🚀 Quick Start (Local Development)

### Pré-requisitos

- Node.js 20+
- pnpm 10+
- MySQL 8.0+ (ou TiDB)

### Instalação

```bash
# Clone o repositório
git clone https://github.com/lexiaplatform/lexia-cloudrun-webhook.git
cd lexia-cloudrun-webhook

# Instale as dependências
pnpm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com seus valores reais
```

### Desenvolvimento

```bash
# Build do webhook
pnpm webhook:build

# Inicie o servidor
pnpm webhook:start

# Teste o health check
curl http://localhost:8080/health
```

## 🔧 Variáveis de Ambiente Necessárias

### WhatsApp Cloud API

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| `VERIFY_TOKEN` | Token de verificação do webhook (qualquer string) | ✅ Sim |
| `WHATSAPP_ACCESS_TOKEN` | Token de acesso permanente da API WhatsApp | ✅ Sim |
| `WHATSAPP_PHONE_NUMBER_ID` | ID do número de telefone WhatsApp Business | ✅ Sim |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | ID da conta de negócios WhatsApp | ✅ Sim |

### Database

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| `DATABASE_URL` | String de conexão MySQL (ex: `mysql://user:pass@host:3306/db`) | ✅ Sim |

### Google Cloud / Vertex AI (Opcional)

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| `GOOGLE_CLOUD_PROJECT` | ID do projeto Google Cloud | ❌ Não |
| `GOOGLE_CLOUD_LOCATION` | Região do Google Cloud (ex: `us-central1`) | ❌ Não |
| `AGENT_ID` | ID do agente Vertex AI | ❌ Não |

### Server Configuration

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `NODE_ENV` | Ambiente de execução | `production` |
| `PORT` | Porta HTTP (Cloud Run injeta automaticamente) | `8080` |

## 🐳 Docker Build & Run

### Build Local

```bash
docker build -t lexia-webhook:latest .
```

### Run Local

```bash
docker run -p 8080:8080 \
  -e NODE_ENV=production \
  -e VERIFY_TOKEN=seu_token \
  -e WHATSAPP_ACCESS_TOKEN=seu_token \
  -e WHATSAPP_PHONE_NUMBER_ID=seu_id \
  -e DATABASE_URL=mysql://user:pass@host:3306/db \
  lexia-webhook:latest
```

## ☁️ Deploy no Google Cloud Run

### Pré-requisitos

- Google Cloud Project com Cloud Run habilitado
- `gcloud` CLI instalado e autenticado
- Artifact Registry ou Docker Hub configurado

### Passo 1: Build e Push da Imagem

```bash
# Configure o projeto
gcloud config set project YOUR_PROJECT_ID

# Build e push para Artifact Registry
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/lexia-webhook:latest .
```

### Passo 2: Deploy no Cloud Run

```bash
gcloud run deploy lexia-webhook \
  --image gcr.io/YOUR_PROJECT_ID/lexia-webhook:latest \
  --platform managed \
  --region us-central1 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --set-env-vars NODE_ENV=production \
  --set-env-vars VERIFY_TOKEN=seu_token \
  --set-env-vars WHATSAPP_ACCESS_TOKEN=seu_token \
  --set-env-vars WHATSAPP_PHONE_NUMBER_ID=seu_id \
  --set-env-vars WHATSAPP_BUSINESS_ACCOUNT_ID=seu_id \
  --set-env-vars DATABASE_URL=mysql://user:pass@host:3306/db \
  --allow-unauthenticated
```

### Passo 3: Configurar Webhook no WhatsApp

1. Vá para [Meta Business Manager](https://business.facebook.com)
2. Selecione sua aplicação WhatsApp
3. Em "Webhooks", configure:
   - **Callback URL**: `https://seu-cloud-run-url/webhook`
   - **Verify Token**: O valor que você definiu em `VERIFY_TOKEN`
4. Inscreva-se nos eventos: `messages`, `message_status`

## 📊 Endpoints

### Health Check

```bash
GET /health

# Response
{
  "status": "ok",
  "timestamp": "2026-02-16T23:47:07.617Z",
  "environment": "production",
  "uptime": 3.006302411
}
```

### Webhook Validation

```bash
GET /webhook?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=CHALLENGE
```

### Webhook Events

```bash
POST /webhook

# Body (WhatsApp Cloud API format)
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "...",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": { ... },
            "messages": [ ... ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

### Logs

```bash
GET /webhook/logs?limit=100

# Response
{
  "timestamp": "2026-02-16T23:47:07.617Z",
  "environment": "production",
  "logCount": 42,
  "logs": [ ... ]
}
```

## 🔒 Segurança

### Boas Práticas Implementadas

- ✅ Nenhum secret commitado (`.env` ignorado)
- ✅ Variáveis de ambiente para todas as credenciais
- ✅ `.gitignore` protege `.pem`, `.key`, `service-account.json`
- ✅ Servidor escuta em `0.0.0.0` (compatível com Cloud Run)
- ✅ PORT configurável via `process.env.PORT`
- ✅ Logging estruturado sem exposição de secrets

### ⚠️ NUNCA Commitar

```
❌ .env
❌ .env.production
❌ *.pem, *.key
❌ *service-account*.json
❌ Tokens ou credenciais em código
```

## 📦 Build Scripts

```bash
# Build webhook bundle
pnpm webhook:build

# Start webhook server
pnpm webhook:start

# Development mode
pnpm webhook:dev

# Type checking
pnpm check

# Format code
pnpm format

# Run tests
pnpm test
```

## 🗂️ Estrutura do Projeto

```
.
├── server/
│   ├── webhook.ts          # Servidor webhook principal
│   ├── db_messages.ts      # Funções de banco de dados
│   ├── db.ts               # Configuração do banco
│   └── ...
├── shared/                 # Tipos compartilhados
├── drizzle/                # Schema e migrações
├── Dockerfile              # Imagem Docker
├── package.json            # Dependências
├── pnpm-lock.yaml          # Lock file
└── README_CLOUDRUN_DEPLOYMENT.md  # Este arquivo
```

## 🐛 Troubleshooting

### Erro: "Cannot find module 'express'"

```bash
pnpm install
```

### Erro: "Database connection failed"

Verifique:
- `DATABASE_URL` está correto
- Banco de dados está acessível
- Firewall permite conexão

### Erro: "Webhook validation failed"

Verifique:
- `VERIFY_TOKEN` é o mesmo no código e no WhatsApp
- URL do webhook é acessível publicamente
- Cloud Run permite requisições não autenticadas

### Logs não aparecem

```bash
# Ver logs do Cloud Run
gcloud run logs read lexia-webhook --limit 50
```

## 📝 Logs e Monitoramento

O servidor registra automaticamente:

- ✅ Requisições de validação do webhook
- ✅ Mensagens recebidas
- ✅ Status de entrega
- ✅ Erros e exceções

Acesse via endpoint `/webhook/logs` ou Cloud Run Logs.

## 🔄 CI/CD (Opcional)

Para automatizar o deploy, configure GitHub Actions:

```yaml
name: Deploy to Cloud Run
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: google-github-actions/setup-gcloud@v1
      - run: gcloud builds submit --tag gcr.io/$PROJECT_ID/lexia-webhook
      - run: gcloud run deploy lexia-webhook --image gcr.io/$PROJECT_ID/lexia-webhook
```

## 📞 Suporte

Para dúvidas ou problemas:

1. Verifique os logs: `gcloud run logs read lexia-webhook`
2. Teste localmente: `pnpm webhook:start`
3. Valide as variáveis de ambiente

## 📄 Licença

MIT

---

**Última atualização**: 16 de fevereiro de 2026
