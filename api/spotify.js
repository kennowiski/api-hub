export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=60');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const client_id = process.env.SPOTIFY_CLIENT_ID;
  const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
  const refresh_token = process.env.SPOTIFY_REFRESH_TOKEN;
  const lastfm_key = process.env.LASTFM_API_KEY;

  const fallbackCover = 'https://s.ltrbxd.com/static/img/empty-poster-250.8491d904.png';

  async function readJsonSafely(response) {
    const text = await response.text();

    if (!text || !text.trim()) {
      return { data: null, text: '' };
    }

    try {
      return { data: JSON.parse(text), text };
    } catch {
      return { data: null, text };
    }
  }

  function shortText(text) {
    if (!text) return '';
    return String(text).slice(0, 160);
  }

  async function checkLastFmFallback() {
    if (!lastfm_key) {
      return {
        isPlaying: false,
        provider: 'lastfm',
        error: 'Missing Last.fm API key'
      };
    }

    try {
      const lastFmUser = 'kennowiski';
      const lastFmUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${lastFmUser}&api_key=${lastfm_key}&format=json&limit=1`;

      const lfResponse = await fetch(lastFmUrl);
      const parsed = await readJsonSafely(lfResponse);

      if (!lfResponse.ok || !parsed.data) {
        return {
          isPlaying: false,
          provider: 'lastfm',
          error: 'Failed to read Last.fm response',
          status: lfResponse.status,
          response: shortText(parsed.text)
        };
      }

      const tracks = parsed.data?.recenttracks?.track;
      const list = Array.isArray(tracks) ? tracks : tracks ? [tracks] : [];

      if (!list.length) {
        return {
          isPlaying: false,
          provider: 'lastfm'
        };
      }

      const track = list[0];
      const isNowPlaying = track?.['@attr']?.nowplaying === 'true';

      let finalImageUrl = fallbackCover;

      if (Array.isArray(track.image)) {
        const imgData =
          track.image.find((image) => image.size === 'extralarge' && image['#text']) ||
          track.image.find((image) => image['#text']);

        if (imgData?.['#text']) {
          finalImageUrl = imgData['#text'].replace(/\/i\/u\/[^/]+\//, '/i/u/300x300/');
        }
      }

      return {
        isPlaying: isNowPlaying,
        provider: 'lastfm',
        title: track.name || 'Desconhecido',
        artist: track.artist?.['#text'] || 'Desconhecido',
        albumImageUrl: finalImageUrl
      };
    } catch (error) {
      return {
        isPlaying: false,
        provider: 'lastfm',
        error: error.message
      };
    }
  }

  async function sendLastFmFallback(spotifyProblem, fallbackStatus = 200) {
    const fallbackData = await checkLastFmFallback();

    if (fallbackData.title) {
      return res.status(200).json({
        ...fallbackData,
        spotifyAvailable: false,
        spotifyError: spotifyProblem
      });
    }

    return res.status(fallbackStatus).json({
      error: 'Spotify unavailable and Last.fm fallback unavailable',
      spotifyError: spotifyProblem,
      lastfm: fallbackData
    });
  }

  if (!client_id || !client_secret || !refresh_token) {
    return sendLastFmFallback({
      message: 'Missing Spotify environment variables'
    });
  }

  const basic = Buffer.from(`${client_id}:${client_secret}`).toString('base64');

  try {
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token
      })
    });

    const tokenParsed = await readJsonSafely(tokenResponse);
    const tokenData = tokenParsed.data;

    if (!tokenResponse.ok || !tokenData?.access_token) {
      return sendLastFmFallback({
        message: 'Failed to refresh Spotify token',
        status: tokenResponse.status,
        response: tokenData || shortText(tokenParsed.text)
      });
    }

    const access_token = tokenData.access_token;

    const nowPlaying = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    });

    if (nowPlaying.status === 204) {
      return res.status(200).json(await checkLastFmFallback());
    }

    const nowPlayingParsed = await readJsonSafely(nowPlaying);

    if (!nowPlaying.ok || !nowPlayingParsed.data) {
      return sendLastFmFallback({
        message: 'Failed to read Spotify now playing',
        status: nowPlaying.status,
        response: nowPlayingParsed.data || shortText(nowPlayingParsed.text)
      });
    }

    const song = nowPlayingParsed.data;

    if (!song.item || !song.is_playing) {
      const fallbackData = await checkLastFmFallback();

      if (fallbackData.title) {
        return res.status(200).json(fallbackData);
      }
    }

    return res.status(200).json({
      isPlaying: Boolean(song.is_playing),
      provider: 'spotify',
      title: song.item ? song.item.name : 'Desconhecido',
      artist: song.item ? song.item.artists.map((artist) => artist.name).join(', ') : 'Desconhecido',
      albumImageUrl: song.item?.album?.images?.[0]?.url || fallbackCover
    });
  } catch (error) {
    return sendLastFmFallback({
      message: error.message
    }, 500);
  }
}
