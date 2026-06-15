module.exports = async function handler(req, res) {
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
        error: "GEMINI_API_KEY não configurada na Vercel.",
      });
    }

    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    const { type, title, year, extra } = body;

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

Recomende exatamente 3 obras parecidas.

Regras:
- Responda em português do Brasil.
- Não recomende a mesma obra informada.
- Prefira obras com tom, gênero, ritmo, tema ou atmosfera semelhantes.
- Seja direto.
- Retorne somente JSON válido.
- Não use markdown.
- Não use crases.
- Não escreva nada antes ou depois do JSON.

Formato obrigatório:
{
  "recommendations": [
    {
      "title": "Nome da obra",
      "type": "movie ou series",
      "year": "ano",
      "reason": "motivo curto"
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
            temperature: 0.6,
            maxOutputTokens: 1200,
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

    let text =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    text = String(text).trim();

    if (!text) {
      return res.status(500).json({
        error: "A Gemini API retornou resposta vazia.",
        raw: geminiData,
      });
    }

    text = text
      .replace(/^```json/i, "")
      .replace(/^```/i, "")
      .replace(/```$/i, "")
      .trim();

    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1) {
      text = text.slice(firstBrace, lastBrace + 1);
    }

    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      return res.status(500).json({
        error: "A Gemini API retornou JSON inválido.",
        details: parseError.message,
        rawText: text,
      });
    }

    return res.status(200).json({
      success: true,
      source: "gemini",
      model,
      base: {
        type: normalizedType,
        title: safeTitle,
        year: safeYear,
      },
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.slice(0, 3)
        : [],
    });
  } catch (error) {
    return res.status(500).json({
      error: "Erro interno ao gerar recomendação.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};
