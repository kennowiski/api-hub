export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    const response = await fetch('https://letterboxd.com/kennowiski/rss/', {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const xmlText = await response.text();

    const itemMatch = xmlText.match(/<item>([\s\S]*?)<\/item>/);

    if (!itemMatch) {
      return res.status(200).json({
        error: 'Nenhum filme encontrado'
      });
    }

    const item = itemMatch[1];

    const getTag = (tag) => {
      const match = item.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
      return match ? match[1].trim() : '';
    };

    const title = getTag('title')
      .replace(', watched by kennowiski', '')
      .replace('<![CDATA[', '')
      .replace(']]>', '');

    const link = getTag('link');

    const description = getTag('description')
      .replace('<![CDATA[', '')
      .replace(']]>', '');

    const imgMatch = description.match(/<img[^>]+src="([^"]+)"/);
    const poster = imgMatch
      ? imgMatch[1]
      : 'https://s.ltrbxd.com/static/img/empty-poster-250.8491d904.png';

    return res.status(200).json({
      title,
      link,
      poster
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}
