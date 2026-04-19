/* ═══════════════════════════════════════════════════════════════════════════════
   quality-validator.js — v3

   Responsabilidad radicalmente reducida. Ya NO valida:
     - hex (imposible por construcción, síntesis determinista)
     - confidence (imposible, calculada post-hoc)
     - idioma mezclado (imposible, schemas separados)
     - emoji presente (imposible, inyección determinista)
     - newlines en phrases (imposible, inyección strip-ea)
     - longitudes (enforced por schema strict)

   Solo valida heurísticas semánticas que NO se pueden garantizar por construcción:
     - Metáforas huecas en el output final
     - Consistencia lens_analysis ↔ lens_relevance (si aplica)
     - Título EN sospechosamente literal (patrón específico)
     - Autor en output final todavía mononimo no-conocido
     - Edition blocks gesture_type realmente distintos
═══════════════════════════════════════════════════════════════════════════════ */

export function detectHollowMetaphors(textArray) {
  if (!Array.isArray(textArray) || textArray.length === 0) return { hollow: false, hits: [] };
  const patterns = [
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
    /sembrar (bienestar|felicidad|paz)/i,
    /dance of (decisions|existence|life)/i,
    /labyrinth of (existence|life|emotions)/i,
    /horizon of (possibilities|dreams|opportunities)/i,
    /every (instant|moment) is an opportunity/i
  ];
  const hits = [];
  for (const text of textArray) {
    const t = String(text || "");
    for (const pat of patterns) {
      if (pat.test(t)) { hits.push({ text: t, pattern: pat.source }); break; }
    }
  }
  return { hollow: hits.length >= 2, hits, count: hits.length };
}

export function detectTruncatedAuthor(author) {
  if (!author || typeof author !== "string") return { truncated: true, reason: "empty" };
  const trimmed = author.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
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

export function detectLiteralTranslation(tituloEs, tituloEn, idiomaOriginal) {
  if (!tituloEs || !tituloEn) return { suspicious: false };
  if (idiomaOriginal !== "en") return { suspicious: false };
  const literalPatterns = [
    [/^la nueva ciencia de /i, /^the new science of /i],
    [/^la ciencia de /i, /^the science of /i],
    [/^el arte de /i, /^the art of /i],
    [/^el poder de /i, /^the power of /i]
  ];
  for (const [esPat, enPat] of literalPatterns) {
    if (esPat.test(tituloEs) && enPat.test(tituloEn)) {
      return { suspicious: true, reason: "literal_translation_pattern" };
    }
  }
  return { suspicious: false };
}

export function validateEditionBlocksDistinct(blocks) {
  if (!Array.isArray(blocks)) return { valid: false, reason: "not_array" };
  const types = new Set(blocks.map((b) => b?.gesture_type).filter(Boolean));
  if (types.size < 3) return { valid: false, reason: `only_${types.size}_distinct_types` };
  return { valid: true, distinct_types: types.size };
}

export function validateLensConsistency(lensAnalysis, lensRelevance) {
  if (!lensAnalysis) return { valid: true };
  if (!lensRelevance || typeof lensRelevance.applied !== "boolean") return { valid: true };
  const shouldApply = lensAnalysis.decision === "apply_directly" || lensAnalysis.decision === "apply_through_adjacent_concept";
  if (lensRelevance.applied !== shouldApply) return { valid: false, reason: "lens_analysis_relevance_mismatch" };
  return { valid: true };
}

/* ─────────────────────────────────────────────────────────────────────────────
   VALIDACIÓN INTEGRAL DEL NUCLEUS FINAL (después de post-processors)
────────────────────────────────────────────────────────────────────────────── */

export function validateFinalNucleus(mapped) {
  const warnings = [];
  const details = {};

  // Identidad
  const identityAuthor = detectTruncatedAuthor(mapped.autor);
  details.author = identityAuthor;
  if (identityAuthor.truncated) warnings.push(`author_truncated: "${mapped.autor}"`);

  const literal = detectLiteralTranslation(mapped.titulo_es, mapped.titulo_en, mapped.idioma_original);
  details.title_literal = literal;
  if (literal.suspicious) warnings.push(`title_en_suspicious_literal: "${mapped.titulo_es}" → "${mapped.titulo_en}"`);

  // Metáforas huecas sobre todo el contenido
  const allTextES = [
    mapped._nucleus?.card_es?.titulo,
    mapped._nucleus?.card_es?.parrafoTop,
    mapped._nucleus?.card_es?.parrafoBot,
    ...(mapped._nucleus?.og_phrases_es || []),
    ...((mapped._nucleus?.edition_blocks_es || []).map((b) => b?.phrase))
  ].filter(Boolean);
  const hollowES = detectHollowMetaphors(allTextES);
  details.hollow_es = hollowES;
  if (hollowES.hollow) warnings.push(`hollow_metaphors_es: ${hollowES.count} hits`);

  const allTextEN = [
    mapped._nucleus?.card_en?.titulo,
    mapped._nucleus?.card_en?.parrafoTop,
    mapped._nucleus?.card_en?.parrafoBot,
    ...(mapped._nucleus?.og_phrases_en || []),
    ...((mapped._nucleus?.edition_blocks_en || []).map((b) => b?.phrase))
  ].filter(Boolean);
  const hollowEN = detectHollowMetaphors(allTextEN);
  details.hollow_en = hollowEN;
  if (hollowEN.hollow) warnings.push(`hollow_metaphors_en: ${hollowEN.count} hits`);

  // Edition blocks gesture_types distintos
  const distinctES = validateEditionBlocksDistinct(mapped._nucleus?.edition_blocks_es);
  details.distinct_gestures_es = distinctES;
  if (!distinctES.valid) warnings.push(`edition_es_${distinctES.reason}`);

  const distinctEN = validateEditionBlocksDistinct(mapped._nucleus?.edition_blocks_en);
  details.distinct_gestures_en = distinctEN;
  if (!distinctEN.valid) warnings.push(`edition_en_${distinctEN.reason}`);

  // Lens consistency
  const lensCheck = validateLensConsistency(mapped._nucleus?.lens_analysis, mapped._grounding?.lens_relevance);
  details.lens_consistency = lensCheck;
  if (!lensCheck.valid) warnings.push(`lens_${lensCheck.reason}`);

  // Política
  let overall;
  const criticalFails = (!distinctES.valid || !distinctEN.valid);
  if (criticalFails) overall = "needs_reextract";
  else if (warnings.length > 0) overall = "pass_with_warnings";
  else overall = "pass";

  return { overall, warnings, details };
}
