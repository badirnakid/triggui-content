/* ═══════════════════════════════════════════════════════════════════════════════
   render-tarjeta.js — RENDERER HONESTO

   El LLM ya extrajo los 4 campos (titulo, parrafoTop, subtitulo, parrafoBot)
   en la voz del libro. Este módulo NO los envuelve, NO añade "toma X segundos",
   NO añade "después de", NO añade ninguna narración.

   Lo único que hace:
   1. Aplica [H]...[/H] en el fragmento más denso (matemático, no editorial)
   2. Ensambla el objeto en formato compatible con build-tarjeta-png.js,
      build-og-image.js y build-editions.py
═══════════════════════════════════════════════════════════════════════════════ */

import {
  placeHighlightOnDensestSpan,
  normalizeHighlightSyntax,
  countHighlights
} from "./triggui-physics.js";

/**
 * Aplica highlights a un campo solo si no los tiene ya.
 * El LLM puede producir [H][/H] naturalmente; si lo hace, respetamos.
 * Si no, colocamos uno matemáticamente en el span más denso.
 */
function ensureHighlight(text) {
  const normalized = normalizeHighlightSyntax(text || "");
  if (!normalized) return "";
  if (countHighlights(normalized) > 0) return normalized;
  return placeHighlightOnDensestSpan(normalized);
}

/**
 * Renderer de tarjeta ES.
 * @param {object} cardES - nucleus.card_es
 * @param {object} visualComposition - salida de composeVisual()
 * @returns {object} tarjeta compatible con build-tarjeta-png.js
 */
export function renderTarjetaES(cardES, visualComposition) {
  if (!cardES) throw new Error("cardES requerido");

  const style = {
    accent: visualComposition.accent,
    paper: visualComposition.paper,
    ink: visualComposition.ink,
    border: visualComposition.border
  };

  return {
    titulo: String(cardES.titulo || "").trim(),
    parrafoTop: ensureHighlight(cardES.parrafoTop),
    subtitulo: String(cardES.subtitulo || "").trim(),
    parrafoBot: ensureHighlight(cardES.parrafoBot),
    style
  };
}

/**
 * Renderer de tarjeta EN.
 */
export function renderTarjetaEN(cardEN, visualComposition) {
  if (!cardEN) throw new Error("cardEN requerido");

  const style = {
    accent: visualComposition.accent,
    paper: visualComposition.paper,
    ink: visualComposition.ink,
    border: visualComposition.border
  };

  return {
    titulo: String(cardEN.titulo || "").trim(),
    parrafoTop: ensureHighlight(cardEN.parrafoTop),
    subtitulo: String(cardEN.subtitulo || "").trim(),
    parrafoBot: ensureHighlight(cardEN.parrafoBot),
    style
  };
}

/**
 * Renderer OG: el pipeline visual existente elige la mejor frase desde key_phrases.
 * Este helper solo garantiza que las frases lleguen limpias.
 */
export function prepareOGPhrases(keyPhrases) {
  if (!Array.isArray(keyPhrases)) return [];
  return keyPhrases
    .map((p) => String(p || "").trim())
    .filter(Boolean);
}

/**
 * Renderer de Edición Viva: prepara el bloque de texto largo que consume
 * build-editions.py. Combina los 4 campos como lectura lineal.
 */
export function prepareEditionText(card) {
  const parts = [
    card.titulo,
    card.parrafoTop,
    card.subtitulo,
    card.parrafoBot
  ].filter(Boolean).map((p) => String(p).trim());
  return parts.join("\n\n");
}
