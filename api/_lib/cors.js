const ALLOWED_ORIGINS = [
  'https://kennowiski.is-a.dev',
  'https://kennowiski.com.br',
  'https://www.kennowiski.com.br',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

// Libera CORS só pros domínios da lista. Se for OPTIONS já responde
// aqui e retorna true pro handler saber que não precisa continuar.
function applyCors(req, res, { methods = 'GET, OPTIONS' } = {}) {
  const origin = req.headers.origin;

  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  return false;
}

module.exports = { applyCors, ALLOWED_ORIGINS };
