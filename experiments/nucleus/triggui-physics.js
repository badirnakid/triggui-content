/* ═══════════════════════════════════════════════════════════════════════════════
   triggui-physics.js — MATEMÁTICA PURA

   Este módulo NO juzga contenido editorial.
   Solo hace matemática: luminancia WCAG, contraste, coerción hex, derivaciones.

   Si el libro dice "reflexiona", este módulo no tiene opinión.
   Si el libro dice "dream big", tampoco.

   La única "inteligencia" aquí es física: cómo se ven los colores, qué
   contrasta con qué, cómo convertir una paleta en variaciones armoniosas.
═══════════════════════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────────────────────
   LUMINANCIA Y CONTRASTE (WCAG 2.1)
────────────────────────────────────────────────────────────────────────────── */

export function luminance(hex) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(String(hex || "")) ? String(hex) : "#000000";
  const [r, g, b] = safe.slice(1).match(/../g).map((x) => parseInt(x, 16) / 255);
  const f = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(fg, bg) {
  const lumFg = luminance(fg);
  const lumBg = luminance(bg);
  const lighter = Math.max(lumFg, lumBg);
  const darker = Math.min(lumFg, lumBg);
  return (lighter + 0.05) / (darker + 0.05);
}

/* ─────────────────────────────────────────────────────────────────────────────
   TRANSFORMACIONES DE COLOR
────────────────────────────────────────────────────────────────────────────── */

function hexToRGB(hex) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(String(hex || "")) ? String(hex) : "#000000";
  return safe.slice(1).match(/../g).map((x) => parseInt(x, 16));
}

function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function darken(hex, pct = 0.3) {
  const [r, g, b] = hexToRGB(hex);
  return rgbToHex(r * (1 - pct), g * (1 - pct), b * (1 - pct));
}

export function lighten(hex, pct = 0.3) {
  const [r, g, b] = hexToRGB(hex);
  return rgbToHex(r + (255 - r) * pct, g + (255 - g) * pct, b + (255 - b) * pct);
}

export function withAlpha(hex, alpha = 0.24) {
  const [r, g, b] = hexToRGB(hex);
  const a = Math.max(0, Math.min(1, alpha));
  const alphaHex = Math.round(a * 255).toString(16).padStart(2, "0");
  return `${rgbToHex(r, g, b)}${alphaHex}`;
}

export function invertLuminance(hex) {
  const [r, g, b] = hexToRGB(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const newL = 255 - l;
  const shift = newL - l;
  return rgbToHex(r + shift, g + shift, b + shift);
}

/* ─────────────────────────────────────────────────────────────────────────────
   VALIDACIÓN FÍSICA (no editorial)
────────────────────────────────────────────────────────────────────────────── */

export function isValidHex(hex) {
  return /^#[0-9a-fA-F]{6}$/.test(String(hex || ""));
}

export function isDarkColor(hex, threshold = 0.35) {
  return luminance(hex) < threshold;
}

export function isLightColor(hex, threshold = 0.65) {
  return luminance(hex) > threshold;
}

/**
 * Garantiza que paper e ink tengan contraste WCAG AA (mínimo 4.5:1 para texto normal).
 * Si no lo tienen, ajusta ink hacia negro o blanco según corresponda.
 */
export function ensureReadableContrast(paper, ink) {
  const ratio = contrastRatio(ink, paper);
  if (ratio >= 4.5) return { paper, ink, ratio };

  const paperIsDark = isDarkColor(paper);
  const newInk = paperIsDark ? "#FFFFFF" : "#0A0A0A";
  return { paper, ink: newInk, ratio: contrastRatio(newInk, paper) };
}

/**
 * Deriva un color de borde coherente con paper:
 * - Si paper es muy oscuro (<0.08), ilumina paper 15%
 * - Si no, oscurece paper 35%
 */
export function deriveBorder(paper) {
  if (!isValidHex(paper)) return "#333333";
  return luminance(paper) < 0.08 ? lighten(paper, 0.18) : darken(paper, 0.4);
}

/* ─────────────────────────────────────────────────────────────────────────────
   MODOS DE INVERSIÓN (para light/dark mode del config)

   Estos NO son decisiones estéticas. Son transformaciones matemáticas
   deterministas que preservan la paleta del libro pero invierten su luminancia.
────────────────────────────────────────────────────────────────────────────── */

/**
 * Convierte una paleta a modo oscuro manteniendo los tonos (hue) pero
 * invirtiendo luminancia. El resultado sigue siendo "el libro", solo a las 3 AM.
 */
export function paletteToDarkMode(palette, paper, ink) {
  const darkPaper = isDarkColor(paper) ? paper : "#0a0a0a";
  const lightInk = isLightColor(ink) ? ink : "#f5f5f5";
  return {
    palette: palette.map((c) => (isValidHex(c) ? c : "#888888")),
    paper: darkPaper,
    ink: lightInk
  };
}

/**
 * Convierte una paleta a modo claro manteniendo tonos pero subiendo luminancia.
 */
export function paletteToLightMode(palette, paper, ink) {
  const lightPaper = isLightColor(paper) ? paper : "#fafafa";
  const darkInk = isDarkColor(ink) ? ink : "#1a1a1a";
  return {
    palette: palette.map((c) => (isValidHex(c) ? c : "#888888")),
    paper: lightPaper,
    ink: darkInk
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   UTILIDADES DE TEXTO (matemáticas, no editoriales)
────────────────────────────────────────────────────────────────────────────── */

export function textContrastOn(hex) {
  return luminance(hex) > 0.45 ? "#000000" : "#FFFFFF";
}

export function normalizeHighlightSyntax(input) {
  let text = String(input || "");
  if (!text.trim()) return "";
  text = text.replace(/\{\{H\}\}/gi, "[H]").replace(/\{\{\/H\}\}/gi, "[/H]");
  text = text.replace(/\[h\]/g, "[H]").replace(/\[\/h\]/g, "[/H]");

  let toggleOpen = true;
  text = text.replace(/\[H\]/g, () => {
    const token = toggleOpen ? "[H]" : "[/H]";
    toggleOpen = !toggleOpen;
    return token;
  });

  const opens = (text.match(/\[H\]/g) || []).length;
  const closes = (text.match(/\[\/H\]/g) || []).length;
  if (opens > closes) text += "[/H]".repeat(opens - closes);

  text = text.replace(/\[H\]\s*\[\/H\]/g, "");
  return text.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function countHighlights(text) {
  const matches = normalizeHighlightSyntax(text).match(/\[H\](.*?)\[\/H\]/gis) || [];
  return matches.filter((m) => m.replace(/\[H\]|\[\/H\]/gi, "").trim()).length;
}

export function stripHighlightTags(text) {
  return normalizeHighlightSyntax(String(text || "")).replace(/\[H\]|\[\/H\]/gi, "");
}

/**
 * Coloca un [H]...[/H] en el fragmento más denso de un texto.
 * "Denso" es matemático: sustantivos + verbos fuertes + longitud entre 5-14 palabras.
 * NO es criterio editorial. Es busca de la frase con más carga informacional.
 */
export function placeHighlightOnDensestSpan(text) {
  const plain = stripHighlightTags(text).replace(/\s+/g, " ").trim();
  if (!plain) return text;

  // Si ya tiene highlights, respeta
  if (countHighlights(text) > 0) return normalizeHighlightSyntax(text);

  // Divide en oraciones
  const sentences = plain.split(/(?<=[\.\!\?])\s+/).filter(Boolean);
  if (sentences.length === 0) return text;

  // Scoring matemático: palabras en el rango 5-14, densidad de palabras >=4 chars
  const scored = sentences.map((s) => {
    const words = s.split(/\s+/).filter(Boolean);
    const denseWords = words.filter((w) => w.length >= 4).length;
    const densityRatio = words.length ? denseWords / words.length : 0;
    let score = densityRatio * 10;
    if (words.length >= 5 && words.length <= 14) score += 10;
    if (words.length < 4) score -= 10;
    if (words.length > 20) score -= 5;
    return { sentence: s.trim(), score, words: words.length };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.words < 3) {
    // Fallback: primer tercio del texto
    const portion = Math.min(plain.length, Math.max(30, Math.floor(plain.length * 0.35)));
    return `[H]${plain.slice(0, portion).trim()}[/H]${plain.slice(portion)}`;
  }

  // Si la frase es larga, recorta a 5-12 palabras centrales
  let target = best.sentence;
  const words = target.split(/\s+/);
  if (words.length > 12) {
    target = words.slice(0, 10).join(" ").replace(/[,:;]+$/g, "");
  }

  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped);
  if (re.test(plain)) return plain.replace(re, `[H]${target}[/H]`);
  return `[H]${target}[/H] ${plain}`.trim();
}

/* ─────────────────────────────────────────────────────────────────────────────
   DENSIDAD TIPOGRÁFICA (transformación matemática)

   Mapea enum density del schema a multiplicadores numéricos deterministas.
────────────────────────────────────────────────────────────────────────────── */

export function densityToMultipliers(density) {
  const map = {
    aireado:     { lineHeight: 1.85, letterSpacing: 0.4, paragraphGap: 1.4 },
    equilibrado: { lineHeight: 1.65, letterSpacing: 0.2, paragraphGap: 1.0 },
    denso:       { lineHeight: 1.45, letterSpacing: 0.0, paragraphGap: 0.7 }
  };
  return map[density] || map.equilibrado;
}

export function rhythmToMultipliers(rhythm) {
  const map = {
    lento:    { fontSizeScale: 1.04, wordSpacingScale: 1.05 },
    medio:    { fontSizeScale: 1.00, wordSpacingScale: 1.00 },
    rapido:   { fontSizeScale: 0.97, wordSpacingScale: 0.96 },
    staccato: { fontSizeScale: 0.94, wordSpacingScale: 0.92 }
  };
  return map[rhythm] || map.medio;
}

export function typographyFamilyToStack(family) {
  const stacks = {
    serif_clasico:    `'EB Garamond', 'Garamond', Georgia, serif`,
    serif_literario:  `'Crimson Pro', 'Source Serif Pro', Georgia, serif`,
    serif_moderno:    `'Source Serif Pro', 'Georgia', serif`,
    sans_geometrico:  `'Inter', 'Helvetica Neue', Arial, sans-serif`,
    sans_humanista:   `'Work Sans', 'Open Sans', 'Segoe UI', sans-serif`,
    sans_tecnologico: `'IBM Plex Sans', 'Inter', sans-serif`,
    mono_precision:   `'JetBrains Mono', 'IBM Plex Mono', Consolas, monospace`,
    mixta_editorial:  `'Lora', Georgia, serif`
  };
  return stacks[family] || stacks.sans_humanista;
}
