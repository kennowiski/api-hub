export default async function handler(req, res) {
    // CORS para o GitHub Pages
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const urlSerializd = 'https://www.serializd.com/api/user/kennowiski/diary';
        
        // Colocando um "disfarce" para a API achar que somos um navegador real
        const response = await fetch(urlSerializd, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });
        
        // Pega a resposta bruta da API
        const data = await response.json();

        // DEVOLVE TUDO O QUE VEIO SEM FILTRAR
        return res.status(200).json(data);

    } catch (error) {
        // Mostra o erro exato caso falhe
        return res.status(500).json({ error: error.message });
    }
}
