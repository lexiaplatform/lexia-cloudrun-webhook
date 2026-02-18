# ☁️ Configuração do Cloud Run - Guia Passo a Passo

## O Que Você Precisa Fazer

### 1️⃣ Configurar Secrets no GitHub (5 minutos)

Vá para: **GitHub → Settings → Secrets and variables → Actions**

Adicione esses secrets:

```
GCP_PROJECT_ID = seu-projeto-gcp
WIF_PROVIDER = projects/SEU-PROJECT-NUMBER/locations/global/workloadIdentityPools/github/providers/github
WIF_SERVICE_ACCOUNT = github-actions@seu-projeto-gcp.iam.gserviceaccount.com

REDIS_URL = REPLACE_WITH_REDIS_URL
WHATSAPP_ACCESS_TOKEN = REPLACE_WITH_WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID = seu-phone-id
WHATSAPP_BUSINESS_ACCOUNT_ID = seu-business-id
VERIFY_TOKEN = REPLACE_WITH_VERIFY_TOKEN
DATABASE_URL = REPLACE_WITH_DATABASE_URL
ASAAS_API_KEY = REPLACE_WITH_ASAAS_API_KEY
ASAAS_WEBHOOK_TOKEN = REPLACE_WITH_ASAAS_WEBHOOK_TOKEN
INFOSIMPLES_API_KEY = REPLACE_WITH_INFOSIMPLES_API_KEY
```

### 2️⃣ Fazer Push para GitHub

```bash
cd /tmp/lexia-repo
git add -A
git commit -m "chore: add Cloud Run deployment configuration"
git push origin main
```

**O que acontece automaticamente:**
- GitHub Actions detecta o push
- Faz build da imagem Docker
- Faz push para Google Container Registry
- Deploy automático no Cloud Run
- Executa migrações do banco de dados
- Inicia webhook + worker

### 3️⃣ Acompanhar o Deploy

Vá para: **GitHub → Actions**

Você verá o workflow `Deploy to Cloud Run` rodando. Espere completar (5-10 minutos).

Quando terminar, você verá:
```
✅ Deployment successful!
Service: lexia-webhook
Region: southamerica-east1
URL: https://lexia-webhook-xxxxx.a.run.app
```

---

## Variáveis de Ambiente Explicadas

| Variável | O que é | Onde obter |
|----------|---------|-----------|
| `REDIS_URL` | URL do Redis Cloud | Redis Cloud Console |
| `WHATSAPP_ACCESS_TOKEN` | Token do WhatsApp | Meta Business Manager |
| `WHATSAPP_PHONE_NUMBER_ID` | ID do número WhatsApp | Meta Business Manager |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | ID da conta de negócio | Meta Business Manager |
| `VERIFY_TOKEN` | Token para validar webhook | Você cria (qualquer string) |
| `DATABASE_URL` | URL do MySQL | Cloud SQL Console |
| `ASAAS_API_KEY` | Chave API do Asaas | Dashboard Asaas |
| `ASAAS_WEBHOOK_TOKEN` | Token do webhook Asaas | Você cria |
| `INFOSIMPLES_API_KEY` | Chave API InfoSimples | Dashboard InfoSimples |

---

## Arquivos Criados

### 1. Dockerfile
Arquivo que descreve como construir a imagem Docker. Ele:
- Instala dependências
- Faz build do TypeScript
- Executa migrações
- Inicia webhook + worker

### 2. .github/workflows/deploy-cloud-run.yml
Arquivo que configura o GitHub Actions. Ele:
- Detecta push para main
- Faz build da imagem
- Faz deploy no Cloud Run
- Configura variáveis de ambiente

### 3. services/webhook-node/start.sh
Script que inicia webhook e worker no Cloud Run

### 4. cloudbuild.yaml
Alternativa ao GitHub Actions (se preferir usar Cloud Build)

---

## Checklist: O Que Você Precisa Fazer

- [ ] 1. Adicionar secrets no GitHub
- [ ] 2. Fazer push para GitHub (`git push origin main`)
- [ ] 3. Acompanhar deploy em GitHub → Actions
- [ ] 4. Testar webhook com curl
- [ ] 5. Verificar logs no Cloud Run

---

## Testando Depois do Deploy

Depois que o deploy terminar, você terá uma URL como:
```
https://lexia-webhook-xxxxx.a.run.app
```

Para testar:

```bash
curl -X POST https://lexia-webhook-xxxxx.a.run.app/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "123",
      "changes": [{
        "field": "messages",
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "display_phone_number": "5511999999999",
            "phone_number_id": "123456"
          },
          "messages": [{
            "from": "5511999999999",
            "id": "msg_123",
            "timestamp": "1234567890",
            "type": "text",
            "text": {
              "body": "Oi, quero alugar um carro"
            }
          }]
        }
      }]
    }]
  }'
```

Você deve receber:
```json
{
  "status": "success",
  "message": "Message received and queued for processing"
}
```

---

## Verificar Logs

No Google Cloud Console:

1. Vá para **Cloud Run**
2. Clique em **lexia-webhook**
3. Clique em **Logs**

Você verá:
```
Step 1: Checking environment variables...
✓ Environment check complete

Step 2: Running database migrations...
✓ Migrations complete

Step 3: Starting webhook server...
✓ Webhook started (PID: 123)

Step 4: Starting background worker...
✓ Worker started (PID: 456)

✅ Léxia is running!
```

---

## Se Algo Deu Errado

### Erro: "DATABASE_URL not set"
**Solução:** Adicione `DATABASE_URL` nos secrets do GitHub

### Erro: "REDIS_URL not set"
**Solução:** Adicione `REDIS_URL` nos secrets do GitHub

### Erro: "Migration failed"
**Solução:** Verifique se `DATABASE_URL` está correto. Teste localmente:
```bash
DATABASE_URL = REPLACE_WITH_DATABASE_URL pnpm run db:push
```

### Erro: "Webhook not responding"
**Solução:** Verifique se o Cloud Run está rodando:
```bash
gcloud run services describe lexia-webhook --region southamerica-east1
```

---

## Próximas Etapas

1. ✅ Fazer push para GitHub (você faz)
2. ✅ Acompanhar deploy (automático)
3. ✅ Testar webhook (você testa)
4. ✅ Configurar webhook da Meta (você configura)
5. ✅ Monitorar logs (você monitora)

---

## Resumo: O Que Acontece Automaticamente

```
Você faz: git push origin main
        ↓
GitHub Actions detecta
        ↓
Faz build da imagem Docker
        ↓
Push para Google Container Registry
        ↓
Cloud Run faz deploy
        ↓
Executa start.sh
        ↓
start.sh executa migrações
        ↓
start.sh inicia webhook (porta 8080)
        ↓
start.sh inicia worker (background)
        ↓
Seu sistema está pronto para receber mensagens do WhatsApp!
```

**Você não precisa fazer mais nada além de fazer push para GitHub.**
