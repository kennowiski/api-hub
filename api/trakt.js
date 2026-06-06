export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    const CLIENT_ID = process.env.TRAKT_CLIENT_ID;
    const USERNAME = process.env.TRAKT_USERNAME;

    if (!CLIENT_ID || !USERNAME) {
      return res.status(500).json({
        error: 'Variáveis TRAKT_CLIENT_ID ou TRAKT_USERNAME não configuradas'
      });
    }

    const response = await fetch(
      `https://api.trakt.tv/users/${USERNAME}/history/shows?limit=1`,
      {
        headers: {
          'Content-Type': 'application/json',
          'trakt-api-version': '2',
          'trakt-api-key': CLIENT_ID
        }
      }
    );

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(200).json({
        error: 'Nenhum histórico encontrado'
      });
    }

    const item = data[0];

    return res.status(200).json({
      show: item.show?.title || null,
      year: item.show?.year || null,
      episode: item.episode?.title || null,
      season: item.episode?.season || null,
      episodeNumber: item.episode?.number || null,
      watchedAt: item.watched_at || null,
      traktId: item.show?.ids?.trakt || null
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}
