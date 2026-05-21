export default async function handler(req, res) {
    // Configuração de CORS para permitir que o meu GitHub Pages acesse essa API
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Se o navegador enviar uma requisição de checagem (OPTIONS), responde com OK
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Buscando o diário público do meu usuário no Serializd
        const urlSerializd = 'https://www.serializd.com/api/user/kennowiski/diary';
        const response = await fetch(urlSerializd);
        
        if (!response.ok) {
            throw new Error('Não foi possível conectar à API do Serializd');
        }

        const data = await response.json();

        // Verifica se existem itens no diário
        if (!data.reviews || data.reviews.length === 0) {
            return res.status(200).json({
                hasWatched: false,
                message: "Nenhuma série assistida recentemente"
            });
        }

        // Pegando o primeiro item (o mais recente)
        const ultimaReview = data.reviews[0];

        // Isolando as informações que preciso para o card
        const dadosFormatados = {
            hasWatched: true,
            showName: ultimaReview.showName,                    // Nome da Série
            seasonNumber: ultimaReview.seasonNumber,            // Número da Temporada
            episodeNumber: ultimaReview.episodeNumber,          // Número do Episódio
            bannerUrl: ultimaReview.showBannerUrl || null,      // Imagem de fundo/banner
            rating: ultimaReview.rating || null,                // Sua nota (estrelas)
            dateWatched: ultimaReview.dateWatched               // Data que assistiu
        };

        // Retorna os dados mastigados para o meu Front-end
        return res.status(200).json(dadosFormatados);

    } catch (error) {
        console.error('Erro na API Serializd:', error);
        return res.status(500).json({ error: 'Erro interno ao puxar dados do Serializd' });
    }
}
