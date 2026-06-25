export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
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
      error: 'server_not_configured'
    });
  }

  const authorization = req.headers.authorization || '';

  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({
      allowed: false,
      error: 'missing_token'
    });
  }

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: supabaseKey,
        authorization
      }
    });

    if (!response.ok) {
      return res.status(401).json({
        allowed: false,
        error: 'invalid_session'
      });
    }

    const user = await response.json();

    const userEmail = String(user.email || '').trim().toLowerCase();
    const allowedEmail = String(adminEmail || '').trim().toLowerCase();

    if (!userEmail || userEmail !== allowedEmail) {
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
      error: 'verify_failed'
    });
  }
}
