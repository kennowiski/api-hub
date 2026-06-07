export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    const CLIENT_ID = process.env.TRAKT_CLIENT_ID;
    const USERNAME = process.env.TRAKT_USERNAME;
    const TMDB_KEY = process.env.TMDB_API_KEY;

    // 1. Busca o histórico de séries no Trakt
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

    if (!item) {
      return res.status(200).json({ error: 'Nenhum histórico encontrado' });
    }

    const tmdbId = item.show.ids.tmdb;
    let posterUrl = null;

    // 2. Busca o pôster da série no TMDB
    if (tmdbId && TMDB_KEY) {
      try {
        const tmdbResponse = await fetch(
          `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_KEY}&language=pt-BR`
        );

        if (tmdbResponse.ok) {
          const tmdbData = await tmdbResponse.json();

          if (tmdbData.poster_path) {
            posterUrl = `https://image.tmdb.org/t/p/w300${tmdbData.poster_path}`;
          }
        }
      } catch (tmdbError) {
        console.error('Erro ao buscar imagem no TMDB:', tmdbError.message);
      }
    }

    // 3. Busca a sua avaliação do episódio no Trakt
    let rating = null;

    try {
      const ratingsResponse = await fetch(
        `https://api.trakt.tv/users/${USERNAME}/ratings/episodes?limit=100`,
        {
          headers: {
            'Content-Type': 'application/json',
            'trakt-api-version': '2',
            'trakt-api-key': CLIENT_ID,
            'User-Agent': 'KennyWebsite/1.0'
          }
        }
      );

      if (ratingsResponse.ok) {
        const ratingsData = await ratingsResponse.json();

        const ratedEpisode = ratingsData.find(
          ratingItem => ratingItem.episode?.ids?.trakt === item.episode.ids.trakt
        );

        if (ratedEpisode) {
          rating = ratedEpisode.rating;
        }
      }
    } catch (ratingError) {
      console.error('Erro ao buscar avaliação no Trakt:', ratingError.message);
    }

    // 4. Retorna os dados completos para o HTML
    return res.status(200).json({
      show: item.show.title,
      year: item.show.year,
      season: item.episode.season,
      episodeNumber: item.episode.number,
      episode: item.episode.title,
      watchedAt: item.watched_at,
      traktId: item.show.ids.trakt,
      episodeTraktId: item.episode.ids.trakt,
      slug: item.show.ids.slug,
      tmdbId: tmdbId,
      imdbId: item.show.ids.imdb,
      poster: posterUrl,
      rating: rating
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}
