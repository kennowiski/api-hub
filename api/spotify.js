export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const client_id = process.env.SPOTIFY_CLIENT_ID;
  const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
  const refresh_token = process.env.SPOTIFY_REFRESH_TOKEN;

  if (!client_id || !client_secret || !refresh_token) {
    return res.status(500).json({
      error: 'Missing environment variables'
    });
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

    console.log(tokenData);

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

    if (nowPlaying.status === 204) {
      return res.status(200).json({
        isPlaying: false,
      });
    }

    const song = await nowPlaying.json();

    if (!song.item) {
      return res.status(200).json({
        isPlaying: false,
      });
    }

    return res.status(200).json({
      isPlaying: song.is_playing,
      title: song.item.name,
      artist: song.item.artists
        .map((artist) => artist.name)
        .join(', '),
      albumImageUrl: song.item.album.images[0].url,
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
}
