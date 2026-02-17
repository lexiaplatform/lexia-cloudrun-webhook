import rateLimit, { RateLimitRequestHandler } from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import redis from "redis";

/**
 * Rate Limiting Middleware
 * Protege contra DDoS e abuso de API
 */

// Criar cliente Redis (opcional, usa memória se não disponível)
let redisClient: redis.RedisClient | null = null;

try {
  if (process.env.REDIS_URL) {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL,
    });

    redisClient.on("error", (err) => {
      console.warn("[RateLimit] Redis error, falling back to memory store:", err);
      redisClient = null;
    });

    redisClient.on("connect", () => {
      console.log("[RateLimit] Connected to Redis");
    });
  }
} catch (error) {
  console.warn("[RateLimit] Redis not available, using memory store");
}

/**
 * Rate limiter para API geral
 * 100 requisições por 15 minutos por IP
 */
export const apiLimiter: RateLimitRequestHandler = rateLimit({
  store: redisClient
    ? new RedisStore({
        client: redisClient,
        prefix: "rate-limit:api:",
      })
    : undefined,
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requisições
  message: "Muitas requisições deste IP, tente novamente mais tarde.",
  standardHeaders: true, // Retorna informações no header `RateLimit-*`
  legacyHeaders: false, // Desabilita headers `X-RateLimit-*`
  skip: (req) => {
    // Não aplicar rate limit em health checks
    return req.path === "/health";
  },
});

/**
 * Rate limiter para webhooks
 * 1000 requisições por minuto por IP
 */
export const webhookLimiter: RateLimitRequestHandler = rateLimit({
  store: redisClient
    ? new RedisStore({
        client: redisClient,
        prefix: "rate-limit:webhook:",
      })
    : undefined,
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 1000, // 1000 requisições
  message: "Limite de webhook excedido, tente novamente mais tarde.",
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter para login
 * 5 tentativas por 15 minutos por IP
 */
export const loginLimiter: RateLimitRequestHandler = rateLimit({
  store: redisClient
    ? new RedisStore({
        client: redisClient,
        prefix: "rate-limit:login:",
      })
    : undefined,
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas
  message: "Muitas tentativas de login, tente novamente mais tarde.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Não aplicar rate limit em GET requests
    return req.method === "GET";
  },
});

/**
 * Rate limiter para tRPC
 * 200 requisições por minuto por IP
 */
export const trpcLimiter: RateLimitRequestHandler = rateLimit({
  store: redisClient
    ? new RedisStore({
        client: redisClient,
        prefix: "rate-limit:trpc:",
      })
    : undefined,
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 200, // 200 requisições
  message: "Limite de requisições tRPC excedido.",
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter por usuário (usando header customizado)
 * Útil para APIs autenticadas
 */
export const userLimiter: RateLimitRequestHandler = rateLimit({
  store: redisClient
    ? new RedisStore({
        client: redisClient,
        prefix: "rate-limit:user:",
      })
    : undefined,
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 1000, // 1000 requisições por hora
  keyGenerator: (req) => {
    // Usar user ID se autenticado, caso contrário usar IP
    return (req as any).user?.id || req.ip || "unknown";
  },
  message: "Limite de requisições por usuário excedido.",
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Middleware customizado para logging de rate limit
 */
export function rateLimitLogger(req: any, res: any, next: any) {
  const originalJson = res.json.bind(res);

  res.json = function (data: any) {
    if (res.statusCode === 429) {
      console.warn("[RateLimit] Rate limit exceeded", {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userId: req.user?.id,
      });
    }
    return originalJson(data);
  };

  next();
}

/**
 * Fechar conexão Redis ao desligar
 */
process.on("SIGTERM", () => {
  if (redisClient) {
    redisClient.quit();
  }
});

process.on("SIGINT", () => {
  if (redisClient) {
    redisClient.quit();
  }
});
