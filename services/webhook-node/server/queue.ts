import { Queue } from 'bullmq';
import IORedis from 'ioredis';

/**
 * Configuração da Fila de Processamento do Agente
 * Utiliza BullMQ + Redis para processamento assíncrono
 */

const REDIS_URL = REPLACE_WITH_REDIS_URL || 'redis://127.0.0.1:6379';

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

/**
 * Fila para processamento de mensagens pelo Agente ADK
 */
export const agentQueue = new Queue('agent-processing', { connection });

/**
 * Configurar listeners globais da fila
 */
agentQueue.on('error', (err) => {
  console.error('[Queue] Error:', err);
});

agentQueue.on('waiting', (job) => {
  console.log(`[Queue] Job ${job.id} is waiting to be processed`);
});

agentQueue.on('active', (job) => {
  console.log(`[Queue] Job ${job.id} is now active`);
});

agentQueue.on('completed', (job) => {
  console.log(`[Queue] Job ${job.id} completed successfully`);
});

agentQueue.on('failed', (job, err) => {
  console.error(`[Queue] Job ${job?.id} failed:`, err);
});

export default agentQueue;
