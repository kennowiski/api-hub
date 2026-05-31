async function checkLastFmFallback() {
  if (!lastfm_key) return { isPlaying: false };

  try {
    const lastFmUser = "kennowiski";

    // pega alguns itens pra garantir
    const lastFmUrl =
      `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${lastFmUser}&api_key=${lastfm_key}&format=json&limit=5`;

    const lfResponse = await fetch(lastFmUrl);
    const lfData = await lfResponse.json();

    const tracks = lfData?.recenttracks?.track || [];

    if (!tracks.length) {
      return { isPlaying: false };
    }

    // helper de imagem
    function getImage(track) {
      let finalImageUrl =
        'https://s.ltrbxd.com/static/img/empty-poster-250.8491d904.png';

      if (track.image) {
        const imgData =
          track.image.find(i => i.size === 'extralarge' && i['#text']) ||
          track.image.find(i => i['#text']);

        if (imgData?.['#text']) {
          finalImageUrl =
            imgData['#text'].replace(
              /\/i\/u\/[^/]+\//,
              '/i/u/300x300/'
            );
        }
      }

      return finalImageUrl;
    }

    const firstTrack = tracks[0];
    const isNowPlaying =
      firstTrack?.['@attr']?.nowplaying === 'true';

    // tocando agora
    if (isNowPlaying) {
      return {
        isPlaying: true,
        provider: 'lastfm',
        title: firstTrack.name,
        artist: firstTrack.artist['#text'],
        albumImageUrl: getImage(firstTrack),
      };
    }

    // última música ouvida
    return {
      isPlaying: false,
      provider: 'lastfm',
      title: firstTrack.name,
      artist: firstTrack.artist['#text'],
      albumImageUrl: getImage(firstTrack),
    };

  } catch (e) {
    console.error("Erro no fallback do Last.fm:", e);
  }

  return { isPlaying: false };
}
