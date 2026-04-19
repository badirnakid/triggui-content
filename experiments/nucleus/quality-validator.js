/* ═══════════════════════════════════════════════════════════════════════════════
   quality-validator.js — DEFENSA EN CAPAS: VALIDACIÓN MATEMÁTICA DEL NUCLEUS

   Capa 2 de la arquitectura:
     1. Schema strict con minItems/maxItems (la API ya valida estructura)
     2. Este módulo valida SEMÁNTICA estructural: cierres limpios, contraste,
        longitudes, diversidad de gestures, arrays llenos.
     3. Orquestador decide re-extract con modelo más grande si es necesario.

   CERO juicio editorial. Solo matemática.
═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Detecta si una frase termina en palabra conectora suelta (truncamiento).
 * Esto es matemático: la última palabra que no es puntuación es análisis léxico,
 * no juicio editorial.
 */
export function endsWithConnector(phrase) {
  if (!phrase || typeof phrase !== "string") return false;
  const cleaned = phrase.trim();
  if (!cleaned) return false;

  // Última palabra antes de cualquier puntuación final (incluyendo "..." deliberado)
  const lastCharRe = /[.!?\u2026]\s*$/;
  if (!lastCharRe.test(cleaned)) {
    // No termina con cierre natural — candidato a truncamiento
    const words = cleaned.replace(/[,;:\s]+$/, "").split(/\s+/);
    const lastWord = (words[words.length - 1] || "").toLowerCase().replace(/[.,;:!?"'\(\)\[\]]+$/g, "");

    // Palabras conectoras típicas en ES e EN (matemáticamente cortas y sin sentido terminal)
    const connectors = new Set([
      // ES
      "y", "e", "o", "u", "de", "del", "la", "el", "los", "las", "un", "una", "unos", "unas",
      "en", "con", "por", "para", "sin", "sobre", "entre", "se", "es", "son", "era", "fue",
      "que", "pero", "sino", "más", "también", "aún", "ya", "lo", "le", "les", "su", "sus",
      "al", "del", "hacia", "hasta", "desde", "cuando", "donde", "si",
      // EN
      "and", "or", "of", "the", "a", "an", "in", "on", "at", "to", "for", "with", "without",
      "but", "so", "as", "by", "from", "into", "onto", "is", "are", "was", "were", "be",
      "that", "this", "these", "those", "their", "its", "her", "his", "our", "your"
    ]);
    return connectors.has(lastWord);
  }
  return false;
}

/**
 * Verifica que un texto cierre con puntuación terminal (.!?…)
 */
export function endsCleanly(text) {
  if (!text || typeof text !== "string") return false;
  return /[.!?\u2026]\s*$/.test(text.trim());
}

/**
 * Valida un bloque edition: gesture_type presente, phrase válida.
 */
export function validateEditionBlock(block) {
  if (!block || typeof block !== "object") return { valid: false, reason: "no_object" };
  if (!block.gesture_type) return { valid: false, reason: "missing_gesture_type" };
  if (!block.phrase || typeof block.phrase !== "string") return { valid: false, reason: "missing_phrase" };
  if (block.phrase.length < 40) return { valid: false, reason: "phrase_too_short" };
  if (block.phrase.length > 115) return { valid: false, reason: "phrase_too_long" };
  if (endsWithConnector(block.phrase)) return { valid: false, reason: "truncated_connector" };
  if (!endsCleanly(block.phrase)) return { valid: false, reason: "no_terminal_punctuation" };
  return { valid: true };
}

/**
 * Valida un array de edition_blocks completo:
 * - Exactamente 4 items
 * - Cada item válido
 * - Al menos 3 tipos distintos (variedad)
 */
export function validateEditionBlocks(blocks) {
  if (!Array.isArray(blocks)) return { valid: false, reason: "not_array", details: [] };
  if (blocks.length !== 4) return { valid: false, reason: `expected_4_got_${blocks.length}`, details: [] };

  const details = blocks.map((b, i) => ({ index: i, ...validateEditionBlock(b) }));
  const invalidOnes = details.filter((d) => !d.valid);
  if (invalidOnes.length > 0) {
    return { valid: false, reason: "some_blocks_invalid", details };
  }

  // Diversidad: al menos 3 tipos distintos de 4
  const types = new Set(blocks.map((b) => b.gesture_type));
  if (types.size < 3) {
    return { valid: false, reason: `only_${types.size}_distinct_types`, details };
  }

  return { valid: true, details, distinct_types: types.size };
}

/**
 * Valida card (4 campos con cierres limpios)
 */
export function validateCard(card) {
  if (!card || typeof card !== "object") return { valid: false, reason: "no_card" };
  const fields = ["titulo", "parrafoTop", "subtitulo", "parrafoBot"];
  const issues = {};
  for (const f of fields) {
    if (!card[f] || typeof card[f] !== "string") { issues[f] = "missing"; continue; }
    if (endsWithConnector(card[f])) { issues[f] = "truncated_connector"; continue; }
    if ((f === "parrafoTop" || f === "parrafoBot") && !endsCleanly(card[f])) {
      issues[f] = "no_terminal_punctuation";
    }
  }
  return { valid: Object.keys(issues).length === 0, issues };
}

/**
 * Valida array de og_phrases
 */
export function validateOgPhrases(phrases) {
  if (!Array.isArray(phrases)) return { valid: false, reason: "not_array" };
  if (phrases.length !== 4) return { valid: false, reason: `expected_4_got_${phrases.length}` };
  const bad = phrases.filter((p) => !p || typeof p !== "string" || p.length < 30 || p.length > 78 || endsWithConnector(p));
  if (bad.length > 0) return { valid: false, reason: "some_phrases_invalid", bad_count: bad.length };
  return { valid: true };
}

/**
 * Valida confianza mínima del modelo.
 */
export function validateConfidence(confidence, minThreshold = 0.6) {
  if (!confidence || typeof confidence !== "object") return { valid: false, reason: "no_confidence" };
  const { book_grounding = 0, voice_authenticity = 0, specificity = 0 } = confidence;
  const avg = (book_grounding + voice_authenticity + specificity) / 3;
  if (avg < minThreshold) return { valid: false, reason: `avg_${avg.toFixed(2)}_below_${minThreshold}`, avg };
  return { valid: true, avg };
}

/**
 * VALIDADOR INTEGRAL DEL NUCLEUS.
 *
 * Devuelve:
 *   { overall: "pass" | "needs_reextract" | "needs_escalation" | "pass_with_warnings",
 *     warnings: [...],
 *     details: { card_es, card_en, edition_es, edition_en, og_es, og_en, confidence } }
 *
 * Política:
 *   - Cualquier issue en edition_blocks o cards → needs_reextract (son lo que el usuario ve)
 *   - Issues solo en og_phrases → pass_with_warnings (menor impacto)
 *   - Confidence muy baja → needs_escalation (modelo no conoce libro)
 *   - Todo limpio → pass
 */
export function validateNucleus(nucleus) {
  const warnings = [];
  const details = {};

  details.card_es = validateCard(nucleus?.card_es);
  if (!details.card_es.valid) warnings.push(`card_es: ${JSON.stringify(details.card_es.issues)}`);

  details.card_en = validateCard(nucleus?.card_en);
  if (!details.card_en.valid) warnings.push(`card_en: ${JSON.stringify(details.card_en.issues)}`);

  details.edition_es = validateEditionBlocks(nucleus?.edition_blocks_es);
  if (!details.edition_es.valid) warnings.push(`edition_es: ${details.edition_es.reason}`);

  details.edition_en = validateEditionBlocks(nucleus?.edition_blocks_en);
  if (!details.edition_en.valid) warnings.push(`edition_en: ${details.edition_en.reason}`);

  details.og_es = validateOgPhrases(nucleus?.og_phrases_es);
  if (!details.og_es.valid) warnings.push(`og_es: ${details.og_es.reason}`);

  details.og_en = validateOgPhrases(nucleus?.og_phrases_en);
  if (!details.og_en.valid) warnings.push(`og_en: ${details.og_en.reason}`);

  details.confidence = validateConfidence(nucleus?.confidence);

  // DECISIÓN
  const criticalFail = !details.card_es.valid || !details.card_en.valid ||
                       !details.edition_es.valid || !details.edition_en.valid;
  const confidenceFail = !details.confidence.valid;
  const ogFail = !details.og_es.valid || !details.og_en.valid;

  let overall;
  if (criticalFail && confidenceFail) overall = "needs_escalation";
  else if (criticalFail) overall = "needs_reextract";
  else if (confidenceFail) overall = "needs_escalation";
  else if (ogFail) overall = "pass_with_warnings";
  else overall = "pass";

  return { overall, warnings, details };
}
