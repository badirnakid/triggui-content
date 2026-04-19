/* ═══════════════════════════════════════════════════════════════════════════════
   post-processors.js — TRANSFORMACIONES DETERMINISTAS POST-LLM

   1. injectEmojis(content, bookSeed): agrega emoji al inicio de cada og_phrase
      y edition_block.phrase. Elige emoji según sensory_anchor (ES) o gesture_type (EN),
      rotando entre 2-3 variantes con seed derivada del libro. Determinista por libro,
      variado entre libros.

   2. calculateConfidence(groundingSource, tierReached, anchors, voiceVerdict,
                          groundingJudgeScore, cards):
      Confidence objetiva desde 4 señales ortogonales.

   3. compatMapper(book, groundTruth, anchorsData, contentES, contentEN, palette,
                   voiceVerdict, groundingJudgeES, groundingJudgeEN, confidence, crono,
                   inputsSnapshot, runMeta):
      Arma el JSON compat v9.7.4 desde todas las piezas.
═══════════════════════════════════════════════════════════════════════════════ */

import { createHash } from "node:crypto";
import { textContrastOn, darken, withAlpha, densityToMultipliers, rhythmToMultipliers, typographyFamilyToStack } from "./triggui-physics.js";
import { renderTarjetaES, renderTarjetaEN, prepareOGPhrases, prepareEditionPhrases } from "./render-tarjeta.js";

/* ─────────────────────────────────────────────────────────────────────────────
   MAPAS DE EMOJIS
   Cada sensory_anchor / gesture_type tiene 2-3 emojis. Elegimos con seed del libro.
────────────────────────────────────────────────────────────────────────────── */

const EMOJI_BY_SENSORY_ES = {
  vista: ["👁", "🔭", "🌅"],
  oido: ["🎧", "🔔", "📻"],
  tacto: ["✋", "🪨", "🧶"],
  olfato: ["🌿", "🕯", "☕"],
  gusto: ["🍎", "🫖", "🧂"],
  movimiento: ["🚶", "🌊", "💫"],
  espacio: ["🏛", "🗺", "🌌"],
  luz: ["☀", "🕯", "💡"],
  respiracion: ["🌬", "🫁", "🧘"],
  tiempo: ["⏳", "🕰", "🌓"]
};

const EMOJI_BY_SENSORY_EN = {
  sight: ["👁", "🔭", "🌅"],
  hearing: ["🎧", "🔔", "📻"],
  touch: ["✋", "🪨", "🧶"],
  smell: ["🌿", "🕯", "☕"],
  taste: ["🍎", "🫖", "🧂"],
  movement: ["🚶", "🌊", "💫"],
  space: ["🏛", "🗺", "🌌"],
  light: ["☀", "🕯", "💡"],
  breath: ["🌬", "🫁", "🧘"],
  time: ["⏳", "🕰", "🌓"]
};

// Para og_phrases que no tienen sensory_anchor, usamos un set neutral por libro
const EMOJI_OG_POOL = [
  "✨", "⚓", "🔁", "🛡", "🎯", "🌱", "🔮", "🕊",
  "📖", "🌓", "🪞", "⚡", "🌿", "🧭", "🔍", "💠"
];

function seedFromBook(titulo, autor) {
  const hash = createHash("sha256").update(`${titulo}|${autor}`.toLowerCase()).digest();
  // Convertir primeros 8 bytes a número entero
  return hash.readUInt32BE(0);
}

function pickWithSeed(options, seed, index) {
  if (!Array.isArray(options) || options.length === 0) return "";
  return options[(seed + index) % options.length];
}

/* ─────────────────────────────────────────────────────────────────────────────
   INJECT EMOJIS
────────────────────────────────────────────────────────────────────────────── */

export function injectEmojis(contentES, contentEN, titulo, autor) {
  const seed = seedFromBook(titulo, autor);

  // Edition blocks ES con emoji por sensory_anchor
  const editionES = (contentES.edition_blocks_es || []).map((block, i) => {
    const pool = EMOJI_BY_SENSORY_ES[block.sensory_anchor] || EMOJI_OG_POOL;
    const emoji = pickWithSeed(pool, seed, i);
    const phraseClean = String(block.phrase || "").trim().replace(/[\n\r]+/g, " ").replace(/\s+/g, " ");
    return { ...block, phrase: `${emoji} ${phraseClean}` };
  });

  // Edition blocks EN con emoji por sensory_anchor
  const editionEN = (contentEN.edition_blocks_en || []).map((block, i) => {
    const pool = EMOJI_BY_SENSORY_EN[block.sensory_anchor] || EMOJI_OG_POOL;
    const emoji = pickWithSeed(pool, seed, i);
    const phraseClean = String(block.phrase || "").trim().replace(/[\n\r]+/g, " ").replace(/\s+/g, " ");
    return { ...block, phrase: `${emoji} ${phraseClean}` };
  });

  // OG phrases: emoji desde pool neutral rotando con seed
  const ogES = (contentES.og_phrases_es || []).map((phrase, i) => {
    const emoji = pickWithSeed(EMOJI_OG_POOL, seed, i + 10);
    const clean = String(phrase || "").trim().replace(/[\n\r]+/g, " ").replace(/\s+/g, " ");
    return `${emoji} ${clean}`;
  });

  const ogEN = (contentEN.og_phrases_en || []).map((phrase, i) => {
    const emoji = pickWithSeed(EMOJI_OG_POOL, seed, i + 10);
    const clean = String(phrase || "").trim().replace(/[\n\r]+/g, " ").replace(/\s+/g, " ");
    return `${emoji} ${clean}`;
  });

  return {
    edition_blocks_es: editionES,
    edition_blocks_en: editionEN,
    og_phrases_es: ogES,
    og_phrases_en: ogEN
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   CONFIDENCE CALCULATOR
   3 señales ortogonales que miden cosas distintas. Nada autorreportado.
────────────────────────────────────────────────────────────────────────────── */

const GENERIC_TERMS_ES = new Set([
  "viaje", "camino", "luz", "presencia", "esencia", "momento", "vida", "sueños",
  "horizonte", "búsqueda", "crecimiento", "cambio", "bienestar", "felicidad", "éxito",
  "propósito", "intención", "claridad", "equilibrio", "armonía"
]);

const GENERIC_TERMS_EN = new Set([
  "journey", "path", "light", "presence", "essence", "moment", "life", "dreams",
  "horizon", "search", "growth", "change", "wellness", "happiness", "success",
  "purpose", "intention", "clarity", "balance", "harmony"
]);

function specificitySignal(anchors) {
  const concepts = Array.isArray(anchors?.concepts) ? anchors.concepts : [];
  const keyTerms = Array.isArray(anchors?.key_terms) ? anchors.key_terms : [];
  const allTerms = [...concepts.join(" ").toLowerCase().split(/\W+/), ...keyTerms.map((t) => t.toLowerCase())].filter(Boolean);
  if (allTerms.length === 0) return 0.4;
  const genericCount = allTerms.filter((t) => GENERIC_TERMS_ES.has(t) || GENERIC_TERMS_EN.has(t)).length;
  const genericRatio = genericCount / allTerms.length;
  // 0% términos genéricos → 0.95; 50% → 0.5; 100% → 0.2
  return Math.max(0.2, 0.95 - genericRatio * 1.5);
}

function voiceSignal(voiceVerdict) {
  if (!voiceVerdict) return 0.5;
  if (voiceVerdict.consolidated === "pagina") return Math.min(0.95, 0.7 + (voiceVerdict.confidence || 0.5) * 0.25);
  if (voiceVerdict.consolidated === "reseña" || voiceVerdict.consolidated === "resena") return Math.max(0.3, 0.5 - (voiceVerdict.confidence || 0.5) * 0.2);
  return 0.5;
}

export function calculateConfidence({ bookIdentityConfidence, anchors, voiceVerdict, groundingJudgeES, groundingJudgeEN }) {
  const grounding = bookIdentityConfidence || 0.5; // Señal 1: viene del grounding-resolver (Tier 1-4)
  const voice = voiceSignal(voiceVerdict);          // Señal 2: voice judge
  const specificity = specificitySignal(anchors);   // Señal 3: anti-genericidad de anchors
  const judgeScore = ((groundingJudgeES?.grounded_score ?? 0.5) + (groundingJudgeEN?.grounded_score ?? 0.5)) / 2; // Señal 4: grounding judge

  // Combinación: cada señal pesa distinto. Grounding (tier) y judge son los más fiables.
  const combined = grounding * 0.30 + voice * 0.20 + specificity * 0.20 + judgeScore * 0.30;

  return {
    book_grounding: Math.round(grounding * 100) / 100,
    voice_authenticity: Math.round(voice * 100) / 100,
    specificity: Math.round(specificity * 100) / 100,
    grounding_judge: Math.round(judgeScore * 100) / 100,
    combined: Math.round(combined * 100) / 100,
    signals: {
      bookIdentityConfidence: grounding,
      voiceSignal: voice,
      specificitySignal: specificity,
      judgeScore
    }
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   COMPAT MAPPER — arma JSON v9.7.4
────────────────────────────────────────────────────────────────────────────── */

export function compatMapper({
  book, groundTruthMeta, anchorsData, contentES, contentEN, palette,
  emojiInjected, voiceVerdict, groundingJudgeES, groundingJudgeEN,
  confidence, crono, inputsSnapshot, runMeta, qualityWarning
}) {
  const autorFinal = groundTruthMeta.verified_identity?.autor_completo || anchorsData.book_identity.autor_completo || book.autor;
  const style = { accent: palette.accent, paper: palette.paper, ink: palette.ink, border: palette.border };

  const tarjetaVisualStub = {
    paper: palette.paper, ink: palette.ink, accent: palette.accent, border: palette.border,
    paperIsDark: palette.paper_is_dark,
    cssVars: buildCssVars(palette, anchorsData.visual_intent)
  };

  const tarjetaES = renderTarjetaES(contentES.card_es, tarjetaVisualStub);
  const tarjetaEN = renderTarjetaEN(contentEN.card_en, tarjetaVisualStub);

  const gestureTypesES = (contentES.edition_blocks_es || []).map((b) => b?.gesture_type);
  const gestureTypesEN = (contentEN.edition_blocks_en || []).map((b) => b?.gesture_type);

  return {
    titulo: book.titulo,
    autor: autorFinal,
    tagline: book.tagline || "",
    portada: book.portada || `📚 ${book.titulo}\n${autorFinal}`,
    portada_url: book.portada_url || book.portada || "",
    isbn: book.isbn || "",

    titulo_es: anchorsData.book_identity.titulo_es,
    titulo_en: anchorsData.book_identity.titulo_en,
    idioma_original: anchorsData.book_identity.idioma_original,

    dimension: anchorsData.surface_hints.dimension,
    punto: anchorsData.surface_hints.punto_hawkins,
    palabras: contentES.emotional_words_es,
    palabras_en: contentEN.emotional_words_en,
    frases: prepareEditionPhrases(emojiInjected.edition_blocks_es),
    frases_en: prepareEditionPhrases(emojiInjected.edition_blocks_en),
    frases_og: prepareOGPhrases(emojiInjected.og_phrases_es),
    frases_og_en: prepareOGPhrases(emojiInjected.og_phrases_en),
    colores: palette.palette,
    textColors: palette.palette.map(textContrastOn),
    fondo: palette.paper,

    tarjeta: { ...tarjetaES, style },
    tarjeta_base: { ...tarjetaES, style },
    tarjeta_presentacion: { ...tarjetaES, style },
    tarjeta_en: { ...tarjetaEN, style },
    tarjeta_base_en: { ...tarjetaEN, style },
    tarjeta_presentacion_en: { ...tarjetaEN, style },

    videoUrl: `https://duckduckgo.com/?q=!ducky+site:youtube.com+${encodeURIComponent(`${book.titulo} ${autorFinal} entrevista español`)}`,
    videoUrl_en: `https://duckduckgo.com/?q=!ducky+site:youtube.com+${encodeURIComponent(`${anchorsData.book_identity.titulo_en} ${autorFinal} interview`)}`,

    _nucleus: {
      book_identity: anchorsData.book_identity,
      book_grounding_anchors: anchorsData.book_grounding_anchors,
      lens_analysis: anchorsData.lens_analysis,
      visual_intent: anchorsData.visual_intent,
      surface_hints: anchorsData.surface_hints,
      card_es: contentES.card_es,
      card_en: contentEN.card_en,
      emotional_words_es: contentES.emotional_words_es,
      emotional_words_en: contentEN.emotional_words_en,
      og_phrases_es: emojiInjected.og_phrases_es,
      og_phrases_en: emojiInjected.og_phrases_en,
      edition_blocks_es: emojiInjected.edition_blocks_es,
      edition_blocks_en: emojiInjected.edition_blocks_en,
      confidence
    },

    _grounding: {
      source: groundTruthMeta.grounding_source,
      tier_reached: groundTruthMeta.tier_reached,
      book_identity_confidence: groundTruthMeta.book_identity_confidence,
      resolution_path: groundTruthMeta.resolution_path,
      verified_identity: groundTruthMeta.verified_identity,
      similar_books: groundTruthMeta.similar_books,
      match_score: groundTruthMeta.match_score,
      from_cache: Boolean(groundTruthMeta.from_cache),
      warning: groundTruthMeta.warning
    },

    _grounding_judge: {
      es: groundingJudgeES,
      en: groundingJudgeEN
    },

    _voice_verdict: voiceVerdict,

    _visual: {
      synthesis_inputs: palette.synthesis_inputs,
      contrast_ratio: palette.contrast_ratio,
      paper_is_dark: palette.paper_is_dark,
      cssVars: tarjetaVisualStub.cssVars
    },

    _edition_meta: {
      gesture_types_es: gestureTypesES,
      gesture_types_en: gestureTypesEN,
      distinct_types_es: new Set(gestureTypesES).size,
      distinct_types_en: new Set(gestureTypesEN).size
    },

    _quality_warning: qualityWarning,
    _inputs_snapshot: inputsSnapshot,
    _crono: crono,

    _metrics: {
      tokens_total: runMeta.totalTokens,
      tokens_by_phase: runMeta.tokensByPhase,
      elapsed_ms_total: runMeta.totalElapsedMs,
      elapsed_ms_by_phase: runMeta.elapsedByPhase,
      llm_calls_count: runMeta.llmCallsCount,
      models_used: runMeta.modelsUsed,
      pipeline_version: "nucleus-canonical-v3"
    }
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   CSS VARS — derivadas de palette y visual_intent para compat con renderer
────────────────────────────────────────────────────────────────────────────── */

function buildCssVars(palette, visualIntent) {
  const density = densityToMultipliers(visualIntent.density);
  const rhythm = rhythmToMultipliers(visualIntent.rhythm);
  const typographyStack = typographyFamilyToStack(visualIntent.typography_family);

  const highlightBg = palette.paper_is_dark ? palette.accent : darken(palette.accent, 0.12);
  const highlightInk = palette.paper_is_dark ? palette.paper : "#FFFFFF";

  const genreRadiusMap = {
    academico: 4, literario: 10, manifiesto: 2, poesia: 16,
    narrativa: 12, ensayo: 8, tecnico: 4, espiritual: 18
  };
  const cardRadius = genreRadiusMap[visualIntent.genre_visual] ?? 12;

  return {
    "--palette-0": palette.palette[0],
    "--palette-1": palette.palette[1],
    "--palette-2": palette.palette[2],
    "--palette-3": palette.palette[3],
    "--accent": palette.accent,
    "--accent-soft": withAlpha(palette.accent, 0.22),
    "--accent-glow": withAlpha(palette.accent, 0.42),
    "--paper": palette.paper,
    "--ink": palette.ink,
    "--border": palette.border,
    "--highlight-bg": withAlpha(highlightBg, 0.85),
    "--highlight-ink": highlightInk,
    "--typography-stack": typographyStack,
    "--line-height": density.lineHeight,
    "--letter-spacing": density.letterSpacing,
    "--paragraph-gap": density.paragraphGap,
    "--font-size-scale": rhythm.fontSizeScale,
    "--word-spacing-scale": rhythm.wordSpacingScale,
    "--card-radius": `${cardRadius}px`,
    "--highlight-radius": "5px"
  };
}
