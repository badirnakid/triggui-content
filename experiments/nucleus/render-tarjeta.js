/* ═══════════════════════════════════════════════════════════════════════════════
   render-tarjeta.js — RENDERERS DETERMINISTAS
═══════════════════════════════════════════════════════════════════════════════ */

import {
  placeHighlightOnDensestSpan,
  normalizeHighlightSyntax,
  countHighlights
} from "./triggui-physics.js";

function ensureHighlight(text) {
  const normalized = normalizeHighlightSyntax(text || "");
  if (!normalized) return "";
  if (countHighlights(normalized) > 0) return normalized;
  return placeHighlightOnDensestSpan(normalized);
}

export function renderTarjetaES(cardES, visualComposition) {
  if (!cardES) throw new Error("cardES requerido");
  if (!visualComposition) throw new Error("visualComposition requerido");
  return {
    titulo: String(cardES.titulo || "").trim(),
    parrafoTop: ensureHighlight(cardES.parrafoTop),
    subtitulo: String(cardES.subtitulo || "").trim(),
    parrafoBot: ensureHighlight(cardES.parrafoBot),
    style: {
      accent: visualComposition.accent,
      paper: visualComposition.paper,
      ink: visualComposition.ink,
      border: visualComposition.border
    }
  };
}

export function renderTarjetaEN(cardEN, visualComposition) {
  if (!cardEN) throw new Error("cardEN requerido");
  if (!visualComposition) throw new Error("visualComposition requerido");
  return {
    titulo: String(cardEN.titulo || "").trim(),
    parrafoTop: ensureHighlight(cardEN.parrafoTop),
    subtitulo: String(cardEN.subtitulo || "").trim(),
    parrafoBot: ensureHighlight(cardEN.parrafoBot),
    style: {
      accent: visualComposition.accent,
      paper: visualComposition.paper,
      ink: visualComposition.ink,
      border: visualComposition.border
    }
  };
}

export function prepareOGPhrases(phrases) {
  if (!Array.isArray(phrases)) return [];
  return phrases.map((p) => String(p || "").trim()).filter(Boolean);
}

export function prepareEditionPhrases(blocks) {
  if (!Array.isArray(blocks)) return [];
  return blocks.map((b) => String(b?.phrase || "").trim()).filter(Boolean);
}

export function prepareEditionText(card) {
  const parts = [card.titulo, card.parrafoTop, card.subtitulo, card.parrafoBot]
    .filter(Boolean)
    .map((p) => String(p).trim());
  return parts.join("\n\n");
}
