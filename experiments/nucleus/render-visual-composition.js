/* ═══════════════════════════════════════════════════════════════════════════════
   render-visual-composition.js — COMPOSICIÓN VISUAL DETERMINISTA
═══════════════════════════════════════════════════════════════════════════════ */

import {
  luminance,
  contrastRatio,
  withAlpha,
  ensureReadableContrast,
  deriveBorder,
  isValidHex,
  normalizeHex,
  textContrastOn,
  densityToMultipliers,
  rhythmToMultipliers,
  typographyFamilyToStack
} from "./triggui-physics.js";

export function composeVisual(visualSignature = {}) {
  // Normalizar hex: el modelo puede devolver #RGB, #RGBA, #RRGGBB o #RRGGBBAA
  // Nosotros canonizamos a #RRGGBB siempre.
  let palette = Array.isArray(visualSignature.palette) && visualSignature.palette.length === 4
    ? visualSignature.palette.map((c) => normalizeHex(c) || "#888888")
    : ["#888888", "#AAAAAA", "#CCCCCC", "#EEEEEE"];

  let accent = normalizeHex(visualSignature.accent) || palette[0];
  let paper = normalizeHex(visualSignature.paper) || "#FFFFFF";
  let ink = normalizeHex(visualSignature.ink) || "#1A1A1A";

  const readable = ensureReadableContrast(paper, ink);
  paper = readable.paper;
  ink = readable.ink;

  const border = deriveBorder(paper);
  const typographyStack = typographyFamilyToStack(visualSignature.typography_family);
  const densityMult = densityToMultipliers(visualSignature.density || "equilibrado");
  const rhythmMult = rhythmToMultipliers(visualSignature.rhythm || "medio");

  const radiusByGenre = {
    academico: 8,
    literario: 20,
    manifiesto: 4,
    poesia: 32,
    narrativa: 24,
    ensayo: 16,
    tecnico: 6,
    espiritual: 28
  };
  const cardRadius = radiusByGenre[visualSignature.genre_visual] || 20;
  const highlightRadius = Math.max(4, Math.round(cardRadius * 0.3));

  const highlightBg = withAlpha(accent, 0.85);
  const highlightInk = textContrastOn(accent);
  const accentSoft = withAlpha(accent, 0.22);
  const accentGlow = withAlpha(accent, 0.42);

  const decisions = {
    contrast_ratio: contrastRatio(ink, paper).toFixed(2),
    paper_luminance: luminance(paper).toFixed(3),
    ink_luminance: luminance(ink).toFixed(3),
    paper_is_dark: luminance(paper) < 0.35,
    genre_radius: cardRadius
  };

  return {
    palette,
    accent,
    paper,
    ink,
    border,
    fondo: paper,
    highlightBg,
    highlightInk,
    accentSoft,
    accentGlow,
    typographyStack,
    fontSizeScale: rhythmMult.fontSizeScale,
    wordSpacingScale: rhythmMult.wordSpacingScale,
    lineHeight: densityMult.lineHeight,
    letterSpacing: densityMult.letterSpacing,
    paragraphGap: densityMult.paragraphGap,
    cardRadius,
    highlightRadius,
    cssVars: {
      "--palette-0": palette[0],
      "--palette-1": palette[1],
      "--palette-2": palette[2],
      "--palette-3": palette[3],
      "--accent": accent,
      "--accent-soft": accentSoft,
      "--accent-glow": accentGlow,
      "--paper": paper,
      "--ink": ink,
      "--border": border,
      "--highlight-bg": highlightBg,
      "--highlight-ink": highlightInk,
      "--typography-stack": typographyStack,
      "--line-height": densityMult.lineHeight,
      "--letter-spacing": `${densityMult.letterSpacing}px`,
      "--paragraph-gap": densityMult.paragraphGap,
      "--font-size-scale": rhythmMult.fontSizeScale,
      "--word-spacing-scale": rhythmMult.wordSpacingScale,
      "--card-radius": `${cardRadius}px`,
      "--highlight-radius": `${highlightRadius}px`
    },
    decisions,
    signature: {
      typography_family: visualSignature.typography_family,
      density: visualSignature.density,
      temperature: visualSignature.temperature,
      rhythm: visualSignature.rhythm,
      era: visualSignature.era,
      genre_visual: visualSignature.genre_visual
    }
  };
}
