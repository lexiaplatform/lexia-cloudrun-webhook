> Este arquivo foi gerado para substituir o `DEPLOYMENT_GUIDE.md` existente, que era específico para as etapas 7-8. O novo guia cobre o deploy do projeto unificado como um todo.

# Guia de Deployment – Projeto Unificado Léxia Platform

Este guia fornece as instruções passo a passo para configurar e implantar o projeto unificado da plataforma Léxia no Render.

## 1. Preparação

1. Crie um novo repositório no GitHub.
2. Envie todos os arquivos deste projeto para o novo repositório.

## 2. Configuração no Render

1. Crie um novo "Web Service" no Render.
2. Conecte o repositório do GitHub que você acabou de criar.
3. Configure as seguintes variáveis de ambiente na seção "Environment" do seu serviço no Render. Use os valores do seu arquivo `.env.example` como referência.

## 3. Configuração do Build e Start

- **Build Command**: `pnpm install && pnpm run build`
- **Start Command**: `pnpm start`

## 4. Deploy

1. Clique em "Create Web Service".
2. O Render irá automaticamente fazer o build e o deploy do seu projeto.
3. Após o deploy, você receberá uma URL pública para o seu serviço (ex: `https://lexia-platform.onrender.com`).

## 5. Configuração do Webhook do WhatsApp

1. No painel do seu aplicativo do Facebook, vá para a seção "WhatsApp > Configuração".
2. Clique em "Editar" no campo "URL do Webhook".
3. Insira a URL do seu serviço no Render, seguida de `/webhooks/webhook` (ex: `https://lexia-platform.onrender.com/webhooks/webhook`).
4. Insira o mesmo `VERIFY_TOKEN` que você configurou nas suas variáveis de ambiente.
5. Clique em "Verificar e salvar".

## 6. Testando a Integração

- **Frontend**: Acesse a URL pública do seu serviço no Render para interagir com o chat.
- **WhatsApp**: Envie uma mensagem para o número de telefone configurado para testar a integração com o WhatsApp.
