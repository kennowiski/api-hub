export default async function handler(req, res) {
  // 1. Libera o acesso para o seu site Front-end (CORS)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 2. Puxa as senhas do cofre do Vercel
  const client_id = process.env.SPOTIFY_CLIENT_ID;
  const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
  const refresh_token = process.env.SPOTIFY_REFRESH_TOKEN;

  // Codifica as chaves para enviar pro Spotify
  const basic = Buffer.from(`${client_id}:${client_secret}`).toString('base64');
  
  // Pedaços protegidos para o sistema não alterar as URLs oficiais
  const urlContas = 'accounts.' + 'spotify.com';
  const urlDados = 'api.' + 'spotify.com';

  const TOKEN_ENDPOINT = `https://${urlContas}/api/token`;
  const NOW_PLAYING_ENDPOINT = `https://${urlDados}/v1/me/player/currently-playing`;

  try {
    // 3. Pede um "ingresso" novo para o Spotify usando a chave mestra
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token,
      }),
    });

    const { access_token } = await response.json();

    // 4. Pergunta o que o Kenny está ouvindo agora
    const nowPlayingRes = await fetch(NOW_PLAYING_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    // Se não estiver ouvindo nada (status 204), avisa o site
    if (nowPlayingRes.status === 204 || nowPlayingRes.status > 400) {
      return res.status(200).json({ isPlaying: false });
    }

    const song = await nowPlayingRes.json();

    if (song.item === null) {
      return res.status(200).json({ isPlaying: false });
    }

    // 5. Organiza os dados bonitinhos para mandar pro seu Front-end
    const isPlaying = song.is_playing;
    const title = song.item.name;
    const artist = song.item.artists.map((_artist) => _artist.name).join(', ');
    const albumImageUrl = song.item.album.images[0].url;

    return res.status(200).json({
      isPlaying,
      title,
      artist,
      albumImageUrl,
    });
    
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
