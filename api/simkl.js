// NOTA: este arquivo continua se chamando "trakt.js" (mesma rota /api/trakt)
// de propósito, para não precisar mudar a URL que o frontend já chama.
// Por dentro, os dados agora vêm da Simkl (simkl.com), não mais do Trakt.
//
// Env vars necessárias na Vercel:
//   SIMKL_CLIENT_ID     -> client_id do app criado em simkl.com/settings/developer
//   SIMKL_ACCESS_TOKEN  -> access_token obtido via PIN flow (script get-simkl-token.js)
//   TMDB_API_KEY        -> já existia, reaproveitada aqui pro poster e nome do episódio

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    const CLIENT_ID = process.env.SIMKL_CLIENT_ID;
    const ACCESS_TOKEN = process.env.SIMKL_ACCESS_TOKEN;
    const TMDB_KEY = process.env.TMDB_API_KEY;

    if (!CLIENT_ID || !ACCESS_TOKEN) {
      return res.status(500).json({
        error: 'Configuração ausente',
        reason: 'SIMKL_CLIENT_ID e/ou SIMKL_ACCESS_TOKEN não estão definidos nas env vars da Vercel.'
      });
    }

    // 1. Busca a biblioteca de séries do usuário na Simkl (todos os status)
    const response = await fetch(
      `https://api.simkl.com/sync/all-items/shows?extended=full&client_id=${CLIENT_ID}&app-name=kenny-portfolio&app-version=1.0`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'User-Agent': 'KennyWebsite/1.0'
        }
      }
    );

    const responseText = await response.text();
    const contentType = response.headers.get('content-type') || '';

    if (!response.ok) {
      return res.status(502).json({
        error: 'A API da Simkl recusou a requisição',
        status: response.status,
        statusText: response.statusText,
        preview: responseText.substring(0, 200),
        reason: response.status === 401 || response.status === 403
          ? 'Access token inválido/expirado, ou client_id errado. Gere um novo token com o script de PIN flow.'
          : 'Veja "preview" para mais detalhes.'
      });
    }

    if (!contentType.includes('application/json') || responseText.trim().startsWith('<')) {
      return res.status(502).json({
        error: 'Resposta não-JSON detectada',
        status: response.status,
        preview: responseText.substring(0, 100),
        reason: 'A API da Simkl retornou algo que não é JSON.'
      });
    }

    const data = JSON.parse(responseText);
    const shows = data.shows || [];

    // 2. Encontra a série com o episódio assistido mais recentemente
    const withHistory = shows.filter(item => item.last_watched_at && item.last_watched);
    if (withHistory.length === 0) {
      return res.status(200).json({ error: 'Nenhum histórico encontrado' });
    }

    withHistory.sort((a, b) => new Date(b.last_watched_at) - new Date(a.last_watched_at));
    const item = withHistory[0];

    // "S03E06" -> season 3, episode 6
    const match = /S(\d+)E(\d+)/i.exec(item.last_watched || '');
    const season = match ? parseInt(match[1], 10) : null;
    const episodeNumber = match ? parseInt(match[2], 10) : null;

    const tmdbId = item.show?.ids?.tmdb || null;
    let posterUrl = null;
    let episodeTitle = null;
    let genres = null;

    // 3. Busca pôster da série e o nome do episódio na TMDB
    if (tmdbId && TMDB_KEY) {
      try {
        const tmdbShowResponse = await fetch(
          `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_KEY}&language=pt-BR`
        );
        if (tmdbShowResponse.ok) {
          const tmdbShowText = await tmdbShowResponse.text();
          if ((tmdbShowResponse.headers.get('content-type') || '').includes('application/json')) {
            const tmdbShowData = JSON.parse(tmdbShowText);
            if (tmdbShowData.poster_path) {
              posterUrl = `https://image.tmdb.org/t/p/w300${tmdbShowData.poster_path}`;
            }
            if (Array.isArray(tmdbShowData.genres) && tmdbShowData.genres.length > 0) {
              genres = tmdbShowData.genres.map(g => g.name).join(', ');
            }
          }
        }
      } catch (tmdbError) {
        console.error('Erro ao buscar pôster no TMDB:', tmdbError.message);
      }

      if (season !== null && episodeNumber !== null) {
        try {
          const tmdbEpResponse = await fetch(
            `https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}/episode/${episodeNumber}?api_key=${TMDB_KEY}&language=pt-BR`
          );
          if (tmdbEpResponse.ok) {
            const tmdbEpText = await tmdbEpResponse.text();
            if ((tmdbEpResponse.headers.get('content-type') || '').includes('application/json')) {
              const tmdbEpData = JSON.parse(tmdbEpText);
              episodeTitle = tmdbEpData.name || null;
            }
          }
        } catch (tmdbError) {
          console.error('Erro ao buscar nome do episódio no TMDB:', tmdbError.message);
        }
      }
    }

    const simklId = item.show?.ids?.simkl || null;
    const slug = item.show?.ids?.slug || null;
    const simklUrl = simklId ? `https://simkl.com/tv/${simklId}` : 'https://simkl.com';

    // 4. Retorna no MESMO formato que o frontend já espera (era o shape do Trakt)
    return res.status(200).json({
      show: item.show?.title || null,
      year: item.show?.year || null,
      season: season,
      episodeNumber: episodeNumber,
      episode: episodeTitle,
      watchedAt: item.last_watched_at,
      traktId: simklId,          // reaproveita o mesmo campo, agora com o id da Simkl
      episodeTraktId: null,      // Simkl não expõe id de episódio individual aqui
      slug: slug,
      tmdbId: tmdbId,
      imdbId: item.show?.ids?.imdb || null,
      poster: posterUrl,
      rating: item.user_rating || null, // Simkl só tem rating por série, não por episódio
      genres: genres,
      traktUrl: simklUrl
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}
