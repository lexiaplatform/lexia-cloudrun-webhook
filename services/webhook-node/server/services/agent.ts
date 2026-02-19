import { getDb } from "../db";
import { messages as dbMessages } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { dpkChat } from "./dpk";

/**
 * Léxia Agent Service - Webhook Node Edition
 * Agora atua como um proxy para o agent-adk (DPK)
 */
export class AgentService {
  /**
   * Processar mensagem do usuário e retornar resposta do agente via DPK
   */
  async processMessage(sessionId: string, text: string, phoneNumber: string, messageId?: string) {
    const db = await getDb();
    
    // 1. Obter histórico da conversa (últimas 20 mensagens)
    const history = await db
      .select()
      .from(dbMessages)
      .where(eq(dbMessages.from, phoneNumber))
      .orderBy(desc(dbMessages.createdAt))
      .limit(20);

    // 2. Montar contexto simples para o DPK
    const context = history
      .reverse()
      .map((m) => `${m.from === phoneNumber ? "USER" : "AGENT"}: ${m.content || ""}`)
      .join("\n");

    // 3. Chamar DPK
    const dpk = await dpkChat({
      session_id: sessionId,
      text,
      message_id: messageId,
      context,
    });

    return (dpk.reply || "").trim();
  }
}

export const agentService = new AgentService();
