export default async function handler(req, res) {
    // CORS para o seu site acessar
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Requisição LIMPA e oficial, sem disfarces para não acionar o anti-bot
        const response = await fetch('https://www.serializd.com/api/user/kennowiski/diary');
        
        if (!response.ok) {
            throw new Error(`Erro na API: ${response.status}`);
        }

        const data = await response.json();

        // Se o diário estiver vazio ou der problema
        if (!data.reviews || data.reviews.length === 0) {
            return res.status(200).json({ hasWatched: false });
        }

        // Pega a última série registrada (The Boys)
        const ultimaSerie = data.reviews[0];

        // Manda mastigado para o seu Front-end
        return res.status(200).json({
            hasWatched: true,
            showName: ultimaSerie.showName,
            seasonNumber: ultimaSerie.seasonNumber,
            episodeNumber: ultimaSerie.episodeNumber,
            bannerUrl: ultimaSerie.showBannerUrl || null,
            rating: ultimaSerie.rating || null
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
