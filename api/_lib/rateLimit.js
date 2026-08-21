// Rate limiter simples, em memória, por IP.
//
// IMPORTANTE: como funções serverless da Vercel podem rodar em instâncias
// diferentes a cada chamada, este contador NÃO é 100% preciso sob carga alta
// distribuída (cada instância tem sua própria memória). Ainda assim, é uma
// primeira barreira eficaz contra abuso básico/loops de um mesmo IP, sem
// precisar de um serviço externo (Redis, Upstash, etc.).

const hits = new Map();

const WINDOW_MS = 60 * 1000; // janela de 1 minuto
const MAX_REQUESTS = 10; // máx. de chamadas por IP dentro da janela

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Retorna { limited: boolean, remaining: number, retryAfterSeconds: number }
 */
function checkRateLimit(req) {
  const ip = getClientIp(req);
  const now = Date.now();

  const entry = hits.get(ip);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    hits.set(ip, { windowStart: now, count: 1 });
    return { limited: false, remaining: MAX_REQUESTS - 1, retryAfterSeconds: 0 };
  }

  entry.count += 1;

  if (entry.count > MAX_REQUESTS) {
    const retryAfterSeconds = Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000);
    return { limited: true, remaining: 0, retryAfterSeconds };
  }

  return { limited: false, remaining: MAX_REQUESTS - entry.count, retryAfterSeconds: 0 };
}

module.exports = { checkRateLimit };
