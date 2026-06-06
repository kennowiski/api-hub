export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    const response = await fetch(
      'https://www.serializd.com/api/user/kennowiski/diary?page=1'
    );

    const data = await response.json();

    if (!data.reviews?.length) {
      return res.status(200).json({
        error: 'Nenhuma série encontrada'
      });
    }

    const latest = data.reviews[0];

    const season = latest.showSeasons.find(
      s => s.id === latest.seasonId
    );

    return res.status(200).json({
      title: latest.showName,
      season: season?.name || '',
      rating: latest.rating,
      poster: season?.posterPath
        ? `https://image.tmdb.org/t/p/w300${season.posterPath}`
        : 'https://s.ltrbxd.com/static/img/empty-poster-250.8491d904.png',
      episode: latest.episodeName || null,
      episodeNumber: latest.episodeNumber || null,
      date: latest.dateAdded
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}
