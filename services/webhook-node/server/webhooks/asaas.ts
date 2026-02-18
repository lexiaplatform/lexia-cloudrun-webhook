import express, { Request, Response } from "express";
import axios from "axios";
import { getDb } from "../db";
import { getInfosimplesService } from "../services/infosimples";
import { getConversation } from "../db_messages";

/**
 * Asaas Webhook Handler
 * Processa eventos de pagamento do Asaas
 * Integrado ao servidor principal (não porta separada)
 */

interface AsaasPayment {
  id: string;
  customer: {
    id: string;
    externalReference?: string;
  };
  value: number;
  status: string;
  dueDate: string;
  confirmationDate?: string;
}

interface AsaasWebhookEvent {
  event: string;
  payment: AsaasPayment;
}

// ============================================================================
// LOGGER
// ============================================================================

class AsaasLogger {
  private logs: Array<{
    timestamp: string;
    level: string;
    message: string;
    data?: unknown;
  }> = [];

  log(level: string, message: string, data?: unknown) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    };

    this.logs.push(entry);

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

  getLogs(limit = 100) {
    return this.logs.slice(-limit);
  }
}

const logger = new AsaasLogger();

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Middleware para verificar token do webhook Asaas
 */
function verifyAsaasWebhookToken(req: Request, res: Response, next: Function) {
  const asaasWebhookToken = process.env.ASAAS_WEBHOOK_TOKEN;
  const receivedToken = req.headers["asaas-access-token"] as string;

  if (!asaasWebhookToken) {
    logger.warn("ASAAS_WEBHOOK_TOKEN não configurado");
    return res.status(500).json({
      error: "Webhook token not configured",
      timestamp: new Date().toISOString(),
    });
  }

  if (!receivedToken || receivedToken !== asaasWebhookToken) {
    logger.warn("Webhook Asaas: Token inválido ou ausente", {
      receivedToken: receivedToken ? "***" : "missing",
    });
    return res.status(401).json({
      error: "Unauthorized",
      timestamp: new Date().toISOString(),
    });
  }

  next();
}

// ============================================================================
// WEBHOOK HANDLER
// ============================================================================

/**
 * Processar evento de pagamento
 */
async function handlePaymentEvent(event: AsaasWebhookEvent) {
  const { payment } = event;

  logger.info("💳 Processando evento de pagamento", {
    event: event.event,
    paymentId: payment.id,
    status: payment.status,
  });

  // Validar dados obrigatórios
  if (!payment.customer.externalReference) {
    logger.warn("Webhook Asaas: tenant_id não encontrado no externalReference", {
      paymentId: payment.id,
    });
    return {
      success: false,
      error: "tenant_id missing",
    };
  }

  try {
    const db = await getDb();

    if (!db) {
      logger.error("Database não disponível");
      return {
        success: false,
        error: "Database not available",
      };
    }

    // 1. Tentar obter o CPF do cliente através da conversa
    const sessionId = payment.customer.externalReference;
    const phoneNumber = sessionId.replace("wa_id_", "");
    const conversation = await getConversation(phoneNumber);
    
    // 2. Se tivermos o CPF (ou pudermos extrair), rodar InfoSimples
    // Nota: Em um cenário real, o CPF estaria salvo no banco de dados do Lead/Conversation
    // Aqui simulamos a chamada se o CPF estivesse disponível
    logger.info("🔍 Iniciando consultas InfoSimples pós-pagamento", { sessionId });
    
    // TODO: Recuperar CPF real do banco de dados
    // const cpf = conversation?.metadata?.cpf; 
    // if (cpf) {
    //   const infosimples = getInfosimplesService();
    //   await infosimples.queryCPF(cpf);
    // }

    logger.info("✅ Evento de pagamento processado com sucesso", {
      paymentId: payment.id,
      tenantId: payment.customer.externalReference,
    });

    return {
      success: true,
      paymentId: payment.id,
    };
  } catch (error) {
    logger.error("Erro ao processar evento de pagamento", {
      paymentId: payment.id,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// ROUTER
// ============================================================================

export function createAsaasRouter() {
  const router = express.Router();

  /**
   * POST /webhooks/asaas
   * Receber eventos do Asaas
   */
  router.post(
    "/asaas",
    verifyAsaasWebhookToken,
    async (req: Request, res: Response) => {
      const event = req.body as AsaasWebhookEvent;

      logger.info("📨 Webhook Asaas recebido", {
        event: event.event,
        paymentId: event.payment?.id,
      });

      // Responder imediatamente com 200 OK (processamento assíncrono)
      res.status(200).json({
        success: true,
        timestamp: new Date().toISOString(),
      });

      // Processar evento de forma assíncrona
      if (event.event === "PAYMENT_RECEIVED" || event.event === "PAYMENT_CONFIRMED") {
        const result = await handlePaymentEvent(event);

        if (!result.success) {
          logger.error("❌ Falha ao processar evento de pagamento", result);
          // TODO: Implementar retry logic com fila (Bull/Redis)
        }
      } else {
        logger.info(`Evento Asaas ${event.event} ignorado`);
      }
    }
  );

  /**
   * GET /webhooks/asaas/logs
   * Visualizar logs recentes (apenas para desenvolvimento)
   */
  router.get("/asaas/logs", (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const logs = logger.getLogs(limit);

    res.json({
      timestamp: new Date().toISOString(),
      logCount: logs.length,
      logs,
    });
  });

  /**
   * POST /webhooks/asaas/test
   * Endpoint de teste (apenas para desenvolvimento)
   */
  router.post("/asaas/test", async (req: Request, res: Response) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({
        error: "Test endpoint not available in production",
      });
    }

    const testEvent: AsaasWebhookEvent = {
      event: "PAYMENT_RECEIVED",
      payment: {
        id: "pay_test_" + Date.now(),
        customer: {
          id: "cus_test_123",
          externalReference: "tenant_test_123",
        },
        value: 100.0,
        status: "RECEIVED",
        dueDate: new Date().toISOString().split("T")[0],
        confirmationDate: new Date().toISOString(),
      },
    };

    const result = await handlePaymentEvent(testEvent);

    res.json({
      success: true,
      testEvent,
      result,
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

export { logger as asaasLogger };
