export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    const CLIENT_ID = process.env.TRAKT_CLIENT_ID;
    const USERNAME = process.env.TRAKT_USERNAME;

    const response = await fetch(
      `https://api.trakt.tv/users/${USERNAME}/history/shows?limit=1`,
      {
        headers: {
          'Content-Type': 'application/json',
          'trakt-api-version': '2',
          'trakt-api-key': CLIENT_ID,
          'User-Agent': 'KennyWebsite/1.0'
        }
      }
    );

    const data = await response.json();
    const item = data[0];

    return res.status(200).json({
  show: item.show.title,
  year: item.show.year,
  season: item.episode.season,
  episodeNumber: item.episode.number,
  episode: item.episode.title,
  watchedAt: item.watched_at,
  traktId: item.show.ids.trakt,
  slug: item.show.ids.slug,
  tmdbId: item.show.ids.tmdb,
  imdbId: item.show.ids.imdb
});

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}
