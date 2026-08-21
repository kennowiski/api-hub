// Rate limiter simples, em memória, por IP.
//
// IMPORTANTE: como funções serverless da Vercel podem rodar em instâncias
// diferentes a cada chamada, este contador NÃO é 100% preciso sob carga alta
// distribuída (cada instância tem sua própria memória). Ainda assim, é uma
// primeira barreira eficaz contra abuso básico/loops de um mesmo IP, sem
// precisar de um serviço externo (Redis, Upstash, etc.).

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Cria um limitador independente (com seu próprio contador em memória).
 * Use uma instância por endpoint, já que cada um tem um padrão de uso diferente.
 *
 * @param {number} maxRequests - máx. de chamadas por IP dentro da janela
 * @param {number} windowMs - duração da janela, em ms (padrão: 60s)
 * @returns {(req) => { limited: boolean, remaining: number, retryAfterSeconds: number }}
 */
function createRateLimiter(maxRequests, windowMs = 60 * 1000) {
  const hits = new Map();

  return function checkRateLimit(req) {
    const ip = getClientIp(req);
    const now = Date.now();

    const entry = hits.get(ip);

    if (!entry || now - entry.windowStart > windowMs) {
      hits.set(ip, { windowStart: now, count: 1 });
      return { limited: false, remaining: maxRequests - 1, retryAfterSeconds: 0 };
    }

    entry.count += 1;

    if (entry.count > maxRequests) {
      const retryAfterSeconds = Math.ceil((entry.windowStart + windowMs - now) / 1000);
      return { limited: true, remaining: 0, retryAfterSeconds };
    }

    return { limited: false, remaining: maxRequests - entry.count, retryAfterSeconds: 0 };
  };
}

module.exports = { createRateLimiter };
