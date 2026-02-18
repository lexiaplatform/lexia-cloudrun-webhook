import express, { Request, Response, NextFunction } from "express";
import axios from "axios";
import {
  saveMessage,
  saveMessageStatus,
  upsertConversation,
  saveWebhookLog,
  findMessageByMessageId,
  updateMessagePostProcessing,
} from "./db_messages";
import { agentService } from "./services/agent";

/**
 * WhatsApp Webhook Server
 * Integração com WhatsApp Cloud API da Meta
 * Deploy no Cloud Run
 */

// ============================================================================
// CONFIGURAÇÃO E TIPOS
// ============================================================================

interface Message {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: {
    body: string;
  };
  button?: {
    text: string;
    payload: string;
  };
}

interface MessageStatus {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
}

interface WebhookValue {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  messages?: Message[];
  statuses?: MessageStatus[];
}

interface WebhookChange {
  value: WebhookValue;
  field: string;
}

interface WebhookEntry {
  id: string;
  changes: WebhookChange[];
}

interface WebhookEvent {
  object: string;
  entry: WebhookEntry[];
}

interface LogEntry {
  timestamp: string;
  level: "info" | "error" | "warn" | "debug";
  message: string;
  data?: unknown;
}

// ============================================================================
// LOGGER
// ============================================================================

class WebhookLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;

  log(level: LogEntry["level"], message: string, data?: unknown) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    };

    this.logs.push(entry);

    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    const logFn =
      level === "error"
        ? console.error
        : level === "warn"
          ? console.warn
          : console.log;

    logFn(`[${entry.timestamp}] [${level.toUpperCase()}] ${message}`, data || "");
  }

  info(message: string, data?: unknown) {
    this.log("info", message, data);
  }

  error(message: string, data?: unknown) {
    this.log("error", message, data);
  }

  warn(message: string, data?: unknown) {
    this.log("warn", message, data);
  }

  debug(message: string, data?: unknown) {
    this.log("debug", message, data);
  }

  getLogs(limit = 100): LogEntry[] {
    return this.logs.slice(-limit);
  }

  clearLogs() {
    this.logs = [];
  }
}

// ============================================================================
// CONFIGURAÇÃO DO SERVIDOR
// ============================================================================

const app = express();
const logger = new WebhookLogger();

app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "";
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || "";
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const PORT = parseInt(process.env.PORT || "8080", 10);
const NODE_ENV = process.env.NODE_ENV || "development";

// ============================================================================
// ENDPOINTS
// ============================================================================

app.get("/webhook", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    logger.info("✅ Webhook validated successfully");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

app.post("/webhook", async (req: Request, res: Response) => {
  // 4️⃣ Garantir que o webhook responda 200 imediatamente
  res.sendStatus(200);

  const body = req.body as WebhookEvent;

  if (!body.object || body.object !== "whatsapp_business_account") {
    return;
  }

  if (body.entry && Array.isArray(body.entry)) {
    for (const entry of body.entry) {
      if (entry.changes && Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          // 6️⃣ Garantir que ignore status updates
          if (change.value.statuses) continue;
          
          await processWebhookChange(change);
        }
      }
    }
  }
});

app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    uptime: process.uptime(),
  });
});

app.get("/", (req: Request, res: Response) => {
  res.json({
    service: "Léxia WhatsApp Webhook",
    version: "1.1.0",
    status: "running",
  });
});

// ============================================================================
// PROCESSAMENTO DE EVENTOS
// ============================================================================

async function processWebhookChange(change: WebhookChange) {
  const { field, value } = change;

  if (field !== "messages") return;

  const { messages, metadata } = value;

  if (messages && Array.isArray(messages) && messages.length > 0) {
    for (const message of messages) {
      await handleIncomingMessage(message, metadata);
    }
  }
}

async function handleIncomingMessage(message: Message, metadata: WebhookValue["metadata"]) {
  // 5️⃣ Adicionar deduplicação por message.id em memória
  const messageId = message.id;
  if (!(global as any).processedMessages) {
    (global as any).processedMessages = new Set();
  }
  if ((global as any).processedMessages.has(messageId)) return;
  (global as any).processedMessages.add(messageId);

  // Limpeza periódica do Set para evitar vazamento de memória (opcional, mas recomendado)
  if ((global as any).processedMessages.size > 10000) {
    (global as any).processedMessages.clear();
  }

  logger.info("📩 Incoming message received", {
    from: message.from,
    messageId: message.id,
  });

  // ETAPA 1: VERIFICACAO DE IDEMPOTENCIA NO BANCO
  const existingMessage = await findMessageByMessageId(message.id);
  if (existingMessage) {
    return;
  }

  // ETAPA 2: SALVAR MENSAGEM NO BANCO DE DADOS
  const messageContent =
    message.type === "text" ? message.text?.body : message.type === "button" ? message.button?.text : null;

  await saveMessage({
    messageId: message.id,
    from: message.from,
    type: message.type as any,
    content: messageContent,
    buttonPayload: message.button?.payload,
    displayPhoneNumber: metadata.display_phone_number,
    phoneNumberId: metadata.phone_number_id,
    messageTimestamp: message.timestamp,
  });

  await upsertConversation({
    phoneNumber: message.from,
    lastMessage: messageContent,
    lastMessageAt: new Date(),
    status: "active",
  });

  if (message.type === "text" && message.text) {
    await processTextMessageWithAgent(message, metadata);
  }
}

async function processTextMessageWithAgent(message: Message, metadata: WebhookValue["metadata"]) {
  const text = message.text?.body || "";
  const phoneNumber = message.from;

  try {
    const response = await agentService.processMessage(message.id, text, phoneNumber);
    
    if (response) {
      await sendWhatsAppMessage(phoneNumber, response);
      
      await saveMessage({
        messageId: `reply-${Date.now()}`,
        from: "system",
        type: "text",
        content: response,
        displayPhoneNumber: metadata.display_phone_number,
        phoneNumberId: metadata.phone_number_id,
        messageTimestamp: Math.floor(Date.now() / 1000).toString(),
      });
    }
  } catch (error) {
    logger.error("Error processing message with agent", {
      messageId: message.id,
      error: error instanceof Error ? error.message : String(error),
    });
    // 7️⃣ Confirmar que NÃO existe fallback duplicado (Apenas log)
    logger.info("Fallback: Agent processing failed, no message sent to user.");
  }
}

async function sendWhatsAppMessage(phoneNumber: string, message: string) {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    logger.warn("Cannot send message: missing WhatsApp credentials");
    return false;
  }

  try {
    const url = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v18.0"}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

    const response = await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        to: phoneNumber,
        type: "text",
        text: {
          body: message,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    logger.info("✉️ WhatsApp message sent", {
      to: phoneNumber,
      messageId: response.data.messages?.[0]?.id,
    });

    return true;
  } catch (error) {
    logger.error("Error sending WhatsApp message", {
      to: phoneNumber,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

async function handleMessageStatus(status: MessageStatus, metadata: WebhookValue["metadata"]) {
  await saveMessageStatus({
    messageId: status.id,
    status: status.status,
    recipientId: status.recipient_id,
    timestamp: status.timestamp,
  });
}

const server = app.listen(PORT, () => {
  logger.info(`🚀 WhatsApp Webhook Server running on port ${PORT}`);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});

export default app;
