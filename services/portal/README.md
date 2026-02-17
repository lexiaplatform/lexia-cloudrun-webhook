# Projeto Unificado – Léxia Platform com Integração Vertex AI

Este repositório contém o projeto completo e unificado da plataforma Léxia, incluindo o frontend, backend, banco de dados, chat, e as integrações com o Vertex AI Agent e WhatsApp Cloud API.

## Estrutura do Projeto

- **`client/`**: Aplicação frontend desenvolvida com React e Vite.
- **`server/`**: Aplicação backend desenvolvida com Express e tRPC.
- **`drizzle/`**: Arquivos de schema e migração do banco de dados (Drizzle ORM).
- **`shared/`**: Tipos e constantes compartilhados entre o frontend e o backend.

## Módulos de Integração

- **`server/services/vertex-ai.ts`**: Módulo responsável pela comunicação com a API do Vertex AI.
- **`server/routers/vertex-ai.ts`**: Rota tRPC para expor o serviço do Vertex AI ao frontend.
- **`server/webhooks/whatsapp.ts`**: Webhook para receber e processar mensagens do WhatsApp Cloud API.

## Configuração e Deployment

Consulte o arquivo `DEPLOYMENT_GUIDE.md` para obter instruções detalhadas sobre como configurar e implantar o projeto no Render.
