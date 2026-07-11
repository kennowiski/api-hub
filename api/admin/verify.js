export default async function handler(req, res) {
  const allowedOrigins = [
    'https://kennowiski.is-a.dev',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ];

  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      allowed: false,
      error: 'method_not_allowed'
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!supabaseUrl || !supabaseKey || !adminEmail) {
    return res.status(500).json({
      allowed: false,
      error: 'server_not_configured',
      config: {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasSupabaseKey: Boolean(supabaseKey),
        hasAdminEmail: Boolean(adminEmail)
      }
    });
  }

  const authorization = req.headers.authorization || '';

  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({
      allowed: false,
      error: 'missing_token'
    });
  }

  const token = authorization.replace(/^bearer\s+/i, '').trim();

  if (!token) {
    return res.status(401).json({
      allowed: false,
      error: 'empty_token'
    });
  }

  if (token.split('.').length !== 3) {
    return res.status(401).json({
      allowed: false,
      error: 'malformed_token'
    });
  }

  try {
    const cleanSupabaseUrl = supabaseUrl.replace(/\/$/, '');

    const response = await fetch(`${cleanSupabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${token}`
      }
    });

    const responseText = await response.text().catch(() => '');

    if (!response.ok) {
      return res.status(401).json({
        allowed: false,
        error: 'invalid_session',
        supabaseStatus: response.status,
        supabaseStatusText: response.statusText,
        supabaseError: responseText
      });
    }

    let user;

    try {
      user = JSON.parse(responseText);
    } catch (error) {
      return res.status(500).json({
        allowed: false,
        error: 'invalid_supabase_response'
      });
    }

    const userEmail = String(user.email || '').trim().toLowerCase();
    const allowedEmail = String(adminEmail || '').trim().toLowerCase();

    if (!userEmail) {
      return res.status(403).json({
        allowed: false,
        error: 'user_without_email'
      });
    }

    if (userEmail !== allowedEmail) {
      return res.status(403).json({
        allowed: false,
        error: 'not_allowed'
      });
    }

    return res.status(200).json({
      allowed: true
    });
  } catch (error) {
    return res.status(500).json({
      allowed: false,
      error: 'verify_failed',
      message: error instanceof Error ? error.message : 'unknown_error'
    });
  }
}
