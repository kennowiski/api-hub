export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const lastfm_key = process.env.LASTFM_API_KEY;
  const lastFmUser = 'kennowiski';

  if (!lastfm_key) {
    return res.status(500).json({
      error: 'Missing LASTFM_API_KEY environment variable',
    });
  }

  function getBestImage(track) {
    const fallbackImage =
      'https://s.ltrbxd.com/static/img/empty-poster-250.8491d904.png';

    if (!track.image || !Array.isArray(track.image)) {
      return fallbackImage;
    }

    const imageData =
      track.image.find((img) => img.size === 'extralarge' && img['#text']) ||
      track.image.find((img) => img.size === 'large' && img['#text']) ||
      track.image.find((img) => img['#text']);

    if (!imageData || !imageData['#text']) {
      return fallbackImage;
    }

    return imageData['#text'].replace(/\/i\/u\/[^/]+\//, '/i/u/300x300/');
  }

  function formatTrack(track) {
    const isNowPlaying =
      track['@attr'] && track['@attr'].nowplaying === 'true';

    return {
      title: track.name || 'Desconhecido',
      artist:
        track.artist && track.artist['#text']
          ? track.artist['#text']
          : 'Desconhecido',
      album:
        track.album && track.album['#text']
          ? track.album['#text']
          : '',
      albumImageUrl: getBestImage(track),
      isNowPlaying,
      playedAt:
        track.date && track.date.uts
          ? Number(track.date.uts) * 1000
          : null,
      url: track.url || null,
    };
  }

  try {
    const lastFmUrl =
      `https://ws.audioscrobbler.com/2.0/` +
      `?method=user.getrecenttracks` +
      `&user=${encodeURIComponent(lastFmUser)}` +
      `&api_key=${encodeURIComponent(lastfm_key)}` +
      `&format=json` +
      `&limit=10`;

    const response = await fetch(lastFmUrl);
    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(500).json({
        error: 'Last.fm returned non-JSON response',
        status: response.status,
        body: text,
      });
    }

    if (!response.ok || data.error) {
      return res.status(500).json({
        error: 'Last.fm API error',
        status: response.status,
        lastfmError: data.error || null,
        lastfmMessage: data.message || null,
        raw: data,
      });
    }

    const rawTracks = data?.recenttracks?.track;

    if (!Array.isArray(rawTracks)) {
      return res.status(200).json({
        provider: 'lastfm',
        tracks: [],
        raw: data,
      });
    }

    const tracks = rawTracks.map(formatTrack);

    return res.status(200).json({
      provider: 'lastfm',
      tracks,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Server error while fetching Last.fm',
      message: error.message,
    });
  }
}
