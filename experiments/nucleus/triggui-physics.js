/* ═══════════════════════════════════════════════════════════════════════════════
   triggui-physics.js — MATEMÁTICA PURA
═══════════════════════════════════════════════════════════════════════════════ */

export function isValidHex(hex) {
  return /^#[0-9a-fA-F]{6}$/.test(String(hex || ""));
}

export function luminance(hex) {
  const safe = isValidHex(hex) ? String(hex) : "#000000";
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

function hexToRGB(hex) {
  const safe = isValidHex(hex) ? String(hex) : "#000000";
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

export function isDarkColor(hex, threshold = 0.35) {
  return luminance(hex) < threshold;
}

export function isLightColor(hex, threshold = 0.65) {
  return luminance(hex) > threshold;
}

export function ensureReadableContrast(paper, ink) {
  const ratio = contrastRatio(ink, paper);
  if (ratio >= 4.5) return { paper, ink, ratio };
  const newInk = isDarkColor(paper) ? "#FFFFFF" : "#0A0A0A";
  return { paper, ink: newInk, ratio: contrastRatio(newInk, paper) };
}

export function deriveBorder(paper) {
  if (!isValidHex(paper)) return "#333333";
  return luminance(paper) < 0.08 ? lighten(paper, 0.18) : darken(paper, 0.4);
}

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

export function getHighlightSegments(text = "") {
  const matches = normalizeHighlightSyntax(text).match(/\[H\](.*?)\[\/H\]/gis) || [];
  return matches.map((m) => m.replace(/\[H\]|\[\/H\]/gi, "").trim()).filter(Boolean);
}

export function highlightCoverageRatio(text = "") {
  const plain = stripHighlightTags(text).replace(/\s+/g, " ").trim();
  if (!plain) return 0;
  const highlighted = getHighlightSegments(text).join(" ").replace(/\s+/g, " ").trim();
  return highlighted ? highlighted.length / Math.max(plain.length, 1) : 0;
}

export function placeHighlightOnDensestSpan(text) {
  const plain = stripHighlightTags(text).replace(/\s+/g, " ").trim();
  if (!plain) return text;
  if (countHighlights(text) > 0) return normalizeHighlightSyntax(text);

  const sentences = plain.split(/(?<=[\.\!\?])\s+/).filter(Boolean);
  if (sentences.length === 0) return text;

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
    const portion = Math.min(plain.length, Math.max(30, Math.floor(plain.length * 0.35)));
    return `[H]${plain.slice(0, portion).trim()}[/H]${plain.slice(portion)}`;
  }

  let target = best.sentence;
  const words = target.split(/\s+/);
  if (words.length > 12) target = words.slice(0, 10).join(" ").replace(/[,:;]+$/g, "");
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped);
  if (re.test(plain)) return plain.replace(re, `[H]${target}[/H]`);
  return `[H]${target}[/H] ${plain}`.trim();
}

export function densityToMultipliers(density) {
  const map = {
    aireado: { lineHeight: 1.85, letterSpacing: 0.4, paragraphGap: 1.4 },
    equilibrado: { lineHeight: 1.65, letterSpacing: 0.2, paragraphGap: 1.0 },
    denso: { lineHeight: 1.45, letterSpacing: 0.0, paragraphGap: 0.7 }
  };
  return map[density] || map.equilibrado;
}

export function rhythmToMultipliers(rhythm) {
  const map = {
    lento: { fontSizeScale: 1.04, wordSpacingScale: 1.05 },
    medio: { fontSizeScale: 1.0, wordSpacingScale: 1.0 },
    rapido: { fontSizeScale: 0.97, wordSpacingScale: 0.96 },
    staccato: { fontSizeScale: 0.94, wordSpacingScale: 0.92 }
  };
  return map[rhythm] || map.medio;
}

export function typographyFamilyToStack(family) {
  const stacks = {
    serif_clasico: `'EB Garamond', 'Garamond', Georgia, serif`,
    serif_literario: `'Crimson Pro', 'Source Serif Pro', Georgia, serif`,
    serif_moderno: `'Source Serif Pro', Georgia, serif`,
    sans_geometrico: `'Inter', 'Helvetica Neue', Arial, sans-serif`,
    sans_humanista: `'Work Sans', 'Open Sans', 'Segoe UI', sans-serif`,
    sans_tecnologico: `'IBM Plex Sans', 'Inter', sans-serif`,
    mono_precision: `'JetBrains Mono', 'IBM Plex Mono', Consolas, monospace`,
    mixta_editorial: `'Lora', Georgia, serif`
  };
  return stacks[family] || stacks.sans_humanista;
}
