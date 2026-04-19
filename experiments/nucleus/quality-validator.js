/* ═══════════════════════════════════════════════════════════════════════════════
   quality-validator.js — VALIDADOR CANÓNICO DEL NUCLEUS V2

   Capas de validación:
     1. Estructural: arrays completos, cierres limpios, longitudes
     2. Consistencia: lens_analysis ↔ lens_relevance sincronizados
     3. Visual: hex válidos, contraste mínimo
     4. Semántica heurística: detecta metáforas huecas y autores truncados
     5. Identidad: detecta títulos inglés claramente mal traducidos

   CERO juicio editorial subjetivo. Solo validaciones matemáticas y heurísticas
   que se pueden medir objetivamente.
═══════════════════════════════════════════════════════════════════════════════ */

import { contrastRatio, isValidHex } from "./triggui-physics.js";

/* ─────────────────────────────────────────────────────────────────────────────
   DETECTORES LÉXICOS MATEMÁTICOS
────────────────────────────────────────────────────────────────────────────── */

export function endsWithConnector(phrase) {
  if (!phrase || typeof phrase !== "string") return false;
  const cleaned = phrase.trim();
  if (!cleaned) return false;
  const lastCharRe = /[.!?\u2026]\s*$/;
  if (!lastCharRe.test(cleaned)) {
    const words = cleaned.replace(/[,;:\s]+$/g, "").split(/\s+/);
    const lastWord = (words[words.length - 1] || "").toLowerCase().replace(/[.,;:!?"'()\[\]]+$/g, "");
    const connectors = new Set([
      "y","e","o","u","de","del","la","el","los","las","un","una","unos","unas",
      "en","con","por","para","sin","sobre","entre","se","es","son","era","fue",
      "que","pero","sino","más","también","aún","ya","lo","le","les","su","sus",
      "al","hacia","hasta","desde","cuando","donde","si",
      "and","or","of","the","a","an","in","on","at","to","for","with","without",
      "but","so","as","by","from","into","onto","is","are","was","were","be",
      "that","this","these","those","their","its","her","his","our","your"
    ]);
    return connectors.has(lastWord);
  }
  return false;
}

export function endsCleanly(text) {
  if (!text || typeof text !== "string") return false;
  return /[.!?\u2026]\s*$/.test(text.trim());
}

/**
 * Detecta metáforas huecas tipo "post de Instagram".
 * Heurística: si N-1 de 4 frases contienen fragmentos de un set específico
 * de metáforas intercambiables, el contenido está desanclado del libro real.
 * No bloquea — emite warning para que el orquestador escale.
 */
export function detectHollowMetaphors(textArray) {
  if (!Array.isArray(textArray) || textArray.length === 0) return { hollow: false, hits: [] };
  const hollowPatterns = [
    /danza de (decisiones|la existencia|la vida)/i,
    /laberinto de (la existencia|la vida|las emociones)/i,
    /horizonte de (posibilidades|sueños|oportunidades)/i,
    /sueños? (anhelados?|más profundos?)/i,
    /esencia (pura|verdadera|del ser)/i,
    /búsqueda incesante/i,
    /abrir las puertas de (la percepción|tu mente)/i,
    /la felicidad se (despliega|revela|encuentra)/i,
    /la vida se (revela|despliega|presenta)/i,
    /cada (instante|momento) es una oportunidad/i,
    /cultivar la (presencia|consciencia)/i,
    /sembrar (bienestar|felicidad|paz)/i
  ];
  const hits = [];
  for (const text of textArray) {
    const t = String(text || "");
    for (const pat of hollowPatterns) {
      if (pat.test(t)) { hits.push({ text: t, pattern: pat.source }); break; }
    }
  }
  return { hollow: hits.length >= 2, hits, count: hits.length };
}

/**
 * Detecta autor truncado: 1 sola palabra donde debería haber nombre completo.
 * "Amishi" → truncado. "Amishi P. Jha" → completo. "Plato" → ok (caso conocido).
 */
export function detectTruncatedAuthor(author) {
  if (!author || typeof author !== "string") return { truncated: true, reason: "empty" };
  const trimmed = author.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  // Lista muy acotada de autores conocidos de una sola palabra (mononimos históricos)
  const mononymsKnown = new Set([
    "platón","plato","aristóteles","aristotle","sócrates","socrates",
    "confucio","confucius","homero","homer","virgilio","virgil",
    "dante","séneca","seneca","ovidio","ovid","cicerón","cicero",
    "molière","voltaire","rumi","hafez","hafiz"
  ]);
  if (words.length === 1) {
    if (mononymsKnown.has(trimmed.toLowerCase())) return { truncated: false };
    return { truncated: true, reason: "single_word_non_mononym", author: trimmed };
  }
  return { truncated: false };
}

/**
 * Detecta título inglés que parece ser traducción literal del español
 * en lugar del título original de publicación.
 * Heurística: si título_es y título_en tienen traducción 1:1 palabra por palabra
 * pero el libro probablemente tiene un título inglés distinto.
 * No podemos saberlo sin base de datos — pero podemos detectar patrones sospechosos.
 */
export function detectLiteralTranslation(tituloEs, tituloEn, idiomaOriginal) {
  if (!tituloEs || !tituloEn) return { suspicious: false };
  // Solo aplica si el libro supuestamente se publicó originalmente en inglés
  if (idiomaOriginal !== "en") return { suspicious: false };

  const normalizeForCompare = (s) => String(s).toLowerCase()
    .replace(/['"'"]/g, "").trim();

  const es = normalizeForCompare(tituloEs);
  const en = normalizeForCompare(tituloEn);

  // Heurística: si empieza con "the new science of..." o "the science of..."
  // y el español empieza con "la nueva ciencia de" o "la ciencia de"
  // es sospechoso de traducción literal (patrón frecuente cuando el modelo inventa).
  const literalPatterns = [
    [/^la nueva ciencia de /i, /^the new science of /i],
    [/^la ciencia de /i, /^the science of /i],
    [/^el arte de /i, /^the art of /i],
    [/^el poder de /i, /^the power of /i]
  ];
  for (const [esPat, enPat] of literalPatterns) {
    if (esPat.test(tituloEs) && enPat.test(tituloEn)) {
      return { suspicious: true, reason: "literal_translation_pattern", es, en };
    }
  }
  return { suspicious: false };
}

/* ─────────────────────────────────────────────────────────────────────────────
   VALIDADORES POR SECCIÓN
────────────────────────────────────────────────────────────────────────────── */

function validateCard(card) {
  if (!card || typeof card !== "object") return { valid: false, reason: "no_card", issues: { _root: "missing" } };
  const fields = ["titulo", "parrafoTop", "subtitulo", "parrafoBot"];
  const issues = {};
  for (const f of fields) {
    if (!card[f] || typeof card[f] !== "string") { issues[f] = "missing"; continue; }
    if (endsWithConnector(card[f])) { issues[f] = "truncated_connector"; continue; }
    if ((f === "parrafoTop" || f === "parrafoBot") && !endsCleanly(card[f])) issues[f] = "no_terminal_punctuation";
  }
  return { valid: Object.keys(issues).length === 0, issues };
}

export function validateEditionBlock(block) {
  if (!block || typeof block !== "object") return { valid: false, reason: "no_object" };
  if (!block.gesture_type) return { valid: false, reason: "missing_gesture_type" };
  if (!block.phrase || typeof block.phrase !== "string") return { valid: false, reason: "missing_phrase" };
  if (block.phrase.length < 50) return { valid: false, reason: "phrase_too_short" };
  if (block.phrase.length > 110) return { valid: false, reason: "phrase_too_long" };
  if (endsWithConnector(block.phrase)) return { valid: false, reason: "truncated_connector" };
  if (!endsCleanly(block.phrase)) return { valid: false, reason: "no_terminal_punctuation" };
  return { valid: true };
}

export function validateEditionBlocks(blocks) {
  if (!Array.isArray(blocks)) return { valid: false, reason: "not_array", details: [] };
  if (blocks.length !== 4) return { valid: false, reason: `expected_4_got_${blocks.length}`, details: [] };
  const details = blocks.map((b, i) => ({ index: i, ...validateEditionBlock(b) }));
  const invalidOnes = details.filter((d) => !d.valid);
  if (invalidOnes.length > 0) return { valid: false, reason: "some_blocks_invalid", details };
  const types = new Set(blocks.map((b) => b.gesture_type));
  if (types.size < 3) return { valid: false, reason: `only_${types.size}_distinct_types`, details };
  return { valid: true, details, distinct_types: types.size };
}

export function validateOgPhrases(phrases) {
  if (!Array.isArray(phrases)) return { valid: false, reason: "not_array" };
  if (phrases.length !== 4) return { valid: false, reason: `expected_4_got_${phrases.length}` };
  const bad = phrases.filter((p) => !p || typeof p !== "string" || p.length < 35 || p.length > 74 || endsWithConnector(p));
  if (bad.length > 0) return { valid: false, reason: "some_phrases_invalid", bad_count: bad.length };
  return { valid: true };
}

export function validateConfidence(confidence, minThreshold = 0.55) {
  if (!confidence || typeof confidence !== "object") return { valid: false, reason: "no_confidence" };
  const { book_grounding = 0, voice_authenticity = 0, specificity = 0 } = confidence;
  const avg = (book_grounding + voice_authenticity + specificity) / 3;
  if (avg < minThreshold) return { valid: false, reason: `avg_${avg.toFixed(2)}_below_${minThreshold}`, avg };
  return { valid: true, avg };
}

function validateAnchors(anchors) {
  if (!anchors || typeof anchors !== "object") return { valid: false, reason: "no_anchors" };
  const conceptCount = Array.isArray(anchors.concepts) ? anchors.concepts.length : 0;
  const keyTermCount = Array.isArray(anchors.key_terms) ? anchors.key_terms.length : 0;
  const voiceNotesLen = String(anchors.authorial_voice_notes || "").trim().length;
  const conceptText = Array.isArray(anchors.concepts) ? anchors.concepts.join(" ") : "";
  const issues = {};
  if (typeof anchors.book_known !== "boolean") issues.book_known = "missing_boolean";
  if (conceptCount < 3 || conceptCount > 5) issues.concepts = `expected_3_to_5_got_${conceptCount}`;
  if (keyTermCount < 3 || keyTermCount > 6) issues.key_terms = `expected_3_to_6_got_${keyTermCount}`;
  if (voiceNotesLen < 50) issues.authorial_voice_notes = "too_short";
  if (endsWithConnector(conceptText)) issues.concepts_text = "truncated_connector";
  return { valid: Object.keys(issues).length === 0, issues };
}

function validateLensAnalysis(la, lensRelevance) {
  if (!la || typeof la !== "object") return { valid: false, reason: "no_lens_analysis", issues: { _root: "missing" } };
  const issues = {};
  if (typeof la.lens_provided !== "boolean") issues.lens_provided = "missing_boolean";
  if (!["apply_directly", "apply_through_adjacent_concept", "dont_apply_book_is_about_something_else"].includes(la.decision)) {
    issues.decision = "invalid_enum";
  }
  if (String(la.analysis || "").trim().length < 10) issues.analysis = "too_short";
  if (lensRelevance && typeof lensRelevance.applied === "boolean") {
    const shouldApply = la.decision === "apply_directly" || la.decision === "apply_through_adjacent_concept";
    if (lensRelevance.applied !== shouldApply) issues.applied_mismatch = "lens_relevance_inconsistent";
  }
  return { valid: Object.keys(issues).length === 0, issues };
}

function validateVisualSignature(vs) {
  if (!vs || typeof vs !== "object") return { valid: false, reason: "no_visual_signature", issues: { _root: "missing" } };
  const issues = {};
  if (!Array.isArray(vs.palette) || vs.palette.length !== 4) issues.palette = "expected_4";
  else if (vs.palette.some((c) => !isValidHex(c))) issues.palette_hex = "invalid_hex";
  if (!isValidHex(vs.accent)) issues.accent = "invalid_hex";
  if (!isValidHex(vs.paper)) issues.paper = "invalid_hex";
  if (!isValidHex(vs.ink)) issues.ink = "invalid_hex";
  if (isValidHex(vs.paper) && isValidHex(vs.ink) && contrastRatio(vs.ink, vs.paper) < 3) issues.contrast = "below_3";
  return { valid: Object.keys(issues).length === 0, issues };
}

function validateIdentity(identity) {
  if (!identity || typeof identity !== "object") return { valid: false, reason: "no_identity", issues: { _root: "missing" } };
  const issues = {};
  const author = detectTruncatedAuthor(identity.autor);
  if (author.truncated) issues.autor = `truncated_${author.reason}`;
  const title = detectLiteralTranslation(identity.titulo_es, identity.titulo_en, identity.idioma_original);
  if (title.suspicious) issues.titulo_en = `suspicious_literal_translation`;
  return { valid: Object.keys(issues).length === 0, issues };
}

function validateSemanticFreshness(nucleus) {
  // Junta todo el texto relevante y busca metáforas huecas
  const ogES = Array.isArray(nucleus?.og_phrases_es) ? nucleus.og_phrases_es : [];
  const ogEN = Array.isArray(nucleus?.og_phrases_en) ? nucleus.og_phrases_en : [];
  const edES = Array.isArray(nucleus?.edition_blocks_es) ? nucleus.edition_blocks_es.map((b) => b?.phrase || "") : [];
  const cards = [
    nucleus?.card_es?.parrafoTop, nucleus?.card_es?.parrafoBot,
    nucleus?.card_es?.titulo, nucleus?.card_es?.subtitulo
  ].filter(Boolean);
  const allES = [...ogES, ...edES, ...cards];
  const esHollow = detectHollowMetaphors(allES);
  const enHollow = detectHollowMetaphors(ogEN);
  const issues = {};
  if (esHollow.hollow) issues.hollow_es = `${esHollow.count}_hollow_hits`;
  if (enHollow.hollow) issues.hollow_en = `${enHollow.count}_hollow_hits`;
  return { valid: Object.keys(issues).length === 0, issues, es_hits: esHollow.hits, en_hits: enHollow.hits };
}

/* ─────────────────────────────────────────────────────────────────────────────
   VALIDACIÓN INTEGRAL
────────────────────────────────────────────────────────────────────────────── */

export function validateNucleus(nucleus) {
  const warnings = [];
  const details = {};

  details.identity = validateIdentity(nucleus?.book_identity);
  if (!details.identity.valid) warnings.push(`identity: ${JSON.stringify(details.identity.issues)}`);

  details.anchors = validateAnchors(nucleus?.book_grounding_anchors);
  if (!details.anchors.valid) warnings.push(`anchors: ${JSON.stringify(details.anchors.issues)}`);

  details.lens_analysis = validateLensAnalysis(nucleus?.lens_analysis, nucleus?.lens_relevance);
  if (!details.lens_analysis.valid) warnings.push(`lens_analysis: ${JSON.stringify(details.lens_analysis.issues)}`);

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

  details.visual_signature = validateVisualSignature(nucleus?.visual_signature);
  if (!details.visual_signature.valid) warnings.push(`visual_signature: ${JSON.stringify(details.visual_signature.issues)}`);

  details.confidence = validateConfidence(nucleus?.confidence);
  if (!details.confidence.valid) warnings.push(`confidence: ${details.confidence.reason}`);

  details.semantic_freshness = validateSemanticFreshness(nucleus);
  if (!details.semantic_freshness.valid) warnings.push(`semantic_freshness: ${JSON.stringify(details.semantic_freshness.issues)}`);

  // Política de decisión:
  // - Crítico (fuerza re-extract): anchors, cards, edition_blocks mal
  // - Escalación (necesita modelo grande): confidence baja, o crítico persistente
  // - Warning (acepta pero marca): identity, og, visual, lens_analysis, semantic_freshness
  const criticalFail = !details.anchors.valid || !details.card_es.valid || !details.card_en.valid ||
                       !details.edition_es.valid || !details.edition_en.valid;
  const confidenceFail = !details.confidence.valid;
  const warningsExist = !details.og_es.valid || !details.og_en.valid ||
                        !details.visual_signature.valid || !details.lens_analysis.valid ||
                        !details.identity.valid || !details.semantic_freshness.valid;

  let overall;
  if (criticalFail && confidenceFail) overall = "needs_escalation";
  else if (criticalFail) overall = "needs_reextract";
  else if (confidenceFail) overall = "needs_escalation";
  else if (warningsExist) overall = "pass_with_warnings";
  else overall = "pass";

  return { overall, warnings, details };
}
