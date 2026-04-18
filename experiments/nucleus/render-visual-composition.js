/* ═══════════════════════════════════════════════════════════════════════════════
   render-visual-composition.js — COMPOSICIÓN VISUAL DETERMINISTA

   CERO HARDCODING DE INTENCIONES DEL USUARIO.

   Las intenciones visuales (modo oscuro, esquinas, temperatura, etc.) las
   interpreta el LLM directamente en el extractor y se reflejan en la
   visual_signature del nucleus. Aquí solo hacemos matemática.

   Input:  visual_signature del nucleus (ya integra las intenciones del usuario)
   Output: conjunto completo de CSS custom properties determinista
═══════════════════════════════════════════════════════════════════════════════ */

import {
  luminance,
  contrastRatio,
  darken,
  lighten,
  withAlpha,
  ensureReadableContrast,
  deriveBorder,
  isValidHex,
  textContrastOn,
  densityToMultipliers,
  rhythmToMultipliers,
  typographyFamilyToStack
} from "./triggui-physics.js";

/**
 * Compone CSS custom properties desde la visual_signature del nucleus.
 * Garantías:
 *   - Mismo nucleus → misma composición (determinista)
 *   - Contraste WCAG AA siempre (paper vs ink)
 *   - Libros distintos → firmas distintas (emergente)
 */
export function composeVisual(visualSignature) {
  const sig = visualSignature || {};

  // 1. PALETA
  let palette = Array.isArray(sig.palette) && sig.palette.length === 4
    ? sig.palette.map((c) => (isValidHex(c) ? c : "#888888"))
    : ["#888888", "#aaaaaa", "#cccccc", "#eeeeee"];

  let accent = isValidHex(sig.accent) ? sig.accent : palette[0];
  let paper = isValidHex(sig.paper) ? sig.paper : "#FFFFFF";
  let ink = isValidHex(sig.ink) ? sig.ink : "#1A1A1A";

  // 2. GARANTÍA FÍSICA: contraste legible
  const readable = ensureReadableContrast(paper, ink);
  paper = readable.paper;
  ink = readable.ink;

  // 3. Border matemático
  const border = deriveBorder(paper);

  // 4. Tipografía desde firma
  const typographyStack = typographyFamilyToStack(sig.typography_family);
  const densityMult = densityToMultipliers(sig.density || "equilibrado");
  const rhythmMult = rhythmToMultipliers(sig.rhythm || "medio");

  // 5. Radios: derivados del género visual (emergente)
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
  const cardRadius = radiusByGenre[sig.genre_visual] || 20;
  const highlightRadius = Math.max(4, Math.round(cardRadius * 0.3));

  // 6. Highlight bg+ink con contraste físico garantizado
  const highlightBg = withAlpha(accent, 0.85);
  const highlightInk = textContrastOn(accent);

  // 7. Overlays OG
  const accentSoft = withAlpha(accent, 0.22);
  const accentGlow = withAlpha(accent, 0.42);

  // 8. Metadata de decisiones
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
      typography_family: sig.typography_family,
      density: sig.density,
      temperature: sig.temperature,
      rhythm: sig.rhythm,
      era: sig.era,
      genre_visual: sig.genre_visual
    }
  };
}

export function cssVarsToInlineStyle(cssVars) {
  return Object.entries(cssVars).map(([k, v]) => `${k}: ${v}`).join("; ");
}
