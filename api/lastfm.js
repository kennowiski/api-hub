export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=60');

  const lastfm_key = process.env.LASTFM_API_KEY;
  const lastFmUser = 'kennowiski';

  if (!lastfm_key) {
    return res.status(200).json({
      provider: 'lastfm',
      tracks: [],
      error: 'Missing LASTFM_API_KEY environment variable',
    });
  }

  const fallbackImage =
    'https://s.ltrbxd.com/static/img/empty-poster-250.8491d904.png';

  function getBestImage(track) {
    if (!track.image || !Array.isArray(track.image)) return fallbackImage;

    const imageData =
      track.image.find((img) => img.size === 'extralarge' && img['#text']) ||
      track.image.find((img) => img.size === 'large' && img['#text']) ||
      track.image.find((img) => img['#text']);

    if (!imageData || !imageData['#text']) return fallbackImage;

    return imageData['#text'].replace(/\/i\/u\/[^/]+\//, '/i/u/300x300/');
  }

  function formatTrack(track) {
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
      isNowPlaying:
        track['@attr'] && track['@attr'].nowplaying === 'true',
      playedAt:
        track.date && track.date.uts
          ? Number(track.date.uts) * 1000
          : null,
      url: track.url || null,
    };
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function fetchRecentTracks() {
    const url =
      `https://ws.audioscrobbler.com/2.0/` +
      `?method=user.getrecenttracks` +
      `&user=${encodeURIComponent(lastFmUser)}` +
      `&api_key=${encodeURIComponent(lastfm_key)}` +
      `&format=json` +
      `&limit=10`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || data.error) {
      const err = new Error(data.message || 'Last.fm request failed');
      err.status = response.status;
      err.lastfmError = data.error || null;
      err.lastfmMessage = data.message || null;
      throw err;
    }

    return data;
  }

  try {
    let data;

    try {
      data = await fetchRecentTracks();
    } catch (firstError) {
      if (firstError.lastfmError === 8) {
        await wait(700);
        data = await fetchRecentTracks();
      } else {
        throw firstError;
      }
    }

    const rawTracks = data?.recenttracks?.track;

    if (!Array.isArray(rawTracks)) {
      return res.status(200).json({
        provider: 'lastfm',
        tracks: [],
      });
    }

    return res.status(200).json({
      provider: 'lastfm',
      tracks: rawTracks.map(formatTrack),
    });
  } catch (error) {
    return res.status(200).json({
      provider: 'lastfm',
      tracks: [],
      error: error.message,
      lastfmError: error.lastfmError || null,
      lastfmMessage: error.lastfmMessage || null,
    });
  }
}
