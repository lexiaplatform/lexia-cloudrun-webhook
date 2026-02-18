import express, { Request, Response, NextFunction } from "express";
import axios from "axios";
import {
  saveMessage,
  saveMessageStatus,
  upsertConversation,
  saveWebhookLog,
  findMessageByMessageId,
} from "./db_messages";
import { agentService } from "./services/agent";
import { agentQueue } from "./queue";

/**
 * WhatsApp Webhook Server
 * Integração com WhatsApp Cloud API da Meta
 * Deploy no Render como Web Service público com HTTPS
 */

// ============================================================================
// CONFIGURAÇÃO E TIPOS
// ============================================================================

// Agent ADK Configuration - Now using integrated agentService

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

    // Manter apenas os últimos N logs na memória
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Log no console também
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

// Middleware
app.use(express.json());

// Configuração de variáveis de ambiente
const VERIFY_TOKEN = REPLACE_WITH_VERIFY_TOKEN || "";
const WHATSAPP_ACCESS_TOKEN = REPLACE_WITH_WHATSAPP_ACCESS_TOKEN || "";
const WHATSAPP_BUSINESS_ACCOUNT_ID =
  process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "";
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const PORT = parseInt(process.env.PORT || "8080", 10);
const NODE_ENV = process.env.NODE_ENV || "development";

// ============================================================================
// ENDPOINTS
// ============================================================================

/**
 * GET /webhook
 * Validação do webhook pela Meta
 * A Meta envia um desafio (challenge) que deve ser retornado para validar o webhook
 */
app.get("/webhook", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  logger.debug("Webhook validation request received", {
    mode,
    token: token ? "***" : "missing",
    challenge: challenge ? "present" : "missing",
  });

  // Validar o token
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    logger.info("✅ Webhook validated successfully");
    return res.status(200).send(challenge);
  }

  logger.warn("❌ Webhook validation failed", {
    mode,
    tokenMatch: token === VERIFY_TOKEN,
  });

  return res.sendStatus(403);
});

/**
 * POST /webhook
 * Receber eventos do WhatsApp Cloud API
 * Processa mensagens, status de entrega e outros eventos
 */
app.post("/webhook", async (req: Request, res: Response) => {
  const body = req.body as WebhookEvent;

  logger.info("📨 Webhook event received", {
    object: body.object,
    entryCount: body.entry?.length || 0,
  });

  // Validação básica
  if (!body.object || body.object !== "whatsapp_business_account") {
    logger.warn("Invalid webhook object type", { object: body.object });
    return res.sendStatus(400);
  }

  // Responder imediatamente com 200 OK (processamento assíncrono)
  res.sendStatus(200);

  // Processar cada entrada de forma assíncrona
  if (body.entry && Array.isArray(body.entry)) {
    for (const entry of body.entry) {
      if (entry.changes && Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          await processWebhookChange(change);
        }
      }
    }
  }
});

/**
 * GET /webhook/logs
 * Endpoint para visualizar logs recentes (apenas para desenvolvimento)
 */
app.get("/webhook/logs", (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const logs = logger.getLogs(limit);

  res.json({
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    logCount: logs.length,
    logs,
  });
});

/**
 * GET /health
 * Health check para monitoramento
 */
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    uptime: process.uptime(),
  });
});

/**
 * GET /
 * Root endpoint para verificação básica
 */
app.get("/", (req: Request, res: Response) => {
  res.json({
    service: "Léxia WhatsApp Webhook",
    version: "1.0.0",
    status: "running",
    timestamp: new Date().toISOString(),
    endpoints: {
      webhook: "/webhook",
      health: "/health",
      logs: "/webhook/logs",
    },
  });
});

// ============================================================================
// PROCESSAMENTO DE EVENTOS
// ============================================================================

/**
 * Processar mudanças do webhook
 */
async function processWebhookChange(change: WebhookChange) {
  const { field, value } = change;

  logger.debug("Processing webhook change", { field });

  if (field !== "messages") {
    logger.debug("Skipping non-message field", { field });
    return;
  }

  const { messages, statuses, metadata } = value;

  // Processar mensagens recebidas
  if (messages && Array.isArray(messages) && messages.length > 0) {
    for (const message of messages) {
      await handleIncomingMessage(message, metadata);
    }
  }

  // Processar status de entrega
  if (statuses && Array.isArray(statuses) && statuses.length > 0) {
    for (const status of statuses) {
      await handleMessageStatus(status, metadata);
    }
  }
}

/**
 * Tratar mensagens recebidas do WhatsApp
 */
async function handleIncomingMessage(message: Message, metadata: WebhookValue["metadata"]) {
  logger.info("📩 Incoming message received", {
    from: message.from,
    type: message.type,
    timestamp: message.timestamp,
    messageId: message.id,
  });

  // ETAPA 1: VERIFICACAO DE IDEMPOTENCIA
  const existingMessage = await findMessageByMessageId(message.id);
  if (existingMessage) {
    logger.warn("🔄 Message already processed (idempotency key hit)", { messageId: message.id });
    return; // Interrompe o processamento
  }

  // ETAPA 2: SALVAR MENSAGEM NO BANCO DE DADOS
  const messageContent =
    message.type === "text" ? message.text?.body : message.type === "button" ? message.button?.text : null;

  const saved = await saveMessage({
    messageId: message.id,
    from: message.from,
    type: message.type as any,
    content: messageContent,
    buttonPayload: message.button?.payload,
    displayPhoneNumber: metadata.display_phone_number,
    phoneNumberId: metadata.phone_number_id,
    messageTimestamp: message.timestamp,
  });

  if (!saved) {
    logger.warn("Falha ao salvar mensagem no banco de dados", { messageId: message.id });
  }

  // Atualizar conversa
  await upsertConversation({
    phoneNumber: message.from,
    lastMessage: messageContent,
    lastMessageAt: new Date(),
    status: "active",
  });

  // Processar diferentes tipos de mensagens
  switch (message.type) {
    case "text":
      if (message.text) {
        logger.info("📝 Text message", {
          from: message.from,
          body: message.text.body,
        });
        // Chamar agente ADK para processar mensagem
        await processTextMessageWithAgent(message, metadata);
      }
      break;

    case "button":
      if (message.button) {
        logger.info("🔘 Button message", {
          from: message.from,
          text: message.button.text,
          payload: message.button.payload,
        });
        // TODO: Processar resposta de botão
      }
      break;

    default:
      logger.debug("Message type not yet handled", { type: message.type });
  }

  // Registrar metadados
  logger.debug("Message metadata", {
    phoneNumberId: metadata.phone_number_id,
    displayPhoneNumber: metadata.display_phone_number,
  });
}

/**
 * Tratar status de entrega de mensagens
 */
async function handleMessageStatus(status: MessageStatus, metadata: WebhookValue["metadata"]) {
  logger.info("📊 Message status update", {
    messageId: status.id,
    status: status.status,
    recipientId: status.recipient_id,
    timestamp: status.timestamp,
  });

  // Salvar status no banco de dados
  const saved = await saveMessageStatus({
    messageId: status.id,
    status: status.status as any,
    recipientId: status.recipient_id,
    statusTimestamp: status.timestamp,
  });

  if (!saved) {
    logger.warn("Falha ao salvar status de mensagem", { messageId: status.id });
  }

  // Processar diferentes status
  switch (status.status) {
    case "sent":
      logger.debug("✉️ Message sent");
      break;
    case "delivered":
      logger.debug("✅ Message delivered");
      break;
    case "read":
      logger.debug("👁️ Message read");
      break;
    case "failed":
      logger.error("❌ Message delivery failed", { messageId: status.id });
      break;
    default:
      logger.debug("Unknown status", { status: status.status });
  }
}

/**
 * Processar mensagem de texto com o Agente ADK
 */
async function processTextMessageWithAgent(
  message: Message,
  metadata: WebhookValue["metadata"]
) {
  try {
    const sessionId = `wa_id_${message.from}`;
    const userMessage = message.text?.body || "";

    logger.info("🤖 Calling Integrated Agent", {
      sessionId,
      userMessage,
    });

    // Chamar o AgentService diretamente em vez de fazer uma requisição HTTP externa
    const agentReply = await agentService.processMessage(sessionId, userMessage, message.from);

    logger.info("✅ Agent response generated", {
      sessionId,
      reply: agentReply,
    });

    // Enviar resposta do agente via WhatsApp
    const sent = await sendWhatsAppMessage(message.from, agentReply);

    if (sent) {
      logger.info("✉️ Agent reply sent to WhatsApp", {
        to: message.from,
        reply: agentReply,
      });
    }
  } catch (error) {
    logger.error("Error processing message with agent", {
      error: error instanceof Error ? error.message : String(error),
      from: message.from,
    });

    const errorMessage = "Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.";
    await sendWhatsAppMessage(message.from, errorMessage);
  }
}

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Enviar mensagem de texto via WhatsApp Cloud API
 * Requer token permanente do Business Manager
 */
async function sendWhatsAppMessage(phoneNumber: string, message: string): Promise<boolean> {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    logger.warn(
      "Cannot send message: missing WhatsApp credentials",
      "Configure WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID"
    );
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

    logger.info("✉️ WhatsApp message sent successfully", {
      to: phoneNumber,
      messageId: response.data.messages?.[0]?.id,
    });

    return true;
  } catch (error) {
    logger.error("Failed to send WhatsApp message", {
      to: phoneNumber,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

// ============================================================================
// MIDDLEWARE DE ERRO
// ============================================================================

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error("Unhandled error", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    error: "Internal server error",
    message: NODE_ENV === "development" ? err.message : "An error occurred",
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// INICIALIZAÇÃO DO SERVIDOR
// ============================================================================

const server = app.listen(PORT, () => {
  logger.info(`🚀 Webhook server started`, {
    port: PORT,
    environment: NODE_ENV,
    verifyToken: VERIFY_TOKEN ? "set" : "missing",
  });

  logger.info("📋 Configuration", {
    hasAccessToken: !!WHATSAPP_ACCESS_TOKEN,
    hasPhoneNumberId: !!WHATSAPP_PHONE_NUMBER_ID,
    hasBusinessAccountId: !!WHATSAPP_BUSINESS_ACCOUNT_ID,
    graphVersion: process.env.META_GRAPH_VERSION || "v18.0",
  });

  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    logger.warn("⚠️ Missing WhatsApp env vars. Sending messages will fail until configured.");
  }
});

// Graceful shutdown (Cloud Run sends SIGTERM)
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, closing server...");
  server.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  logger.info("SIGINT received, closing server...");
  server.close(() => process.exit(0));
});

export default app;
