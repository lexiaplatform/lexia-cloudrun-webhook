/**
 * Processamento direto sem BullMQ / Redis
 * Execução síncrona simples
 */

export async function enqueueAgentProcessing(
  message: string,
  processFn: (msg: string) => Promise<string>
): Promise<string> {
  try {
    return await processFn(message);
  } catch (error) {
    console.error('[Agent] Processing error:', error);
    throw error;
  }
}
