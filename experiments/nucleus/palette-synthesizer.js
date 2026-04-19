/* ═══════════════════════════════════════════════════════════════════════════════
   palette-synthesizer.js — MATEMÁTICA PURA DE COLOR

   El modelo devuelve intención visual NUMÉRICA, no hex:
     - hue_primary: 0-360 (círculo cromático completo)
     - saturation: "muted" | "balanced" | "vivid"
     - lightness_paper: "dark" | "medium_dark" | "medium_light" | "light"
     - temperature_shift: -30 a +30 (warm/cool offset)
     - palette_strategy: "monochromatic" | "analogous" | "complementary" | "triadic" | "split_complementary"

   Este módulo toma esos inputs y genera:
     - palette[4] hex (armónicos matemáticos)
     - accent hex (acento claro y vibrante)
     - paper hex (fondo con luminosidad acorde a lightness_paper)
     - ink hex (siempre con contraste WCAG AA >= 4.5:1 contra paper)

   Nunca puede fallar. El modelo literalmente no puede devolver "blanco" porque
   el campo es integer 0-360.
═══════════════════════════════════════════════════════════════════════════════ */

import { contrastRatio, ensureReadableContrast, deriveBorder } from "./triggui-physics.js";

/* ─────────────────────────────────────────────────────────────────────────────
   CONVERSIONES HSL ↔ HEX
────────────────────────────────────────────────────────────────────────────── */

function hslToHex(h, s, l) {
  const H = ((h % 360) + 360) % 360 / 360;
  const S = Math.max(0, Math.min(1, s));
  const L = Math.max(0, Math.min(1, l));

  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r; let g; let b;
  if (S === 0) { r = L; g = L; b = L; }
  else {
    const q = L < 0.5 ? L * (1 + S) : L + S - L * S;
    const p = 2 * L - q;
    r = hue2rgb(p, q, H + 1 / 3);
    g = hue2rgb(p, q, H);
    b = hue2rgb(p, q, H - 1 / 3);
  }

  const toHex = (v) => Math.round(Math.max(0, Math.min(255, v * 255))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAPEO DE ENUMS A NÚMEROS
────────────────────────────────────────────────────────────────────────────── */

const SATURATION_MAP = { muted: 0.30, balanced: 0.55, vivid: 0.80 };
const LIGHTNESS_PAPER_MAP = { dark: 0.12, medium_dark: 0.28, medium_light: 0.82, light: 0.94 };

function saturationFor(enumValue) {
  return SATURATION_MAP[enumValue] ?? 0.55;
}

function paperLightnessFor(enumValue) {
  return LIGHTNESS_PAPER_MAP[enumValue] ?? 0.92;
}

/* ─────────────────────────────────────────────────────────────────────────────
   ESTRATEGIAS DE PALETA
   Cada una genera 4 hues desde el hue_primary, respetando armonía cromática.
────────────────────────────────────────────────────────────────────────────── */

function strategyHues(hue, strategy) {
  const h = ((hue % 360) + 360) % 360;
  switch (strategy) {
    case "monochromatic":
      // 4 variaciones del mismo hue con pequeños desplazamientos (±5°)
      return [h, h, h, h];
    case "analogous":
      // 4 hues cercanos (±15°, ±30°)
      return [h - 30, h - 15, h + 15, h + 30];
    case "complementary":
      // Hue base + su complementario, dos tonos de cada uno
      return [h, h + 180, h + 15, h + 195];
    case "triadic":
      // 3 hues equidistantes (120° apart) + 1 extra cerca del primario
      return [h, h + 120, h + 240, h + 30];
    case "split_complementary":
      // Hue base + dos hues cerca del complementario (150°, 210°)
      return [h, h + 150, h + 210, h + 30];
    default:
      return [h, h + 20, h + 40, h + 60]; // analogous fallback
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   SÍNTESIS DE PALETA
────────────────────────────────────────────────────────────────────────────── */

export function synthesizePalette(visualIntent = {}) {
  const {
    hue_primary = 210,
    saturation = "balanced",
    lightness_paper = "light",
    temperature_shift = 0,
    palette_strategy = "analogous"
  } = visualIntent;

  // Aplicar temperature_shift al hue primario
  const adjustedHue = hue_primary + (typeof temperature_shift === "number" ? temperature_shift : 0);
  const sat = saturationFor(saturation);
  const paperL = paperLightnessFor(lightness_paper);

  // Generar 4 hues armónicos según estrategia
  const hues = strategyHues(adjustedHue, palette_strategy);

  // Lightness variable por cada color de la paleta — distribución armónica
  // Queremos 4 colores con contraste entre sí pero armónicos
  const paperIsDark = paperL < 0.5;
  const paletteLightnesses = paperIsDark
    ? [0.25, 0.40, 0.60, 0.78] // sobre fondo oscuro: paleta va de oscuro a claro
    : [0.72, 0.55, 0.38, 0.22]; // sobre fondo claro: paleta va de claro a oscuro

  const palette = hues.map((h, i) => hslToHex(h, sat, paletteLightnesses[i]));

  // Accent: hue primario con saturación máxima controlada, lightness media
  const accentSat = Math.min(0.85, sat + 0.2);
  const accentL = paperIsDark ? 0.62 : 0.48;
  const accent = hslToHex(adjustedHue, accentSat, accentL);

  // Paper: neutral con tinte sutil del hue para unidad visual
  const paperTintSat = 0.05;
  const paper = hslToHex(adjustedHue, paperTintSat, paperL);

  // Ink: opuesto luminoso a paper, con tinte del hue
  const inkL = paperIsDark ? 0.94 : 0.10;
  const inkTintSat = 0.08;
  let ink = hslToHex(adjustedHue, inkTintSat, inkL);

  // Garantía WCAG: asegurar contraste >= 4.5:1
  const readable = ensureReadableContrast(paper, ink);
  const finalPaper = readable.paper;
  const finalInk = readable.ink;
  const border = deriveBorder(finalPaper);

  return {
    palette,
    accent,
    paper: finalPaper,
    ink: finalInk,
    border,
    contrast_ratio: contrastRatio(finalInk, finalPaper).toFixed(2),
    paper_is_dark: paperIsDark,
    synthesis_inputs: {
      hue_primary,
      adjusted_hue: adjustedHue,
      saturation,
      saturation_value: sat,
      lightness_paper,
      paper_lightness_value: paperL,
      temperature_shift,
      palette_strategy
    }
  };
}
