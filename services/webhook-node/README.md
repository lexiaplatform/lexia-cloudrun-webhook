# Léxia Platform – Projeto Unificado


## Estrutura do Projeto

- **`client/`** – Frontend React com Vite
- **`server/`** – Backend Express com tRPC
- **`shared/`** – Tipos e constantes compartilhadas
- **`drizzle/`** – Schema e migrações do banco de dados

## Configuração Rápida

1. Clone o repositório
2. Configure as variáveis de ambiente (veja `.env.example`)
3. Execute `pnpm install`
4. Execute `pnpm build`
5. Execute `pnpm start`

## Variáveis de Ambiente Obrigatórias

- `DATABASE_URL` – Conexão MySQL
- `GOOGLE_CLOUD_PROJECT` – ID do projeto Google Cloud
- `GOOGLE_CLOUD_LOCATION` – Região do Google Cloud
- `WHATSAPP_ACCESS_TOKEN` – Token da API WhatsApp
- `WHATSAPP_PHONE_NUMBER_ID` – ID do número de telefone
- `WHATSAPP_BUSINESS_ACCOUNT_ID` – ID da conta de negócios
- `WHATSAPP_VERIFY_TOKEN` – Token de verificação do webhook

## Deploy no Render

1. Conecte o repositório GitHub ao Render
2. Configure as variáveis de ambiente no dashboard
3. Build Command: `pnpm install && pnpm build`
4. Start Command: `pnpm start`
