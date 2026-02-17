const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001; // Porta para o webhook Asaas

// Middleware para verificar o token do webhook Asaas
const verifyAsaasWebhook = (req, res, next) => {
    const asaasWebhookToken = process.env.ASAAS_WEBHOOK_TOKEN;
    const receivedToken = req.headers['asaas-access-token'];

    if (!asaasWebhookToken || receivedToken !== asaasWebhookToken) {
        console.error('Webhook Asaas: Token de acesso inválido ou ausente.');
        return res.status(401).send('Unauthorized');
    }
    next();
};

app.use(bodyParser.json());
app.use(verifyAsaasWebhook); // Aplicar middleware de verificação

app.post('/asaas-webhook', async (req, res) => {
    const event = req.body;
    console.log('Webhook Asaas recebido:', JSON.stringify(event, null, 2));

    if (event.event === 'PAYMENT_RECEIVED' || event.event === 'PAYMENT_CONFIRMED') {
        const payment = event.payment;
        const asaasPaymentId = payment.id;
        const tenantId = payment.customer.externalReference; // Assumindo que o externalReference do cliente Asaas armazena o tenant_id

        if (!tenantId) {
            console.error('Webhook Asaas: tenant_id não encontrado no externalReference do cliente.');
            return res.status(400).send('Bad Request: tenant_id missing');
        }

        try {
            // Chamar o endpoint Python para processar a confirmação de pagamento
            const pythonApiUrl = process.env.PYTHON_API_BASE_URL || 'http://localhost:8080';
            const response = await axios.post(`${pythonApiUrl}/api/v1/analise-pf/processar-pagamento`, {
                tenant_id: tenantId,
                asaas_payment_id: asaasPaymentId
            });

            console.log('Resposta da API Python:', response.data);
            return res.status(200).send('Webhook processado com sucesso.');

        } catch (error) {
            console.error('Erro ao chamar API Python para processar pagamento:', error.message);
            if (error.response) {
                console.error('Detalhes do erro da API Python:', error.response.data);
                return res.status(error.response.status).send(error.response.data);
            }
            return res.status(500).send('Erro interno ao processar webhook.');
        }
    } else {
        console.log(`Evento Asaas ${event.event} ignorado.`);
        return res.status(200).send(`Evento ${event.event} recebido, mas não processado.`);
    }
});

app.listen(PORT, () => {
    console.log(`Servidor de webhook Asaas rodando na porta ${PORT}`);
});
