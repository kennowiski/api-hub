export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const client_id = process.env.SPOTIFY_CLIENT_ID;
  const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
  const refresh_token = process.env.SPOTIFY_REFRESH_TOKEN;
  const lastfm_key = process.env.LASTFM_API_KEY;

  if (!client_id || !client_secret || !refresh_token) {
    return res.status(500).json({
      error: 'Missing environment variables'
    });
  }

  // Função interna de Fallback para buscar no Last.fm se o Spotify estiver pausado
  async function checkLastFmFallback() {
    if (!lastfm_key) return { isPlaying: false };
    
    try {
      const lastFmUser = "kennowiski";
      const lastFmUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${lastFmUser}&api_key=${lastfm_key}&format=json&limit=1`;
      
      const lfResponse = await fetch(lastFmUrl);
      const lfData = await lfResponse.json();
      
      if (lfData && lfData.recenttracks && lfData.recenttracks.track && lfData.recenttracks.track.length > 0) {
        const track = lfData.recenttracks.track[0];
        const isNowPlaying = track['@attr'] && track['@attr'].nowplaying === 'true';

        if (isNowPlaying) {
          return {
            isPlaying: true,
            provider: 'lastfm',
            title: track.name,
            artist: track.artist['#text'],
            albumImageUrl: track.image[3]['#text'] || track.image[2]['#text'] || 'https://s.ltrbxd.com/static/img/empty-poster-250.8491d904.png'
          };
        }
      }
    } catch (e) {
      console.error("Erro no fallback do Last.fm:", e);
    }
    return { isPlaying: false };
  }

  const basic = Buffer.from(
    `${client_id}:${client_secret}`
  ).toString('base64');

  try {
    const tokenResponse = await fetch(
      'https://accounts.spotify.com/api/token',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token,
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      return res.status(500).json({
        error: 'Failed to refresh token',
        spotify: tokenData,
      });
    }

    const access_token = tokenData.access_token;

    const nowPlaying = await fetch(
      'https://api.spotify.com/v1/me/player/currently-playing',
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    // Se o Spotify estiver em silêncio (Status 204), checa o Last.fm
    if (nowPlaying.status === 204) {
      const fallbackData = await checkLastFmFallback();
      return res.status(200).json(fallbackData);
    }

    const song = await nowPlaying.json();

    // Se não tiver item no Spotify, checa o Last.fm
    if (!song.item) {
      const fallbackData = await checkLastFmFallback();
      return res.status(200).json(fallbackData);
    }

    // Se o Spotify estiver tocando de fato, retorna o Spotify
    return res.status(200).json({
      isPlaying: song.is_playing,
      provider: 'spotify',
      title: song.item.name,
      artist: song.item.artists
        .map((artist) => artist.name)
        .join(', '),
      albumImageUrl: song.item.album.images[0].url,
    });

  } catch (error) {
    // Caso dê erro total no Spotify, tenta o Last.fm antes de dar erro na tela
    const fallbackData = await checkLastFmFallback();
    if (fallbackData.isPlaying) {
      return res.status(200).json(fallbackData);
    }
    return res.status(500).json({
      error: error.message,
    });
  }
}
