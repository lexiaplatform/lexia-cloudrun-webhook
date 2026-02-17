import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  index,
} from "drizzle-orm/mysql-core";

/**
 * Messages Table - Armazena todas as mensagens do WhatsApp
 * Crítico para auditoria e histórico de conversas
 */
export const messages = mysqlTable(
  "messages",
  {
    id: int("id").autoincrement().primaryKey(),
    // Identificador único da mensagem no WhatsApp
    messageId: varchar("messageId", { length: 64 }).notNull().unique(),
    // Número de telefone do remetente (sem formatação)
    from: varchar("from", { length: 20 }).notNull(),
    // Tipo de mensagem: text, button, image, etc
    type: mysqlEnum("type", ["text", "button", "image", "document", "audio", "video"]).notNull(),
    // Conteúdo da mensagem
    content: text("content"),
    // Payload de botão (se for tipo button)
    buttonPayload: text("buttonPayload"),
    // Metadados do WhatsApp
    displayPhoneNumber: varchar("displayPhoneNumber", { length: 20 }),
    phoneNumberId: varchar("phoneNumberId", { length: 64 }),
    // Timestamps
    messageTimestamp: varchar("messageTimestamp", { length: 32 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    // Índices para queries rápidas
    fromIdx: index("messages_from_idx").on(table.from),
    messageIdIdx: index("messages_messageId_idx").on(table.messageId),
    createdAtIdx: index("messages_createdAt_idx").on(table.createdAt),
    typeIdx: index("messages_type_idx").on(table.type),
  })
);

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

/**
 * Message Status Table - Rastreia status de entrega
 * Importante para confirmação de recebimento
 */
export const messageStatuses = mysqlTable(
  "message_statuses",
  {
    id: int("id").autoincrement().primaryKey(),
    // Referência à mensagem
    messageId: varchar("messageId", { length: 64 }).notNull(),
    // Status: sent, delivered, read, failed
    status: mysqlEnum("status", ["sent", "delivered", "read", "failed"]).notNull(),
    // ID do destinatário
    recipientId: varchar("recipientId", { length: 20 }).notNull(),
    // Timestamp do status
    statusTimestamp: varchar("statusTimestamp", { length: 32 }).notNull(),
    // Timestamps
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    messageIdIdx: index("messageStatuses_messageId_idx").on(table.messageId),
    statusIdx: index("messageStatuses_status_idx").on(table.status),
  })
);

export type MessageStatus = typeof messageStatuses.$inferSelect;
export type InsertMessageStatus = typeof messageStatuses.$inferInsert;

/**
 * Conversations Table - Agrupa mensagens por conversa
 * Essencial para histórico de chat
 */
export const conversations = mysqlTable(
  "conversations",
  {
    id: int("id").autoincrement().primaryKey(),
    // Número de telefone do cliente
    phoneNumber: varchar("phoneNumber", { length: 20 }).notNull().unique(),
    // Último status da conversa
    status: mysqlEnum("status", ["active", "closed", "archived"]).default("active").notNull(),
    // Última mensagem
    lastMessage: text("lastMessage"),
    // Timestamp da última mensagem
    lastMessageAt: timestamp("lastMessageAt"),
    // Timestamps
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    phoneNumberIdx: index("conversations_phoneNumber_idx").on(table.phoneNumber),
    statusIdx: index("conversations_status_idx").on(table.status),
    lastMessageAtIdx: index("conversations_lastMessageAt_idx").on(table.lastMessageAt),
  })
);

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

/**
 * Transactions Table - Rastreia transações de pagamento
 * Crítico para auditoria financeira
 */
export const transactions = mysqlTable(
  "transactions",
  {
    id: int("id").autoincrement().primaryKey(),
    // ID único da transação no Asaas
    asaasId: varchar("asaasId", { length: 64 }).notNull().unique(),
    // Número de telefone do cliente
    phoneNumber: varchar("phoneNumber", { length: 20 }).notNull(),
    // Valor da transação
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    // Status: pending, confirmed, failed, refunded
    status: mysqlEnum("status", ["pending", "confirmed", "failed", "refunded"]).default("pending").notNull(),
    // Descrição
    description: text("description"),
    // Timestamps
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    asaasIdIdx: index("transactions_asaasId_idx").on(table.asaasId),
    phoneNumberIdx: index("transactions_phoneNumber_idx").on(table.phoneNumber),
    statusIdx: index("transactions_status_idx").on(table.status),
    createdAtIdx: index("transactions_createdAt_idx").on(table.createdAt),
  })
);

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

/**
 * Webhook Logs Table - Auditoria de webhooks
 * Importante para debugging e conformidade
 */
export const webhookLogs = mysqlTable(
  "webhook_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    // Tipo de webhook: whatsapp, asaas, infosimples
    webhookType: mysqlEnum("webhookType", ["whatsapp", "asaas", "infosimples"]).notNull(),
    // Evento recebido
    event: varchar("event", { length: 64 }).notNull(),
    // Payload completo (JSON)
    payload: text("payload").notNull(),
    // Status do processamento: success, error, pending
    status: mysqlEnum("status", ["success", "error", "pending"]).default("pending").notNull(),
    // Mensagem de erro (se houver)
    errorMessage: text("errorMessage"),
    // Timestamps
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    webhookTypeIdx: index("webhookLogs_webhookType_idx").on(table.webhookType),
    eventIdx: index("webhookLogs_event_idx").on(table.event),
    statusIdx: index("webhookLogs_status_idx").on(table.status),
    createdAtIdx: index("webhookLogs_createdAt_idx").on(table.createdAt),
  })
);

export type WebhookLog = typeof webhookLogs.$inferSelect;
export type InsertWebhookLog = typeof webhookLogs.$inferInsert;
