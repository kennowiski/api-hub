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
        const response = await fetch(urlSerializd);
        
        // Pega a resposta bruta do Serializd
        const data = await response.json();

        // DEVOLVE TUDO O QUE VEIO SEM FILTRAR
        return res.status(200).json(data);

    } catch (error) {
        // Se der erro, mostra qual foi o erro exato na tela
        return res.status(500).json({ error: error.message });
    }
}
