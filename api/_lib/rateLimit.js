// Rate limit simples em memória, por IP.
// Como a Vercel pode rodar em instâncias diferentes a cada chamada, a
// contagem não é 100% precisa sob carga alta (cada instância tem sua
// própria memória), mas já segura abuso básico sem precisar de Redis/Upstash.

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

// Cria um limitador com contador próprio. Uma instância por endpoint,
// já que cada um aguenta um volume diferente de chamadas.
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
