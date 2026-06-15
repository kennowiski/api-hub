module.exports = async function handler(req, res) {
  // CORS básico para permitir chamada do seu portfólio
  const allowedOrigins = [
    "https://kennowiski.is-a.dev",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];

  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método não permitido. Use POST.",
    });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY não configurada no ambiente da Vercel.",
      });
    }

    const { type, title, year, extra } = req.body || {};

    if (!type || !title) {
      return res.status(400).json({
        error: "Envie type e title no corpo da requisição.",
      });
    }

    const normalizedType = String(type).toLowerCase();

    if (!["movie", "series"].includes(normalizedType)) {
      return res.status(400).json({
        error: "type deve ser 'movie' ou 'series'.",
      });
    }

    const safeTitle = String(title).trim().slice(0, 120);
    const safeYear = year ? String(year).trim().slice(0, 20) : "";
    const safeExtra = extra ? String(extra).trim().slice(0, 500) : "";

    const itemTypePt = normalizedType === "movie" ? "filme" : "série";

    const prompt = `
Você é um recomendador de filmes e séries.

Com base neste ${itemTypePt}:
Título: ${safeTitle}
${safeYear ? `Ano: ${safeYear}` : ""}
${safeExtra ? `Informações extras: ${safeExtra}` : ""}

Recomende 3 obras parecidas.

Regras:
- Responda em português do Brasil.
- Não recomende a mesma obra informada.
- Prefira obras com tom, gênero, ritmo, tema ou atmosfera semelhantes.
- Seja direto.
- Retorne somente JSON válido, sem markdown, sem crases e sem texto fora do JSON.

Formato obrigatório:
{
  "base": {
    "type": "${normalizedType}",
    "title": "${safeTitle}"
  },
  "recommendations": [
    {
      "title": "Nome da recomendação",
      "type": "movie ou series",
      "year": "ano aproximado ou vazio",
      "reason": "motivo curto da recomendação"
    }
  ]
}
`;

    const model = "gemini-3.5-flash";

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 700,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    const geminiData = await geminiResponse.json();

    if (!geminiResponse.ok) {
      return res.status(geminiResponse.status).json({
        error: "Erro ao chamar a Gemini API.",
        details: geminiData,
      });
    }

    const text =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!text) {
      return res.status(500).json({
        error: "A Gemini API não retornou texto.",
        raw: geminiData,
      });
    }

    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch {
      const cleaned = text
        .replace(/^```json/i, "")
        .replace(/^```/i, "")
        .replace(/```$/i, "")
        .trim();

      parsed = JSON.parse(cleaned);
    }

    return res.status(200).json({
      success: true,
      source: "gemini",
      model,
      ...parsed,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Erro interno ao gerar recomendação.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};
