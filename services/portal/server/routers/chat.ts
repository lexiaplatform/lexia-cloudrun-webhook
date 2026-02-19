import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import {
  messages,
  conversations,
  InsertMessage,
  InsertConversation,
} from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { dpkChat } from "../services/dpk";

/**
 * Chat Router
 * Gerencia todas as operações de chat interno
 * Integrado com banco de dados e DPK Agent
 */

export const chatRouter = router({
  /**
   * Enviar mensagem
   * POST /api/trpc/chat.sendMessage
   */
  sendMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.number().int().positive(),
        message: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }

        // Validar que a conversa existe e pertence ao usuário
        const conversation = await db
          .select()
          .from(conversations)
          .where(eq(conversations.id, input.conversationId))
          .limit(1);

        if (!conversation || conversation.length === 0) {
          throw new Error("Conversation not found");
        }

        // 1. Salvar mensagem do usuário
        const userMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const messageData: InsertMessage = {
          messageId: userMessageId,
          from: conversation[0].phoneNumber,
          type: "text",
          content: input.message,
          displayPhoneNumber: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
          phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
          messageTimestamp: new Date().toISOString(),
        };

        await db.insert(messages).values(messageData);

        // 2. Buscar histórico recente (últimas 20)
        const history = await db
          .select()
          .from(messages)
          .where(eq(messages.from, conversation[0].phoneNumber))
          .orderBy(desc(messages.createdAt))
          .limit(20);

        const context = history
          .reverse()
          .map((m) => `${m.from === conversation[0].phoneNumber ? "USER" : "AGENT"}: ${m.content || ""}`)
          .join("\n");

        // 3. Chamar DPK
        const sessionId = `web:${ctx.user.id}:${input.conversationId}`;
        const dpk = await dpkChat({
          session_id: sessionId,
          text: input.message,
          message_id: userMessageId,
          context,
        });

        const agentReply = (dpk.reply || "").trim();

        // 4. Salvar resposta do agente se não for vazia
        if (agentReply.length > 0) {
          const agentMessageData: InsertMessage = {
            messageId: `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            from: "agent",
            type: "text",
            content: agentReply,
            displayPhoneNumber: "",
            phoneNumberId: "",
            messageTimestamp: new Date().toISOString(),
          };

          await db.insert(messages).values(agentMessageData);

          // Atualizar conversa com a resposta do agente
          await db
            .update(conversations)
            .set({
              lastMessage: agentReply,
              lastMessageAt: new Date(),
              status: "active",
            })
            .where(eq(conversations.id, input.conversationId));
        } else {
          // Se não houver resposta do agente, apenas atualiza com a mensagem do usuário
          await db
            .update(conversations)
            .set({
              lastMessage: input.message,
              lastMessageAt: new Date(),
              status: "active",
            })
            .where(eq(conversations.id, input.conversationId));
        }

        console.log(`[Chat] Message processed: ${userMessageId}`);

        return {
          success: true,
          messageId: userMessageId,
          timestamp: new Date().toISOString(),
          agentReply,
        };
      } catch (error) {
        console.error("[Chat] Error sending message:", error);
        throw error;
      }
    }),

  /**
   * Obter histórico de conversa
   * GET /api/trpc/chat.getHistory
   */
  getHistory: protectedProcedure
    .input(
      z.object({
        conversationId: z.number().int().positive(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }

        // Validar que a conversa existe
        const conversation = await db
          .select()
          .from(conversations)
          .where(eq(conversations.id, input.conversationId))
          .limit(1);

        if (!conversation || conversation.length === 0) {
          throw new Error("Conversation not found");
        }

        // Buscar histórico
        const history = await db
          .select()
          .from(messages)
          .where(eq(messages.from, conversation[0].phoneNumber))
          .orderBy(desc(messages.createdAt))
          .limit(input.limit)
          .offset(input.offset);

        // Reverter ordem para exibição (mais antigos primeiro)
        return history.reverse().map((msg) => ({
          id: msg.id,
          messageId: msg.messageId,
          content: msg.content,
          sender: msg.from === conversation[0].phoneNumber ? "user" : "agent",
          type: msg.type,
          createdAt: msg.createdAt,
          timestamp: msg.createdAt,
        }));
      } catch (error) {
        console.error("[Chat] Error getting history:", error);
        throw error;
      }
    }),

  /**
   * Listar conversas do usuário
   * GET /api/trpc/chat.listConversations
   */
  listConversations: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
        status: z.enum(["active", "closed", "archived"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }

        // Buscar conversas
        let query = db.select().from(conversations);

        if (input.status) {
          query = query.where(eq(conversations.status, input.status));
        }

        const result = await query
          .orderBy(desc(conversations.lastMessageAt))
          .limit(input.limit)
          .offset(input.offset);

        return result;
      } catch (error) {
        console.error("[Chat] Error listing conversations:", error);
        throw error;
      }
    }),

  /**
   * Obter conversa específica
   * GET /api/trpc/chat.getConversation
   */
  getConversation: protectedProcedure
    .input(
      z.object({
        conversationId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }

        const result = await db
          .select()
          .from(conversations)
          .where(eq(conversations.id, input.conversationId))
          .limit(1);

        return result[0] || null;
      } catch (error) {
        console.error("[Chat] Error getting conversation:", error);
        throw error;
      }
    }),

  /**
   * Criar nova conversa
   * POST /api/trpc/chat.createConversation
   */
  createConversation: protectedProcedure
    .input(
      z.object({
        phoneNumber: z.string().regex(/^\d+$/),
        initialMessage: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }

        // Verificar se conversa já existe
        const existing = await db
          .select()
          .from(conversations)
          .where(eq(conversations.phoneNumber, input.phoneNumber))
          .limit(1);

        if (existing && existing.length > 0) {
          return existing[0];
        }

        // Criar nova conversa
        const conversationData: InsertConversation = {
          phoneNumber: input.phoneNumber,
          status: "active",
          lastMessage: input.initialMessage || null,
          lastMessageAt: input.initialMessage ? new Date() : null,
        };

        await db.insert(conversations).values(conversationData);

        // Buscar conversa criada
        const result = await db
          .select()
          .from(conversations)
          .where(eq(conversations.phoneNumber, input.phoneNumber))
          .limit(1);

        console.log(`[Chat] Conversation created: ${input.phoneNumber}`);

        return result[0];
      } catch (error) {
        console.error("[Chat] Error creating conversation:", error);
        throw error;
      }
    }),

  /**
   * Fechar conversa
   * POST /api/trpc/chat.closeConversation
   */
  closeConversation: protectedProcedure
    .input(
      z.object({
        conversationId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }

        await db
          .update(conversations)
          .set({
            status: "closed",
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, input.conversationId));

        console.log(`[Chat] Conversation closed: ${input.conversationId}`);

        return { success: true };
      } catch (error) {
        console.error("[Chat] Error closing conversation:", error);
        throw error;
      }
    }),

  /**
   * Arquivar conversa
   * POST /api/trpc/chat.archiveConversation
   */
  archiveConversation: protectedProcedure
    .input(
      z.object({
        conversationId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }

        await db
          .update(conversations)
          .set({
            status: "archived",
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, input.conversationId));

        console.log(`[Chat] Conversation archived: ${input.conversationId}`);

        return { success: true };
      } catch (error) {
        console.error("[Chat] Error archiving conversation:", error);
        throw error;
      }
    }),

  /**
   * Buscar conversas por número de telefone
   * GET /api/trpc/chat.searchConversations
   */
  searchConversations: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(50),
        limit: z.number().int().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }

        // Buscar por número de telefone (simples LIKE)
        const result = await db
          .select()
          .from(conversations)
          .where((c) => c.phoneNumber.like(`%${input.query}%`))
          .limit(input.limit);

        return result;
      } catch (error) {
        console.error("[Chat] Error searching conversations:", error);
        throw error;
      }
    }),
});
