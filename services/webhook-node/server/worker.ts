import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import axios from 'axios';
import { agentService } from './services/agent';
import { updateMessagePostProcessing } from './db_messages';

/**
 * Worker para Processamento Assíncrono de Mensagens
 * Processa jobs da fila agentQueue e envia respostas via WhatsApp API
 */

const REDIS_URL = REPLACE_WITH_REDIS_URL || 'redis://127.0.0.1:6379';
const WHATSAPP_ACCESS_TOKEN = REPLACE_WITH_WHATSAPP_ACCESS_TOKEN || '';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

/**
 * Enviar mensagem via WhatsApp Cloud API
 */
async function sendWhatsAppMessage(phoneNumber: string, messageText: string): Promise<boolean> {
  try {
    const response = await axios.post(
      `https://graph.instagram.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phoneNumber,
        type: 'text',
        text: {
          body: messageText,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`[WhatsApp] Message sent to ${phoneNumber}:`, response.data);
    return true;
  } catch (error) {
    console.error(`[WhatsApp] Error sending message to ${phoneNumber}:`, error);
    return false;
  }
}

/**
 * Processar job de mensagem
 */
async function processMessageJob(job: Job<{
  messageId: string;
  phoneNumber: string;
  text: string;
}>) {
  const { messageId, phoneNumber, text } = job.data;

  console.log(`[Worker] Processing job ${job.id} for ${phoneNumber}`);

  try {
    // 1. Chamar o Agente ADK
    console.log(`[Worker] Invoking agent for message: ${text}`);
    const agentResponse = await agentService.processMessage(messageId, text, phoneNumber);

    if (!agentResponse) {
      throw new Error('Agent returned empty response');
    }

    // 2. Persistir a resposta do agente no BD
    const persistedResponse = await updateMessagePostProcessing(
      messageId,
      agentResponse,
      'completed'
    );

    if (!persistedResponse) {
      console.warn(`[Worker] Failed to persist agent response for message ${messageId}`);
    }

    // 3. Enviar a resposta para o usuário via WhatsApp API
    const sent = await sendWhatsAppMessage(phoneNumber, agentResponse);

    if (!sent) {
      throw new Error('Failed to send WhatsApp message');
    }

    console.log(`[Worker] Job ${job.id} completed successfully`);
    return { success: true, messageId, phoneNumber };
  } catch (error) {
    console.error(`[Worker] Job ${job.id} failed:`, error);

    // Persistir o erro no banco de dados
    await updateMessagePostProcessing(
      messageId,
      '',
      'failed',
      error instanceof Error ? error.message : 'Unknown error'
    );

    // Lançar erro para o BullMQ tentar novamente
    throw error;
  }
}

/**
 * Inicializar o Worker
 */
const worker = new Worker('agent-processing', processMessageJob, {
  connection,
  concurrency: 5, // Processar até 5 jobs em paralelo
  settings: {
    maxStalledCount: 2,
    stalledInterval: 30000,
    maxStalledCount: 2,
    lockDuration: 30000,
    lockRenewTime: 15000,
  },
});

worker.on('error', (err) => {
  console.error('[Worker] Error:', err);
});

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Worker] Shutting down gracefully...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Worker] Shutting down gracefully...');
  await worker.close();
  process.exit(0);
});

console.log('[Worker] Started and listening for jobs...');
