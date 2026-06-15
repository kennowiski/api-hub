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
            temperature: 0.7,
            maxOutputTokens: 700,
            responseFormat: {
              text: {
                mimeType: "APPLICATION_JSON",
                schema: {
                  type: "object",
                  properties: {
                    recommendations: {
                      type: "array",
                      minItems: 3,
                      maxItems: 3,
                      items: {
                        type: "object",
                        properties: {
                          title: {
                            type: "string",
                          },
                          type: {
                            type: "string",
                          },
                          year: {
                            type: "string",
                          },
                          reason: {
                            type: "string",
                          },
                        },
                        required: ["title", "type", "year", "reason"],
                      },
                    },
                  },
                  required: ["recommendations"],
                },
              },
            },
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

    const parsed = JSON.parse(text);

    return res.status(200).json({
      success: true,
      source: "gemini",
      model,
      base: {
        type: normalizedType,
        title: safeTitle,
        year: safeYear,
      },
      recommendations: parsed.recommendations || [],
    });
  } catch (error) {
    return res.status(500).json({
      error: "Erro interno ao gerar recomendação.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};
