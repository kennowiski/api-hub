export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    const response = await fetch(
      'https://www.serializd.com/api/user/kennowiski/diary?page=1&include_target=true',
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0.0.0 Safari/537.36',
          'Accept': 'application/json,text/plain,*/*',
          'Referer': 'https://www.serializd.com/user/kennowiski/diary',
          'Origin': 'https://www.serializd.com'
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
      error: error.message,
      stack: error.stack
    });
  }
}
