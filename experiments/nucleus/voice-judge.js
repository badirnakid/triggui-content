/* ═══════════════════════════════════════════════════════════════════════════════
   voice-judge.js — JUEZ SEMÁNTICO RESEÑA vs PÁGINA
═══════════════════════════════════════════════════════════════════════════════ */

const JUDGE_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "VoiceVerdict",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["verdict", "confidence", "reason"],
      properties: {
        verdict: { type: "string", enum: ["pagina", "resena"] },
        confidence: { type: "number" },
        reason: { type: "string" }
      }
    }
  }
};

const JUDGE_PROMPT = `Eres el juez de voz de Triggui.

Tu única pregunta: ¿este texto suena como RESEÑA o como PÁGINA DEL LIBRO?

- PÁGINA: podría estar en el libro mismo, escrito por el autor en su voz
- RESEÑA: alguien habla DEL libro, del autor, o de la obra desde afuera

Señales típicas de reseña: "este libro", "el autor propone", "a través de esta obra", "nos invita a", "reflexiona sobre", "trata de", "muestra cómo", menciones meta del título o autor dentro del texto.

Señales típicas de página: voz directa, primera o segunda persona usada por el libro, tono coherente con la obra, ausencia de referencias meta.

Responde: verdict, confidence (0-1), reason corto (máx 15 palabras).`;

async function judgeOne(openai, card, book, model) {
  const sample = [card.titulo, card.parrafoTop, card.subtitulo, card.parrafoBot].filter(Boolean).join("\n\n");
  const userPrompt = `LIBRO: "${book.titulo}" — ${book.autor}\n\nTEXTO:\n${sample}\n\n¿PÁGINA o RESEÑA?`;
  const t0 = Date.now();
  try {
    const chat = await openai.chat.completions.create({
      model,
      temperature: 0,
      top_p: 1,
      messages: [
        { role: "system", content: JUDGE_PROMPT },
        { role: "user", content: userPrompt }
      ],
      response_format: JUDGE_SCHEMA
    });
    const raw = chat.choices?.[0]?.message?.content || "{}";
    let parsed = { verdict: "pagina", confidence: 0, reason: "judge_empty_response" };
    try { parsed = { ...parsed, ...JSON.parse(raw) }; } catch { /* keep fallback */ }
    return {
      ...parsed,
      elapsed_ms: Date.now() - t0,
      usage: chat.usage,
      error: null
    };
  } catch (error) {
    return {
      verdict: "pagina",
      confidence: 0,
      reason: `judge_failed: ${error.message}`,
      elapsed_ms: Date.now() - t0,
      usage: null,
      error: error.message
    };
  }
}

export async function judgeBothVoices(openai, cardES, cardEN, book, options = {}) {
  const model = options.model || "gpt-4o-mini";
  const [es, en] = await Promise.all([
    judgeOne(openai, cardES, book, model),
    judgeOne(openai, cardEN, book, model)
  ]);

  const bothFailed = es.confidence === 0 && en.confidence === 0 && (es.error || en.error);
  const worst = bothFailed ? "pagina" : (es.verdict === "resena" || en.verdict === "resena" ? "resena" : "pagina");
  const maxConfidence = Math.max(es.confidence, en.confidence);

  return {
    consolidated: worst,
    confidence: maxConfidence,
    es,
    en,
    circuit_tripped: bothFailed,
    should_reextract: worst === "resena" && maxConfidence >= 0.75,
    total_tokens: (es.usage?.total_tokens || 0) + (en.usage?.total_tokens || 0),
    total_ms: Math.max(es.elapsed_ms, en.elapsed_ms)
  };
}
