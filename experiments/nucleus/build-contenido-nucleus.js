/* ═══════════════════════════════════════════════════════════════════════════════
   build-contenido-nucleus.js — ORQUESTADOR CANÓNICO V2

   Defensa en 3 capas:
     1. Extract con gpt-4o-mini (default)
     2. Si validación falla → re-extract con mini temp baja
     3. Si sigue fallando → escalar a gpt-4o

   Política: SIEMPRE sale resultado. Calidad reportada en _quality_warning.
═══════════════════════════════════════════════════════════════════════════════ */

import fs from "node:fs/promises";
import path from "node:path";
import { randomInt, createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import OpenAI from "openai";

import { extractNucleus, cronobioContext } from "./extract-nucleus.js";
import { judgeBothVoices } from "./voice-judge.js";
import { composeVisual } from "./render-visual-composition.js";
import { renderTarjetaES, renderTarjetaEN, prepareOGPhrases, prepareEditionPhrases } from "./render-tarjeta.js";
import { textContrastOn } from "./triggui-physics.js";
import { validateNucleus } from "./quality-validator.js";

const KEY = process.env.OPENAI_KEY;
if (!KEY) { console.log("🔕 Sin OPENAI_KEY"); process.exit(0); }
const openai = new OpenAI({ apiKey: KEY });

const CFG = {
  modelMini: process.env.TRIGGUI_MODEL || "gpt-4o-mini",
  modelBig: process.env.TRIGGUI_MODEL_BIG || "gpt-4o",
  temperature: Number(process.env.TRIGGUI_TEMP || 0.7),
  files: {
    csv: "data/libros_master.csv",
    outBatch: "contenido.json",
    outShadow: "contenido.shadow.json",
    outSingle: "contenido_edicion.json",
    tmpBook: "/tmp/triggui-book.json",
    metricsDir: "metrics",
    inputsHistoryDir: "inputs-history"
  },
  maxBatch: 20,
  delayMs: 4000,
  shadowMode: process.env.SHADOW_MODE === "true",
  cronoEnabled: process.env.TRIGGUI_CRONO_ENABLED !== "false"
};

const INPUTS = {
  lens: process.env.TRIGGUI_LENS || "",
  visualIntent: process.env.TRIGGUI_VISUAL_INTENT || "",
  bookContext: process.env.TRIGGUI_BOOK_CONTEXT || ""
};

/* ─────────────────────────────────────────────────────────────────────────────
   UTILIDADES
────────────────────────────────────────────────────────────────────────────── */

function seededRandomInt(seed, counter) {
  return createHash("sha256").update(`${seed}:${counter}`).digest().readUInt32BE(0);
}

function fisherYatesShuffle(arr, seed = null) {
  const copy = [...arr];
  if (seed === null) {
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = randomInt(i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  let counter = 0;
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = seededRandomInt(seed, counter++) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAPEO A FORMATO v9.7.4 (compat con build-og-image, build-editions, etc)
────────────────────────────────────────────────────────────────────────────── */

function nucleusToCompat(book, extraction, tarjetaES, tarjetaEN, visual, voiceVerdict, validationMeta, inputsSnapshot, runMeta = {}) {
  const n = extraction.nucleus;
  const style = { accent: visual.accent, paper: visual.paper, ink: visual.ink, border: visual.border };
  const colores = visual.palette;
  const editionPhrasesES = prepareEditionPhrases(n.edition_blocks_es);
  const editionPhrasesEN = prepareEditionPhrases(n.edition_blocks_en);
  const gestureTypesES = (n.edition_blocks_es || []).map((b) => b?.gesture_type).filter(Boolean);
  const gestureTypesEN = (n.edition_blocks_en || []).map((b) => b?.gesture_type).filter(Boolean);

  // Preferir los datos enriquecidos del modelo sobre los del CSV (si corrigió autor/título)
  const autorFinal = (n.book_identity?.autor && n.book_identity.autor.trim().length > book.autor.trim().length)
    ? n.book_identity.autor : book.autor;

  const qualityWarning = validationMeta.quality_overall && validationMeta.quality_overall !== "pass"
    ? {
        overall: validationMeta.quality_overall,
        warnings: validationMeta.quality_warnings || [],
        model_used: validationMeta.model_used,
        escalated: validationMeta.escalated
      }
    : null;

  return {
    titulo: book.titulo,
    autor: autorFinal,
    tagline: book.tagline || "",
    portada: book.portada || book.portada_url || `📚 ${book.titulo}\n${autorFinal}`,
    portada_url: book.portada_url || book.portada || "",
    isbn: book.isbn || "",

    titulo_es: n.book_identity.titulo_es,
    titulo_en: n.book_identity.titulo_en,
    idioma_original: n.book_identity.idioma_original,

    dimension: n.surface_hints.dimension,
    punto: n.surface_hints.punto_hawkins,
    palabras: n.emotional_words_es,
    palabras_en: n.emotional_words_en,
    frases: editionPhrasesES,
    frases_en: editionPhrasesEN,
    frases_og: prepareOGPhrases(n.og_phrases_es),
    frases_og_en: prepareOGPhrases(n.og_phrases_en),
    colores,
    textColors: colores.map(textContrastOn),
    fondo: visual.paper,

    tarjeta: { ...tarjetaES, style },
    tarjeta_base: { ...tarjetaES, style },
    tarjeta_presentacion: { ...tarjetaES, style },
    tarjeta_en: { ...tarjetaEN, style },
    tarjeta_base_en: { ...tarjetaEN, style },
    tarjeta_presentacion_en: { ...tarjetaEN, style },

    videoUrl: `https://duckduckgo.com/?q=!ducky+site:youtube.com+${encodeURIComponent(`${book.titulo} ${autorFinal} entrevista español`)}`,
    videoUrl_en: `https://duckduckgo.com/?q=!ducky+site:youtube.com+${encodeURIComponent(`${n.book_identity.titulo_en || book.titulo} ${autorFinal} interview`)}`,

    _nucleus: n,
    _edition_meta: {
      gesture_types_es: gestureTypesES,
      gesture_types_en: gestureTypesEN,
      distinct_types_es: new Set(gestureTypesES).size,
      distinct_types_en: new Set(gestureTypesEN).size
    },
    _visual: { cssVars: visual.cssVars, decisions: visual.decisions, signature: visual.signature },
    _voice_verdict: voiceVerdict,
    _validation: validationMeta,
    _quality_warning: qualityWarning,
    _inputs_snapshot: inputsSnapshot,
    _crono: extraction.crono,
    _metrics: {
      tokens_prompt: extraction.usage?.prompt_tokens || 0,
      tokens_output: extraction.usage?.completion_tokens || 0,
      tokens_total: runMeta.totalTokens || extraction.usage?.total_tokens || 0,
      tokens_judge: voiceVerdict?.total_tokens || 0,
      elapsed_ms: runMeta.totalElapsedMs || extraction.elapsed_ms,
      model_final: runMeta.modelUsed || extraction.model,
      escalated: runMeta.escalated || false,
      pipeline_version: "nucleus-canonical-v2",
      extraction_attempts: validationMeta.extraction_attempts,
      inputs_applied: extraction.inputs_applied
    }
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   PROCESSBOOK con defensa en 3 capas
────────────────────────────────────────────────────────────────────────────── */

async function processBook(book, inputs, inputsSnapshot) {
  console.log(`\n📖 ${book.titulo} — ${book.autor}`);
  const effectiveInputs = CFG.cronoEnabled ? inputs : { ...inputs, now: new Date() };

  // CAPA 1: extracción inicial con mini
  let extraction = await extractNucleus(openai, book, effectiveInputs, {
    model: CFG.modelMini,
    temperature: CFG.temperature
  });
  let modelUsed = CFG.modelMini;
  let extractionAttempts = 1;
  let escalated = false;
  let totalTokens = extraction.usage?.total_tokens || 0;
  let totalElapsedMs = extraction.elapsed_ms || 0;

  console.log(`   ✓ Nucleus ${modelUsed} (${extraction.usage?.total_tokens || 0}t, ${extraction.elapsed_ms}ms)`);

  let validation = validateNucleus(extraction.nucleus);

  // CAPA 2: re-extract con mini temp baja si necesita
  if (validation.overall === "needs_reextract") {
    console.log(`   ⚠ Quality ${validation.overall} — retry mini temp baja`);
    console.log(`     Warnings: ${validation.warnings.slice(0, 3).join(" | ")}`);
    extractionAttempts += 1;
    extraction = await extractNucleus(openai, book, effectiveInputs, {
      model: CFG.modelMini,
      temperature: 0.3
    });
    totalTokens += extraction.usage?.total_tokens || 0;
    totalElapsedMs += extraction.elapsed_ms || 0;
    validation = validateNucleus(extraction.nucleus);
    console.log(`   ✓ Retry ${CFG.modelMini} → ${validation.overall}`);
  }

  // CAPA 3: escalar a gpt-4o si sigue mal
  if (validation.overall === "needs_reextract" || validation.overall === "needs_escalation") {
    console.log(`   ⚠ Quality ${validation.overall} — escalate ${CFG.modelBig}`);
    console.log(`     Warnings: ${validation.warnings.slice(0, 3).join(" | ")}`);
    extractionAttempts += 1;
    escalated = true;
    modelUsed = CFG.modelBig;
    extraction = await extractNucleus(openai, book, effectiveInputs, {
      model: CFG.modelBig,
      temperature: 0.6
    });
    totalTokens += extraction.usage?.total_tokens || 0;
    totalElapsedMs += extraction.elapsed_ms || 0;
    validation = validateNucleus(extraction.nucleus);
    console.log(`   ✓ Escalated ${CFG.modelBig} → ${validation.overall}`);
  }

  const nucleus = extraction.nucleus;

  // Logs de transparencia (lo que usamos para auditar calidad en tiempo real)
  if (nucleus.book_grounding_anchors) {
    const concepts = (nucleus.book_grounding_anchors.concepts || []).slice(0, 3).map((c) => c.slice(0, 55));
    console.log(`   ⚓ Anchors: ${concepts.join(" | ")}`);
  }
  if (nucleus.book_identity) {
    console.log(`   📘 Identidad: "${nucleus.book_identity.titulo_en}" (EN) | autor="${nucleus.book_identity.autor}"`);
  }
  if (nucleus.lens_analysis?.lens_provided) {
    console.log(`   🔍 Lens decision: ${nucleus.lens_analysis.decision}`);
  }
  if (Array.isArray(nucleus.edition_blocks_es)) {
    const types = nucleus.edition_blocks_es.map((b) => b.gesture_type);
    console.log(`   🎭 Gestures: ${types.join(" • ")} (${new Set(types).size} distintos)`);
  }

  // Voice judge (no escala, solo reporta)
  const voiceVerdict = await judgeBothVoices(openai, nucleus.card_es, nucleus.card_en, book, {
    model: CFG.modelMini
  });
  totalTokens += voiceVerdict.total_tokens || 0;
  console.log(`   🎭 Voz: ${voiceVerdict.consolidated} (conf ${voiceVerdict.confidence.toFixed(2)})`);

  // Composición visual y renderizado
  const visual = composeVisual(nucleus.visual_signature);
  const tarjetaES = renderTarjetaES(nucleus.card_es, visual);
  const tarjetaEN = renderTarjetaEN(nucleus.card_en, visual);

  const validationMeta = {
    voice_verdict: voiceVerdict.consolidated,
    voice_warning: voiceVerdict.consolidated === "resena",
    extraction_attempts: extractionAttempts,
    contrast_ratio: parseFloat(visual.decisions.contrast_ratio),
    contrast_ratio_ok: parseFloat(visual.decisions.contrast_ratio) >= 4.5,
    confidence: nucleus.confidence,
    lens_applied: nucleus.lens_relevance.applied,
    circuit_tripped: voiceVerdict.circuit_tripped,
    quality_overall: validation.overall,
    quality_warnings: validation.warnings,
    model_used: modelUsed,
    escalated
  };

  // Log final
  if (validation.overall === "pass") console.log(`   ✅ Quality: PASS`);
  else if (validation.overall === "pass_with_warnings") console.log(`   🟡 PASS_WITH_WARNINGS — ${validation.warnings.slice(0, 2).join(" | ")}`);
  else console.log(`   🔴 ${validation.overall} (aceptado con warning) — ${validation.warnings.slice(0, 3).join(" | ")}`);

  const status = validation.overall === "pass" ? "✅" : validation.overall === "pass_with_warnings" ? "🟡" : "⚠️";
  console.log(`   ${status} contraste=${visual.decisions.contrast_ratio}:1 | modelo=${modelUsed}${escalated ? " (escalado)" : ""}`);

  return nucleusToCompat(book, extraction, tarjetaES, tarjetaEN, visual, voiceVerdict, validationMeta, inputsSnapshot, {
    totalTokens, totalElapsedMs, modelUsed, escalated
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   I/O
────────────────────────────────────────────────────────────────────────────── */

async function fileExists(p) { try { await fs.access(p); return true; } catch { return false; } }

async function loadCSV() {
  const raw = await fs.readFile(CFG.files.csv, "utf8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true });
  return rows.map((row) => ({
    titulo: String(row.titulo || row.Titulo || row.title || "").trim(),
    autor: String(row.autor || row.Autor || row.author || "").trim(),
    tagline: String(row.tagline || row.Tagline || "").trim(),
    portada: String(row.portada || row.portada_url || "").trim(),
    portada_url: String(row.portada_url || row.portada || "").trim(),
    isbn: String(row.isbn || row.ISBN || "").trim()
  })).filter((r) => r.titulo && r.autor);
}

async function loadSingle() {
  if (await fileExists(CFG.files.tmpBook)) return JSON.parse(await fs.readFile(CFG.files.tmpBook, "utf8"));
  if (process.env.SINGLE_BOOK) return JSON.parse(process.env.SINGLE_BOOK);
  return null;
}

async function writeJSON(p, data) {
  await fs.writeFile(p, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function snapshotInputs(inputs, crono) {
  const stamp = new Date().toISOString().replace(/[:]/g, "-").replace(/\..+$/, "");
  await fs.mkdir(CFG.files.inputsHistoryDir, { recursive: true });
  const content = `# Triggui run — ${stamp}

## Contexto cronobiológico automático
- Día: ${crono.dia}
- Hora: ${crono.hora}:00
- Franja: ${crono.franja}
- Energía: ${Math.round(crono.energia * 100)}%
- Modo: ${crono.modo}

## Curaduría silenciosa (lens)
${inputs.lens || "_(vacío)_"}

## Intención visual
${inputs.visualIntent || "_(vacío)_"}

## Contexto específico de libro
${inputs.bookContext || "_(vacío)_"}
`;
  const p = path.join(CFG.files.inputsHistoryDir, `${stamp}.md`);
  await fs.writeFile(p, content, "utf8");
  console.log(`📎 Inputs snapshot: ${p}`);
  return stamp;
}

async function writeMetrics(run) {
  await fs.mkdir(CFG.files.metricsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await writeJSON(`${CFG.files.metricsDir}/nucleus-${stamp}.json`, run);
}

/* ─────────────────────────────────────────────────────────────────────────────
   RUNNERS
────────────────────────────────────────────────────────────────────────────── */

async function runBatch() {
  const t0 = Date.now();
  const books = await loadCSV();
  const seed = process.env.TRIGGUI_SEED || null;
  const selected = fisherYatesShuffle(books, seed).slice(0, Math.min(CFG.maxBatch, books.length));
  const outputFile = CFG.shadowMode ? CFG.files.outShadow : CFG.files.outBatch;
  const crono = cronobioContext();
  const inputsSnapshot = await snapshotInputs(INPUTS, crono);

  console.log(`\n🚀 BATCH ${selected.length}/${books.length}`);
  console.log(`   Modo: ${CFG.shadowMode ? "🌒 SHADOW" : "⚡ PRODUCCIÓN"}`);
  console.log(`   ${crono.dia} ${crono.hora}h ${crono.franja} | energía ${Math.round(crono.energia * 100)}% | modo ${crono.modo}`);
  console.log(`   Lens: ${INPUTS.lens ? "✅" : "—"}  VisualIntent: ${INPUTS.visualIntent ? "✅" : "—"}`);
  console.log(`   Output: ${outputFile}`);

  const results = [];
  let totalTokens = 0;
  let fallos = 0;
  let escalated = 0;

  for (let i = 0; i < selected.length; i += 1) {
    console.log(`\n━━━━━ [${i + 1}/${selected.length}] ━━━━━`);
    try {
      const result = await processBook(selected[i], INPUTS, inputsSnapshot);
      results.push(result);
      totalTokens += result._metrics?.tokens_total || 0;
      if (result._metrics?.escalated) escalated += 1;
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      results.push({ ...selected[i], _fallback: true, _error: error.message });
      fallos += 1;
    }
    if (i < selected.length - 1) await new Promise((r) => setTimeout(r, CFG.delayMs));
  }

  const exitosos = results.filter((r) => !r._fallback);
  await writeJSON(outputFile, { libros: exitosos });

  const runMs = Date.now() - t0;
  await writeMetrics({
    timestamp: new Date().toISOString(),
    pipeline: "nucleus-canonical-v2",
    mode: CFG.shadowMode ? "shadow" : "production",
    seed,
    model_mini: CFG.modelMini,
    model_big: CFG.modelBig,
    temperature: CFG.temperature,
    crono,
    inputs_snapshot: inputsSnapshot,
    requested: selected.length,
    exitosos: exitosos.length,
    fallos,
    escalated,
    total_tokens: totalTokens,
    avg_tokens_per_book: Math.round(totalTokens / Math.max(exitosos.length, 1)),
    run_total_ms: runMs,
    libros: selected.map((b) => `${b.titulo} — ${b.autor}`)
  });

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ ${exitosos.length}/${selected.length} exitosos, ${fallos} fallos, ${escalated} escalados`);
  console.log(`   ${totalTokens} tokens, ${Math.round(totalTokens / Math.max(exitosos.length, 1))}/libro`);
  console.log(`   ${(runMs / 1000).toFixed(1)}s total`);
  console.log(`   Output: ${outputFile}`);
}

async function runSingle() {
  const source = await loadSingle();
  if (!source) throw new Error("SINGLE_MODE sin fuente");
  const book = {
    titulo: String(source.titulo || "").trim(),
    autor: String(source.autor || "").trim(),
    tagline: String(source.tagline || "").trim(),
    portada: String(source.portada_url || source.portada || "").trim(),
    portada_url: String(source.portada_url || source.portada || "").trim(),
    isbn: String(source.isbn || "").trim()
  };
  if (!book.titulo || !book.autor) throw new Error("Libro inválido");

  const crono = cronobioContext();
  const inputsSnapshot = await snapshotInputs(INPUTS, crono);
  console.log(`\n🚀 SINGLE: ${book.titulo}`);
  console.log(`   ${crono.dia} ${crono.hora}h ${crono.franja}`);

  const result = await processBook(book, INPUTS, inputsSnapshot);
  await writeJSON(CFG.files.outSingle, { libros: [result] });
  console.log(`\n✅ ${CFG.files.outSingle}`);
}

async function main() {
  const isSingle = process.env.SINGLE_MODE === "true" || await fileExists(CFG.files.tmpBook);
  if (isSingle) await runSingle();
  else await runBatch();
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
