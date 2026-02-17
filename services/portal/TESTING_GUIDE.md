# 🧪 GUIA DE TESTES - ETAPA 6

**Data**: 15 de Fevereiro de 2026  
**Status**: Testes Prontos para Execução

---

## 📋 TESTES A EXECUTAR

### 1. TESTES DE WEBHOOK WHATSAPP

#### 1.1 Validação do Webhook

```bash
# Teste de validação (deve retornar o challenge)
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=lexia_token_123&hub.challenge=test_challenge_123"

# Esperado: test_challenge_123
```

#### 1.2 Recebimento de Mensagem

```bash
# Enviar mensagem de teste
curl -X POST http://localhost:3000/webhook \
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
            "display_phone_number": "15557668506",
            "phone_number_id": "123456"
          },
          "messages": [{
            "from": "5511999999999",
            "id": "wamid.test_123",
            "timestamp": "1234567890",
            "type": "text",
            "text": { "body": "Teste de mensagem" }
          }]
        }
      }]
    }]
  }'

# Esperado: 200 OK
```

#### 1.3 Verificar Logs

```bash
# Visualizar logs do webhook
curl http://localhost:3000/webhook/logs

# Esperado: Array com logs recentes
```

---

### 2. TESTES DE WEBHOOK ASAAS

#### 2.1 Teste de Evento

```bash
# Enviar evento de teste
curl -X POST http://localhost:3000/webhooks/asaas/test \
  -H "Content-Type: application/json"

# Esperado: Evento processado com sucesso
```

#### 2.2 Recebimento de Evento Real

```bash
# Simular evento de pagamento recebido
curl -X POST http://localhost:3000/webhooks/asaas \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: seu_token_aqui" \
  -d '{
    "event": "PAYMENT_RECEIVED",
    "payment": {
      "id": "pay_123",
      "customer": {
        "id": "cus_123",
        "externalReference": "tenant_123"
      },
      "value": 100.00,
      "status": "RECEIVED",
      "dueDate": "2026-02-15",
      "confirmationDate": "2026-02-15T10:00:00Z"
    }
  }'

# Esperado: 200 OK
```

#### 2.3 Verificar Logs Asaas

```bash
# Visualizar logs do webhook Asaas
curl http://localhost:3000/webhooks/asaas/logs

# Esperado: Array com logs recentes
```

---

### 3. TESTES DE CHAT INTERNO

#### 3.1 Listar Conversas

```bash
# Fazer requisição tRPC
curl -X POST http://localhost:3000/api/trpc/chat.listConversations \
  -H "Content-Type: application/json" \
  -H "Cookie: session=seu_token_aqui" \
  -d '{"json":{}}'

# Esperado: Array de conversas
```

#### 3.2 Enviar Mensagem

```bash
# Enviar mensagem
curl -X POST http://localhost:3000/api/trpc/chat.sendMessage \
  -H "Content-Type: application/json" \
  -H "Cookie: session=seu_token_aqui" \
  -d '{
    "json": {
      "conversationId": 1,
      "message": "Teste de mensagem"
    }
  }'

# Esperado: { success: true, messageId: "..." }
```

#### 3.3 Obter Histórico

```bash
# Obter histórico
curl -X POST http://localhost:3000/api/trpc/chat.getHistory \
  -H "Content-Type: application/json" \
  -H "Cookie: session=seu_token_aqui" \
  -d '{
    "json": {
      "conversationId": 1,
      "limit": 50
    }
  }'

# Esperado: Array de mensagens
```

---

### 4. TESTES DE INFOSIMPLES

#### 4.1 Validar CPF

```bash
# Validar CPF (sem fazer requisição à API)
curl -X POST http://localhost:3000/api/trpc/infosimples.validateCPF \
  -H "Content-Type: application/json" \
  -d '{
    "json": {
      "cpf": "12345678900"
    }
  }'

# Esperado: { isValid: true/false, formatted: "..." }
```

#### 4.2 Consultar CPF

```bash
# Consultar dados de CPF (requer autenticação)
curl -X POST http://localhost:3000/api/trpc/infosimples.queryCPF \
  -H "Content-Type: application/json" \
  -H "Cookie: session=seu_token_aqui" \
  -d '{
    "json": {
      "cpf": "12345678900"
    }
  }'

# Esperado: Dados do CPF
```

#### 4.3 Validar CNPJ

```bash
# Validar CNPJ
curl -X POST http://localhost:3000/api/trpc/infosimples.validateCNPJ \
  -H "Content-Type: application/json" \
  -d '{
    "json": {
      "cnpj": "12345678000100"
    }
  }'

# Esperado: { isValid: true/false, formatted: "..." }
```

---

### 5. TESTES DE RATE LIMITING

#### 5.1 Teste de Limite de API

```bash
# Enviar 101 requisições (limite é 100 por 15 minutos)
for i in {1..101}; do
  curl http://localhost:3000/health
done

# Esperado: Última requisição retorna 429 Too Many Requests
```

#### 5.2 Teste de Limite de Webhook

```bash
# Enviar 1001 requisições (limite é 1000 por minuto)
for i in {1..1001}; do
  curl -X POST http://localhost:3000/webhook \
    -H "Content-Type: application/json" \
    -d '{}'
done

# Esperado: Última requisição retorna 429 Too Many Requests
```

---

### 6. TESTES DE BANCO DE DADOS

#### 6.1 Verificar Persistência de Mensagens

```bash
# Conectar ao banco MySQL
mysql -u usuario -p banco_lexia

# Verificar tabelas
SHOW TABLES;

# Contar mensagens
SELECT COUNT(*) FROM messages;

# Contar conversas
SELECT COUNT(*) FROM conversations;

# Contar transações
SELECT COUNT(*) FROM transactions;
```

#### 6.2 Verificar Integridade de Dados

```sql
-- Verificar mensagens recentes
SELECT * FROM messages ORDER BY createdAt DESC LIMIT 10;

-- Verificar conversas ativas
SELECT * FROM conversations WHERE status = 'active';

-- Verificar transações pendentes
SELECT * FROM transactions WHERE status = 'pending';
```

---

### 7. TESTES DE CARGA

#### 7.1 Teste de Carga com Apache Bench

```bash
# Instalar Apache Bench (se não tiver)
sudo apt-get install apache2-utils

# Teste de carga: 1000 requisições, 10 concorrentes
ab -n 1000 -c 10 http://localhost:3000/health

# Esperado: Tempo de resposta < 200ms
```

#### 7.2 Teste de Carga com Wrk

```bash
# Instalar Wrk (se não tiver)
sudo apt-get install wrk

# Teste de carga: 4 threads, 100 conexões, 30 segundos
wrk -t4 -c100 -d30s http://localhost:3000/health

# Esperado: Requisições por segundo > 100
```

---

### 8. TESTES DE SEGURANÇA

#### 8.1 Teste de CORS

```bash
# Verificar headers CORS
curl -H "Origin: http://example.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -X OPTIONS http://localhost:3000/api/trpc/chat.listConversations -v

# Esperado: Headers Access-Control-Allow-*
```

#### 8.2 Teste de Autenticação

```bash
# Tentar acessar endpoint protegido sem autenticação
curl -X POST http://localhost:3000/api/trpc/chat.sendMessage \
  -H "Content-Type: application/json" \
  -d '{"json":{"conversationId":1,"message":"teste"}}'

# Esperado: 401 Unauthorized
```

#### 8.3 Teste de Validação de Entrada

```bash
# Enviar entrada inválida
curl -X POST http://localhost:3000/api/trpc/chat.sendMessage \
  -H "Content-Type: application/json" \
  -H "Cookie: session=seu_token_aqui" \
  -d '{
    "json": {
      "conversationId": "invalid",
      "message": ""
    }
  }'

# Esperado: 400 Bad Request com mensagem de erro
```

---

## 🚀 COMO EXECUTAR OS TESTES

### Localmente

```bash
# 1. Instalar dependências
cd /home/ubuntu/lexia-project
pnpm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com valores reais

# 3. Iniciar servidor
pnpm dev

# 4. Em outro terminal, executar testes
bash TESTING_GUIDE.md
```

### Em Produção (Render)

```bash
# 1. Deploy no Render
# (Ver ETAPA 7: Deploy via GitHub + Render)

# 2. Executar testes contra URL de produção
curl https://lexia-whatsapp-webhook.onrender.com/health
```

---

## 📊 CHECKLIST DE TESTES

- [ ] Webhook WhatsApp - Validação
- [ ] Webhook WhatsApp - Recebimento
- [ ] Webhook WhatsApp - Logs
- [ ] Webhook Asaas - Teste
- [ ] Webhook Asaas - Evento Real
- [ ] Webhook Asaas - Logs
- [ ] Chat Interno - Listar Conversas
- [ ] Chat Interno - Enviar Mensagem
- [ ] Chat Interno - Histórico
- [ ] Infosimples - Validar CPF
- [ ] Infosimples - Consultar CPF
- [ ] Infosimples - Validar CNPJ
- [ ] Rate Limiting - API
- [ ] Rate Limiting - Webhook
- [ ] Banco de Dados - Persistência
- [ ] Banco de Dados - Integridade
- [ ] Carga - Apache Bench
- [ ] Carga - Wrk
- [ ] Segurança - CORS
- [ ] Segurança - Autenticação
- [ ] Segurança - Validação

---

## 🔍 TROUBLESHOOTING

### Erro: "Database not available"
- Verificar se DATABASE_URL está configurado
- Verificar conexão com MySQL
- Executar migrações: `pnpm db:push`

### Erro: "INFOSIMPLES_API_KEY not configured"
- Configurar variável de ambiente INFOSIMPLES_API_KEY
- Verificar se a chave é válida

### Erro: "Rate limit exceeded"
- Aguardar período de reset (15 minutos para API, 1 minuto para webhook)
- Ou usar Redis para compartilhar limite entre instâncias

### Erro: "Webhook validation failed"
- Verificar se VERIFY_TOKEN está correto
- Verificar se hub.verify_token na requisição corresponde

---

**Status**: Testes Prontos para Execução  
**Próxima Etapa**: ETAPA 7 - Deploy via GitHub + Render

