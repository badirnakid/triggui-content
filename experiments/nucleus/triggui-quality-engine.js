/* ═══════════════════════════════════════════════════════════════════════════════
   triggui-quality-engine.js — EL MOAT REAL

   Extraído de v9.7.4 y preservado con su lógica original probada.
   Este módulo NO depende de OpenAI. NO hace llamadas externas.
   Es matemática, regex y lógica pura. Tu taste codificado.

   Si mañana sale GPT-5 o Claude 5, este archivo sigue siendo oro.
═══════════════════════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────────────────────
   LUMINANCE & CONTRAST (WCAG) — preservado de v9.7.4
────────────────────────────────────────────────────────────────────────────── */

export function luminance(hex) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(String(hex || "")) ? String(hex) : "#000000";
  const [r, g, b] = safe.slice(1).match(/../g).map((x) => parseInt(x, 16) / 255);
  const f = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function darken(hex, pct = 0.3) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(String(hex || "")) ? String(hex) : "#000000";
  const [r, g, b] = safe.slice(1).match(/../g).map((x) => parseInt(x, 16));
  const d = (v) => Math.max(0, Math.round(v * (1 - pct)));
  return `#${[d(r), d(g), d(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function lighten(hex, pct = 0.3) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(String(hex || "")) ? String(hex) : "#ffffff";
  const [r, g, b] = safe.slice(1).match(/../g).map((x) => parseInt(x, 16));
  const l = (v) => Math.min(255, Math.round(v + (255 - v) * pct));
  return `#${[l(r), l(g), l(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   TEXT NORMALIZATION — preservado de v9.7.4
────────────────────────────────────────────────────────────────────────────── */

export function normalizeAscii(text = "") {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSentence(text) {
  const v = String(text || "").replace(/\s+/g, " ").trim();
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : "";
}

export function hasLikelySpanishSignals(text = "") {
  const value = String(text || "").trim();
  if (!value) return false;
  if (/[¿¡áéíóúñü]/i.test(value)) return true;
  return /\b(el|la|los|las|de|del|para|por|con|sin|que|como|cuando|donde|hoy|ahora|durante|segundos|minutos|dedica|toma|escribe|reflexiona|observa|conecta|haz|solo|una|un|tu|tus)\b/i.test(value);
}

export function hasLikelyEnglishSignals(text = "") {
  const value = String(text || "").trim();
  if (!value) return false;
  return /\b(the|a|an|and|or|with|without|through|within|after|before|take|spend|write|reflect|observe|connect|today|now|seconds|minutes|your|what|how|why|when|where)\b/i.test(value);
}

export function hasFirstPerson(text = "", lang = "es") {
  if (lang === "en") {
    return /\b(I|my|me|myself|we|our|ours|ourselves|I'm|I've|I'll|we're|we've)\b/.test(text);
  }
  return /\b(yo|mi|mí|me|conmigo|nosotros|nosotras|nuestro|nuestra|nuestros|nuestras|aprendí|descubrí|sentí|creo|pienso)\b/i.test(text);
}

export function hasGenericClosing(text = "", lang = "es") {
  const value = String(text || "").trim();
  if (!value) return false;
  if (lang === "en") {
    return /(reflective close|empowering conclusion|meaningful close|actionable insight|deeper understanding awaits|dream big|embrace the journey|unlock potential|find your (inner )?(strength|power|center))/i.test(value);
  }
  return /(cierre reflexivo|cierre inspirador|conclusión inspiradora|encuentra tu (fuerza interior|centro|poder|potencial)|transforma tu vida|dream big|alcanza tus sueños)/i.test(value);
}

export function hasForbiddenMeta(text = "", lang = "es") {
  if (lang === "en") {
    return /(according to the book|the book reminds us|invites us to|reflects on|deals with|talks about|proposes|shows us|allows us to)/i.test(text);
  }
  return /(según el libro|el libro nos recuerda|nos invita a|reflexiona sobre|trata sobre|habla de|nos propone|nos muestra|nos permite)/i.test(text);
}

/* ─────────────────────────────────────────────────────────────────────────────
   HIGHLIGHT SYNTAX — preservado de v9.7.4
────────────────────────────────────────────────────────────────────────────── */

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
  return matches.map((m) => m.replace(/\[H\]|\[\/H\]/gi, "").trim()).filter(Boolean).length;
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

/* ─────────────────────────────────────────────────────────────────────────────
   NUCLEUS VALIDATION — nuevo, valida el contrato semántico
────────────────────────────────────────────────────────────────────────────── */

export function validateNucleus(nucleus) {
  const checks = {};
  const failed = [];

  // Identidad
  checks.titulo_es_ok = nucleus?.book_identity?.titulo_es?.length >= 2;
  checks.titulo_en_ok = nucleus?.book_identity?.titulo_en?.length >= 2;
  checks.idioma_valido = ["es", "en"].includes(nucleus?.book_identity?.idioma_original);

  // Verdad
  checks.truth_es_length = nucleus?.truth?.es?.length >= 40 && nucleus?.truth?.es?.length <= 220;
  checks.truth_en_length = nucleus?.truth?.en?.length >= 40 && nucleus?.truth?.en?.length <= 220;
  checks.truth_es_no_primera = !hasFirstPerson(nucleus?.truth?.es || "", "es");
  checks.truth_en_no_primera = !hasFirstPerson(nucleus?.truth?.en || "", "en");
  checks.truth_no_generico = !hasGenericClosing(nucleus?.truth?.es || "", "es") &&
                              !hasGenericClosing(nucleus?.truth?.en || "", "en");

  // Tensión
  checks.tension_es_ok = nucleus?.tension?.es?.length >= 20;
  checks.tension_en_ok = nucleus?.tension?.en?.length >= 20;

  // Micro-acción
  const seconds = nucleus?.micro_action?.seconds;
  checks.seconds_valido = [15, 20, 30, 40, 45, 60].includes(seconds);
  checks.verb_es_presente = !!nucleus?.micro_action?.verb_es;
  checks.verb_en_presente = !!nucleus?.micro_action?.verb_en;
  checks.instruction_es_ok = nucleus?.micro_action?.instruction_es?.length >= 30;
  checks.instruction_en_ok = nucleus?.micro_action?.instruction_en?.length >= 30;

  // Verbos físicos (anti-"reflexiona", anti-"piensa")
  const verbosVagosES = /^(reflexiona|piensa|considera|imagina|medita|visualiza|siente)$/i;
  const verbosVagosEN = /^(reflect|think|consider|imagine|meditate|visualize|feel)$/i;
  checks.verb_es_fisico = !verbosVagosES.test(nucleus?.micro_action?.verb_es || "");
  checks.verb_en_fisico = !verbosVagosEN.test(nucleus?.micro_action?.verb_en || "");

  // Vector emocional
  checks.vector_es_4 = Array.isArray(nucleus?.emotional_vector?.es) && nucleus.emotional_vector.es.length === 4;
  checks.vector_en_4 = Array.isArray(nucleus?.emotional_vector?.en) && nucleus.emotional_vector.en.length === 4;

  // Highlight seeds (NO deben contener [H])
  checks.top_es_sin_marks = !/\[H\]|\[\/H\]/.test(nucleus?.highlight_seeds?.top_es || "");
  checks.top_en_sin_marks = !/\[H\]|\[\/H\]/.test(nucleus?.highlight_seeds?.top_en || "");
  checks.bottom_es_sin_marks = !/\[H\]|\[\/H\]/.test(nucleus?.highlight_seeds?.bottom_es || "");
  checks.bottom_en_sin_marks = !/\[H\]|\[\/H\]/.test(nucleus?.highlight_seeds?.bottom_en || "");

  // Seeds longitud apropiada (6-14 palabras)
  const wordCount = (s) => (s || "").trim().split(/\s+/).filter(Boolean).length;
  checks.top_es_wordcount = wordCount(nucleus?.highlight_seeds?.top_es) >= 5 && wordCount(nucleus?.highlight_seeds?.top_es) <= 18;
  checks.top_en_wordcount = wordCount(nucleus?.highlight_seeds?.top_en) >= 5 && wordCount(nucleus?.highlight_seeds?.top_en) <= 18;

  // Visuales
  const hexRe = /^#[0-9a-fA-F]{6}$/;
  checks.accent_hex = hexRe.test(nucleus?.visual_tokens?.accent || "");
  checks.paper_hex = hexRe.test(nucleus?.visual_tokens?.paper || "");
  checks.ink_hex = hexRe.test(nucleus?.visual_tokens?.ink || "");
  checks.paper_oscuro = checks.paper_hex && luminance(nucleus.visual_tokens.paper) < 0.35;
  checks.ink_claro = checks.ink_hex && luminance(nucleus.visual_tokens.ink) > 0.65;
  checks.palette_4 = Array.isArray(nucleus?.visual_tokens?.palette) && nucleus.visual_tokens.palette.length === 4;

  // Confianza
  checks.confidence_ok = typeof nucleus?.confidence?.book_grounding === "number" &&
                         typeof nucleus?.confidence?.specificity === "number" &&
                         typeof nucleus?.confidence?.risk_of_generic === "number";
  checks.low_generic_risk = nucleus?.confidence?.risk_of_generic <= 0.5;
  checks.decent_grounding = nucleus?.confidence?.book_grounding >= 0.4;

  // Cross-checks
  checks.truth_es_different_from_tension_es = normalizeAscii(nucleus?.truth?.es || "") !== normalizeAscii(nucleus?.tension?.es || "");
  checks.seeds_different_from_truth_es = normalizeAscii(nucleus?.highlight_seeds?.top_es || "") !== normalizeAscii(nucleus?.truth?.es || "");

  for (const [key, value] of Object.entries(checks)) if (!value) failed.push(key);

  const total = Object.keys(checks).length;
  const passed = Object.values(checks).filter(Boolean).length;
  const score = passed / total;

  return {
    score,
    passed,
    total,
    failed,
    aprobado: score >= 0.85,
    nivel: score === 1 ? "PERFECTO" : score >= 0.9 ? "EXCELENTE" : score >= 0.8 ? "BUENO" : "BAJO"
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   TARJETA VALIDATION — preservado de v9.7.4, simplificado
────────────────────────────────────────────────────────────────────────────── */

export function validateTarjeta(tarjeta, lang = "es") {
  const topPlain = stripHighlightTags(tarjeta.parrafoTop || "").trim();
  const botPlain = stripHighlightTags(tarjeta.parrafoBot || "").trim();
  // Suma correcta: highlights en top + highlights en bottom
  const totalH = countHighlights(tarjeta.parrafoTop || "") + countHighlights(tarjeta.parrafoBot || "");
  const allText = [tarjeta.titulo, tarjeta.parrafoTop, tarjeta.subtitulo, tarjeta.parrafoBot].join("\n");

  const checks = {
    titulo_ok: (tarjeta.titulo || "").length >= 8,
    subtitulo_ok: (tarjeta.subtitulo || "").length >= 6 && countHighlights(tarjeta.subtitulo) === 0,
    parrafo_top_rico: topPlain.length >= 40,
    parrafo_bot_rico: botPlain.length >= 40,
    sin_primera_persona: !hasFirstPerson(allText, lang),
    sin_meta: !hasForbiddenMeta(allText, lang),
    highlights_minimos: totalH >= 2,
    highlight_top: countHighlights(tarjeta.parrafoTop) >= 1,
    highlight_bot: countHighlights(tarjeta.parrafoBot) >= 1,
    highlight_top_fino: highlightCoverageRatio(tarjeta.parrafoTop) <= 0.45,
    highlight_bot_fino: highlightCoverageRatio(tarjeta.parrafoBot) <= 0.45,
    accion_real: lang === "en"
      ? /\b(15|20|30|40|45|60)\b|\b(sec|seconds|min|minutes|now|today)\b/i.test(botPlain)
      : /\b(15|20|30|40|45|60)\b|\b(seg|segundos|min|minutos|ahora|hoy)\b/i.test(botPlain),
    sin_cierre_generico: !hasGenericClosing(botPlain, lang)
  };

  const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  const total = Object.keys(checks).length;
  const passed = total - failed.length;
  const score = passed / total;

  return {
    score,
    passed,
    total,
    failed,
    aprobado: score >= 0.85,
    nivel: score === 1 ? "PERFECTO" : score >= 0.9 ? "EXCELENTE" : score >= 0.8 ? "BUENO" : "BAJO"
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   UTILIDADES — preservadas de v9.7.4
────────────────────────────────────────────────────────────────────────────── */

export function sanitizeTitleText(text) {
  return normalizeSentence(
    stripHighlightTags(String(text || ""))
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^[\-\–—:;,. ]+|[\-\–—:;,. ]+$/g, "")
      .replace(/[.!?…]+$/g, "")
      .trim()
  );
}

export function sanitizeSubtitleText(text, lang = "es") {
  let clean = normalizeSentence(
    stripHighlightTags(String(text || ""))
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^[\-\–—:;,. ]+|[\-\–—:;,. ]+$/g, "")
      .trim()
  );
  if (!clean) return "";
  const isQuestion = lang === "es" ? clean.startsWith("¿") : clean.endsWith("?");
  clean = isQuestion ? clean.replace(/[.…]+$/g, "").trim() : clean.replace(/[.!?…]+$/g, "").trim();
  return clean;
}
