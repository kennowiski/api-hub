export default async function handler(request, response) {
    // Configura os cabeçalhos de CORS para permitir que seu portfólio acesse esta API
    response.setHeader('Access-Control-Allow-Credentials', true);
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    response.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }

    // Pega a chave que salvamos na Vercel
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return response.status(500).json({ error: 'Chave da API do Gemini não configurada na Vercel.' });
    }

    // Pega os parâmetros enviados pelo seu portfólio (ex: ?tipo=filme&titulo=Inception)
    const { tipo, titulo } = request.query;

    if (!tipo || !titulo) {
        return response.status(400).json({ error: 'Parâmetros "tipo" e "titulo" são obrigatórios.' });
    }

    // Criamos as instruções do sistema (System Prompt) para moldar a personalidade da IA
    const systemInstruction = `Você é o recomendador oficial de cultura pop do portfólio do Kenny. 
O usuário vai te passar um filme ou uma música que o Kenny acabou de consumir. 
Seu papel é analisar essa obra e recomendar apenas UMA outra obra (filme, série ou música) que tenha uma vibe extremamente parecida e que você acha que o visitante do site também vai gostar.
Seja direto, amigável, traga curiosidades breves e mantenha a resposta curta (máximo de 3 ou 4 parágrafos pequenos), formatada em texto simples ou markdown leve.`;

    // Prompt que junta as informações do usuário
    const promptText = `O usuário acabou de ver/ouvir a seguinte obra:\nTipo: ${tipo}\nTítulo: ${titulo}\n\nMe dê uma recomendação fantástica com base nisso!`;

    // URL oficial da API do Gemini em 2026 (usando o modelo estável gratuito Gemini 3 Flash)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    try {
        const geminiResponse = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: promptText }
                        ]
                    }
                ],
                systemInstruction: {
                    parts: [
                        { text: systemInstruction }
                    ]
                },
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 500
                }
            })
        });

        if (!geminiResponse.ok) {
            const errorData = await geminiResponse.json();
            return response.status(geminiResponse.status).json({ error: 'Erro na API do Gemini', detalhes: errorData });
        }

        const data = await geminiResponse.json();
        
        // Extrai o texto da resposta estruturada do Gemini
        const textoRecomendacao = data.candidates?.[0]?.content?.parts?.[0]?.text || "Não consegui gerar uma recomendação no momento.";

        // Retorna a resposta limpa para o seu portfólio
        return response.status(200).json({ recomendacao: textoRecomendacao });

    } catch (error) {
        return response.status(500).json({ error: 'Erro interno ao conectar com o Gemini.', detalhes: error.message });
    }
}
