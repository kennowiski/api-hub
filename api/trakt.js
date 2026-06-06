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

    const text = await response.text();

    return res.status(200).json({
      status: response.status,
      contentType: response.headers.get('content-type'),
      finalUrl: response.url,
      preview: text.substring(0, 1000)
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}
