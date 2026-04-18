/* ═══════════════════════════════════════════════════════════════════════════════
   render-tarjeta.js — COMPILADORES DETERMINISTAS ES + EN

   Input: EditionNucleus válido
   Output: { titulo, parrafoTop, subtitulo, parrafoBot, style }

   Cero IA. Cero probabilidad. Función pura.
   Mismo nucleus → misma tarjeta, siempre.
═══════════════════════════════════════════════════════════════════════════════ */

import {
  luminance,
  darken,
  lighten,
  sanitizeTitleText,
  sanitizeSubtitleText,
  normalizeSentence
} from "./triggui-quality-engine.js";

/* ─────────────────────────────────────────────────────────────────────────────
   TÍTULO — derivado del libro + verbo del micro_action
────────────────────────────────────────────────────────────────────────────── */

function deriveTitulo(nucleus, lang = "es") {
  const { book_identity, micro_action } = nucleus;
  const verbo = lang === "en" ? micro_action.verb_en : micro_action.verb_es;
  const titulo = lang === "en" ? book_identity.titulo_en : book_identity.titulo_es;

  const capitalVerbo = verbo.charAt(0).toUpperCase() + verbo.slice(1).toLowerCase();
  const separador = lang === "en" ? "after" : "tras";

  return sanitizeTitleText(`${capitalVerbo} ${separador} "${titulo}"`);
}

/* ─────────────────────────────────────────────────────────────────────────────
   PÁRRAFO SUPERIOR — verdad + seed como highlight
────────────────────────────────────────────────────────────────────────────── */

function buildParrafoTop(nucleus, lang = "es") {
  const truth = lang === "en" ? nucleus.truth.en : nucleus.truth.es;
  const seed = lang === "en" ? nucleus.highlight_seeds.top_en : nucleus.highlight_seeds.top_es;

  const truthClean = truth.trim().replace(/[.!?]+$/, "");
  const seedClean = seed.trim().replace(/[.!?]+$/, "");

  // La verdad va primero como contexto; el seed va como highlight al final.
  return `${truthClean}. [H]${seedClean}[/H].`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   SUBTÍTULO — derivado de tension como pregunta sobria
────────────────────────────────────────────────────────────────────────────── */

function buildSubtitulo(nucleus, lang = "es") {
  const tension = lang === "en" ? nucleus.tension.en : nucleus.tension.es;
  const t = tension.trim().replace(/[.!?…]+$/, "");

  if (lang === "en") {
    if (/\?$/.test(t)) return sanitizeSubtitleText(t, "en");
    return sanitizeSubtitleText(`What changes when you stop ${t.toLowerCase().replace(/^(the act of |el acto de )/, "")}?`, "en");
  }

  if (t.startsWith("¿")) {
    return sanitizeSubtitleText(t.endsWith("?") ? t : `${t}?`, "es");
  }
  return sanitizeSubtitleText(`¿Qué cambia cuando dejas de ${t.toLowerCase()}?`, "es");
}

/* ─────────────────────────────────────────────────────────────────────────────
   PÁRRAFO INFERIOR — micro_action con tiempo explícito + seed bottom
────────────────────────────────────────────────────────────────────────────── */

function buildParrafoBot(nucleus, lang = "es") {
  const { seconds, instruction_es, instruction_en } = nucleus.micro_action;
  const instruction = lang === "en" ? instruction_en : instruction_es;
  const seedBot = lang === "en" ? nucleus.highlight_seeds.bottom_en : nucleus.highlight_seeds.bottom_es;

  const instructClean = instruction.trim().replace(/[.!?]+$/, "");
  const seedClean = seedBot.trim().replace(/[.!?]+$/, "");

  if (lang === "en") {
    return `Take ${seconds} seconds now: ${instructClean}. [H]${seedClean}[/H].`;
  }
  return `Toma ${seconds} segundos ahora: ${instructClean}. [H]${seedClean}[/H].`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   STYLE — desde visual_tokens con garantías deterministas
────────────────────────────────────────────────────────────────────────────── */

function buildStyle(nucleus) {
  const { accent, paper, ink } = nucleus.visual_tokens;

  // Garantía: paper oscuro real. Si el modelo falló aunque el schema lo pida, forzamos.
  const paperFinal = luminance(paper) < 0.35 ? paper : "#0a0a0a";
  const inkFinal = luminance(ink) > 0.65 ? ink : "#ffffff";

  const paperLum = luminance(paperFinal);
  const border = paperLum < 0.08
    ? lighten(paperFinal, 0.18)
    : darken(paperFinal, 0.35);

  return { accent, paper: paperFinal, ink: inkFinal, border };
}

/* ─────────────────────────────────────────────────────────────────────────────
   RENDERERS PÚBLICOS
────────────────────────────────────────────────────────────────────────────── */

export function renderTarjetaES(nucleus) {
  if (!nucleus?.book_identity?.titulo_es) {
    throw new Error("Nucleus inválido: falta book_identity.titulo_es");
  }
  return {
    titulo: deriveTitulo(nucleus, "es"),
    parrafoTop: buildParrafoTop(nucleus, "es"),
    subtitulo: buildSubtitulo(nucleus, "es"),
    parrafoBot: buildParrafoBot(nucleus, "es"),
    style: buildStyle(nucleus)
  };
}

export function renderTarjetaEN(nucleus) {
  if (!nucleus?.book_identity?.titulo_en) {
    throw new Error("Nucleus inválido: falta book_identity.titulo_en");
  }
  return {
    titulo: deriveTitulo(nucleus, "en"),
    parrafoTop: buildParrafoTop(nucleus, "en"),
    subtitulo: buildSubtitulo(nucleus, "en"),
    parrafoBot: buildParrafoBot(nucleus, "en"),
    style: buildStyle(nucleus)
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   RENDERER DE SUPERFICIE EXTRA: OG preview (demuestra extensibilidad)
────────────────────────────────────────────────────────────────────────────── */

export function renderOGTitle(nucleus, lang = "es") {
  const title = lang === "en" ? nucleus.book_identity.titulo_en : nucleus.book_identity.titulo_es;
  const seed = lang === "en" ? nucleus.highlight_seeds.top_en : nucleus.highlight_seeds.top_es;
  return `${title} — ${seed}`;
}

export function renderWhatsAppCopy(nucleus, lang = "es") {
  const { seconds, instruction_es, instruction_en } = nucleus.micro_action;
  const instruction = lang === "en" ? instruction_en : instruction_es;
  if (lang === "en") {
    return `📖 ${nucleus.book_identity.titulo_en}\n\n⏱ ${seconds} sec: ${instruction}`;
  }
  return `📖 ${nucleus.book_identity.titulo_es}\n\n⏱ ${seconds} seg: ${instruction}`;
}
