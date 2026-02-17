import { getDb } from "./db";
import {
  messages,
  messageStatuses,
  conversations,
  transactions,
  webhookLogs,
  InsertMessage,
  InsertMessageStatus,
  InsertConversation,
  InsertTransaction,
  InsertWebhookLog,
} from "../drizzle/schema";

/**
 * Database helper functions for messages and related data
 * Centraliza todas as operações de banco de dados
 */

// ============================================================================
// MESSAGES
// ============================================================================

/**
 * Salvar mensagem recebida do WhatsApp
 */
export async function saveMessage(data: InsertMessage): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[Database] Cannot save message: database not available");
      return false;
    }

    await db.insert(messages).values(data);
    console.log(`[Database] Message saved: ${data.messageId}`);
    return true;
  } catch (error) {
    console.error("[Database] Error saving message:", error);
    return false;
  }
}

/**
 * Obter mensagens de uma conversa
 */
export async function getConversationMessages(phoneNumber: string, limit = 50) {
  try {
    const db = await getDb();
    if (!db) return [];

    const result = await db
      .select()
      .from(messages)
      .where((msg) => msg.from === phoneNumber)
      .orderBy((msg) => msg.createdAt)
      .limit(limit);

    return result;
  } catch (error) {
    console.error("[Database] Error getting conversation messages:", error);
    return [];
  }
}

// ============================================================================
// MESSAGE STATUS
// ============================================================================

/**
 * Salvar status de entrega de mensagem
 */
export async function saveMessageStatus(data: InsertMessageStatus): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[Database] Cannot save message status: database not available");
      return false;
    }

    await db.insert(messageStatuses).values(data);
    console.log(`[Database] Message status saved: ${data.messageId} -> ${data.status}`);
    return true;
  } catch (error) {
    console.error("[Database] Error saving message status:", error);
    return false;
  }
}

// ============================================================================
// CONVERSATIONS
// ============================================================================

/**
 * Criar ou atualizar conversa
 */
export async function upsertConversation(data: InsertConversation): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[Database] Cannot upsert conversation: database not available");
      return false;
    }

    // Tentar inserir, se já existir, ignorar erro
    await db.insert(conversations).values(data).onDuplicateKeyUpdate({
      set: {
        lastMessage: data.lastMessage,
        lastMessageAt: data.lastMessageAt,
        status: data.status,
      },
    });

    console.log(`[Database] Conversation upserted: ${data.phoneNumber}`);
    return true;
  } catch (error) {
    console.error("[Database] Error upserting conversation:", error);
    return false;
  }
}

/**
 * Obter conversa por número de telefone
 */
export async function getConversation(phoneNumber: string) {
  try {
    const db = await getDb();
    if (!db) return null;

    const result = await db
      .select()
      .from(conversations)
      .where((conv) => conv.phoneNumber === phoneNumber)
      .limit(1);

    return result[0] || null;
  } catch (error) {
    console.error("[Database] Error getting conversation:", error);
    return null;
  }
}

// ============================================================================
// TRANSACTIONS
// ============================================================================

/**
 * Salvar transação de pagamento
 */
export async function saveTransaction(data: InsertTransaction): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[Database] Cannot save transaction: database not available");
      return false;
    }

    await db.insert(transactions).values(data);
    console.log(`[Database] Transaction saved: ${data.asaasId}`);
    return true;
  } catch (error) {
    console.error("[Database] Error saving transaction:", error);
    return false;
  }
}

/**
 * Atualizar status de transação
 */
export async function updateTransactionStatus(asaasId: string, status: string): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[Database] Cannot update transaction: database not available");
      return false;
    }

    await db
      .update(transactions)
      .set({
        status: status as any,
        updatedAt: new Date(),
      })
      .where((t) => t.asaasId === asaasId);

    console.log(`[Database] Transaction updated: ${asaasId} -> ${status}`);
    return true;
  } catch (error) {
    console.error("[Database] Error updating transaction:", error);
    return false;
  }
}

/**
 * Obter transação por Asaas ID
 */
export async function getTransaction(asaasId: string) {
  try {
    const db = await getDb();
    if (!db) return null;

    const result = await db
      .select()
      .from(transactions)
      .where((t) => t.asaasId === asaasId)
      .limit(1);

    return result[0] || null;
  } catch (error) {
    console.error("[Database] Error getting transaction:", error);
    return null;
  }
}

// ============================================================================
// WEBHOOK LOGS
// ============================================================================

/**
 * Salvar log de webhook
 */
export async function saveWebhookLog(data: InsertWebhookLog): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[Database] Cannot save webhook log: database not available");
      return false;
    }

    await db.insert(webhookLogs).values(data);
    console.log(`[Database] Webhook log saved: ${data.webhookType} -> ${data.event}`);
    return true;
  } catch (error) {
    console.error("[Database] Error saving webhook log:", error);
    return false;
  }
}

/**
 * Obter logs de webhook recentes
 */
export async function getWebhookLogs(webhookType: string, limit = 100) {
  try {
    const db = await getDb();
    if (!db) return [];

    const result = await db
      .select()
      .from(webhookLogs)
      .where((log) => log.webhookType === webhookType)
      .orderBy((log) => log.createdAt)
      .limit(limit);

    return result;
  } catch (error) {
    console.error("[Database] Error getting webhook logs:", error);
    return [];
  }
}
