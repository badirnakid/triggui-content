/* ═══════════════════════════════════════════════════════════════════════════════
   build-contenido-nucleus.js — ORQUESTADOR TRIGGUI

   Entrada: variables de entorno del workflow_dispatch
     OPENAI_KEY             (requerido)
     TRIGGUI_LENS           (opcional)  Curaduría silenciosa del día
     TRIGGUI_VISUAL_INTENT  (opcional)  Intención visual del día
     TRIGGUI_BOOK_CONTEXT   (opcional)  Contexto específico del libro (solo SINGLE)
     TRIGGUI_CRONO_ENABLED  (default true)  Si false, no aplica framework cronobiológico
     SINGLE_MODE=true       Modo single libro
     SHADOW_MODE=true       Escribe a contenido.shadow.json
     TRIGGUI_SEED           Seed reproducible
     TRIGGUI_MODEL          Default gpt-4o-mini
     TRIGGUI_TEMP           Default 0.7

   Flujo por libro:
     1. extractNucleus (1 llamada con crono + inputs)
     2. judgeBothVoices (2 llamadas baratas)
     3. Si reseña alta confianza: 1 sola re-extracción (circuit breaker)
     4. composeVisual (matemática pura)
     5. renderTarjeta ES + EN (sin envolturas)
     6. ensamble v9.7.4 compat
═══════════════════════════════════════════════════════════════════════════════ */

import fs from "node:fs/promises";
import path from "node:path";
import { randomInt, createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import OpenAI from "openai";

import { extractNucleus, cronobioContext } from "./extract-nucleus.js";
import { judgeBothVoices } from "./voice-judge.js";
import { composeVisual } from "./render-visual-composition.js";
import { renderTarjetaES, renderTarjetaEN, prepareOGPhrases } from "./render-tarjeta.js";
import { textContrastOn } from "./triggui-physics.js";
import { validateNucleus } from "./quality-validator.js";

const KEY = process.env.OPENAI_KEY;
if (!KEY) { console.log("🔕 Sin OPENAI_KEY"); process.exit(0); }
const openai = new OpenAI({ apiKey: KEY });

const CFG = {
  model: process.env.TRIGGUI_MODEL || "gpt-4o-mini",
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
   RANDOM
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
   ENSAMBLE V9.7.4
────────────────────────────────────────────────────────────────────────────── */

function nucleusToV974Format(book, extraction, tarjetaES, tarjetaEN, visual, voiceVerdict, validationMeta, inputsSnapshot, runMeta = {}) {
  const n = extraction.nucleus;
  const style = { accent: visual.accent, paper: visual.paper, ink: visual.ink, border: visual.border };
  const colores = visual.palette;

  // Mapeo nucleus-final-v2 → v9.7.4:
  // edition_blocks_es[i].phrase → frases[i] (alimenta Edición Viva)
  // og_phrases_es → frases_og (alimenta OG image)
  const editionPhrasesES = (n.edition_blocks_es || []).map((b) => b?.phrase).filter(Boolean);
  const editionPhrasesEN = (n.edition_blocks_en || []).map((b) => b?.phrase).filter(Boolean);
  const gestureTypesES = (n.edition_blocks_es || []).map((b) => b?.gesture_type).filter(Boolean);
  const gestureTypesEN = (n.edition_blocks_en || []).map((b) => b?.gesture_type).filter(Boolean);

  // _quality_warning solo se emite si hay warnings reales (no en caso "pass")
  const qualityWarning = (validationMeta.quality_overall && validationMeta.quality_overall !== "pass")
    ? {
        overall: validationMeta.quality_overall,
        warnings: validationMeta.quality_warnings || [],
        model_used: validationMeta.model_used,
        escalated: validationMeta.escalated
      }
    : null;

  return {
    titulo: book.titulo,
    autor: book.autor,
    tagline: book.tagline || "",
    portada: book.portada || book.portada_url || `📚 ${book.titulo}\n${book.autor}`,
    portada_url: book.portada_url || book.portada || "",
    isbn: book.isbn || "",

    titulo_es: n.book_identity.titulo_es,
    titulo_en: n.book_identity.titulo_en,
    idioma_original: n.book_identity.idioma_original,

    dimension: n.surface_hints.dimension,
    punto: n.surface_hints.punto_hawkins,
    palabras: n.emotional_words_es,
    palabras_en: n.emotional_words_en,
    frases: prepareOGPhrases(editionPhrasesES),
    frases_en: prepareOGPhrases(editionPhrasesEN),
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

    videoUrl: `https://duckduckgo.com/?q=!ducky+site:youtube.com+${encodeURIComponent(`${book.titulo} ${book.autor} entrevista español`)}`,
    videoUrl_en: `https://duckduckgo.com/?q=!ducky+site:youtube.com+${encodeURIComponent(`${n.book_identity.titulo_en || book.titulo} ${book.autor} interview`)}`,

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
      pipeline_version: "nucleus-final-v2",
      extraction_attempts: validationMeta.extraction_attempts,
      inputs_applied: extraction.inputs_applied
    }
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   PROCESAMIENTO
────────────────────────────────────────────────────────────────────────────── */

async function processBook(book, inputs, inputsSnapshot) {
  console.log(`\n📖 ${book.titulo} — ${book.autor}`);

  const effectiveInputs = CFG.cronoEnabled ? inputs : { ...inputs, now: new Date() };

  // ═══════════════════════════════════════════════════════════════
  // DEFENSA EN CAPAS — FLUJO GARANTÍA-DE-RESULTADO
  //
  // Capa 1: extract con gpt-4o-mini (default)
  // Capa 2: si validación falla → re-extract con mini temp baja
  // Capa 3: si sigue fallando → escalate a gpt-4o (modelo grande)
  // Capa 4: si TODO falla → aceptar con _quality_warning, nunca abortar
  //
  // Política: SIEMPRE sale resultado. Calidad reportada en meta.
  // ═══════════════════════════════════════════════════════════════

  let extraction = await extractNucleus(openai, book, effectiveInputs, {
    model: "gpt-4o-mini",
    temperature: CFG.temperature
  });
  let modelUsed = "gpt-4o-mini";
  let extractionAttempts = 1;
  let escalated = false;
  let totalTokens = extraction.usage?.total_tokens || 0;
  let totalElapsedMs = extraction.elapsed_ms || 0;

  console.log(`   ✓ Nucleus mini (${extraction.usage?.total_tokens}t, ${extraction.elapsed_ms}ms)`);

  // ────────────── VALIDACIÓN ESTRUCTURAL ──────────────
  let validation = validateNucleus(extraction.nucleus);

  // FASE A: re-extract con mini temp baja si needs_reextract
  if (validation.overall === "needs_reextract") {
    console.log(`   ⚠ Validation: ${validation.overall} — re-extract mini temp baja`);
    console.log(`     Warnings: ${validation.warnings.slice(0, 3).join(" | ")}`);
    extractionAttempts += 1;
    extraction = await extractNucleus(openai, book, effectiveInputs, {
      model: "gpt-4o-mini",
      temperature: 0.3
    });
    totalTokens += extraction.usage?.total_tokens || 0;
    totalElapsedMs += extraction.elapsed_ms || 0;
    validation = validateNucleus(extraction.nucleus);
    console.log(`   ✓ Nucleus mini-retry (${extraction.usage?.total_tokens}t)`);
  }

  // FASE B: escalate a gpt-4o si aún falla (o si confidence muy baja)
  if (validation.overall === "needs_reextract" || validation.overall === "needs_escalation") {
    console.log(`   ⚠ Validation: ${validation.overall} — escalando a gpt-4o`);
    console.log(`     Warnings: ${validation.warnings.slice(0, 3).join(" | ")}`);
    extractionAttempts += 1;
    escalated = true;
    modelUsed = "gpt-4o";
    extraction = await extractNucleus(openai, book, effectiveInputs, {
      model: "gpt-4o",
      temperature: 0.6
    });
    totalTokens += extraction.usage?.total_tokens || 0;
    totalElapsedMs += extraction.elapsed_ms || 0;
    validation = validateNucleus(extraction.nucleus);
    console.log(`   ✓ Nucleus gpt-4o (${extraction.usage?.total_tokens}t) — validation: ${validation.overall}`);
  }

  // FASE C: SIEMPRE aceptamos. Si aún hay warnings, se reportan en meta.
  const nucleus = extraction.nucleus;

  console.log(`   ✓ Firma: ${nucleus.visual_signature.typography_family}/${nucleus.visual_signature.density}/${nucleus.visual_signature.rhythm}/${nucleus.visual_signature.genre_visual}`);

  // Anclajes del libro (visibles en logs para verificar calidad)
  if (nucleus.book_grounding_anchors) {
    const known = nucleus.book_grounding_anchors.book_known ? "✓" : "⚠";
    console.log(`   ${known} Book known: ${nucleus.book_grounding_anchors.book_known}`);
    const concepts = (nucleus.book_grounding_anchors.concepts || []).slice(0, 3);
    if (concepts.length) console.log(`   ⚓ Anchors: ${concepts.map(c => c.slice(0, 60)).join(" | ")}`);
  }

  // Análisis de lente (visible)
  if (nucleus.lens_analysis && nucleus.lens_analysis.lens_provided) {
    console.log(`   🔍 Lens decision: ${nucleus.lens_analysis.decision}`);
    console.log(`   🔍 Lens analysis: ${nucleus.lens_analysis.analysis.slice(0, 120)}${nucleus.lens_analysis.analysis.length > 120 ? "..." : ""}`);
  }

  if (nucleus.lens_relevance.applied) console.log(`   ✅ Lente APLICADA al contenido`);
  else if (nucleus.lens_analysis?.lens_provided) console.log(`   ⚪ Lente NO aplicada: ${nucleus.lens_relevance.reason.slice(0, 100)}`);

  // Gestos de Edición Viva (visibles para verificar variedad)
  if (Array.isArray(nucleus.edition_blocks_es)) {
    const types = nucleus.edition_blocks_es.map((b) => b.gesture_type);
    const distinctCount = new Set(types).size;
    console.log(`   🎭 Edition gestures: ${types.join(" • ")} (${distinctCount} distintos)`);
  }

  // Log final de validación
  if (validation.overall === "pass") {
    console.log(`   ✅ Quality: PASS`);
  } else if (validation.overall === "pass_with_warnings") {
    console.log(`   🟡 Quality: PASS_WITH_WARNINGS — ${validation.warnings.slice(0, 2).join(" | ")}`);
  } else {
    console.log(`   🔴 Quality: ${validation.overall} (aceptado con warning)`);
    console.log(`     Warnings finales: ${validation.warnings.slice(0, 4).join(" | ")}`);
  }

  // Voice judge con circuit breaker (no re-extrae, solo reporta)
  let voiceVerdict = await judgeBothVoices(openai, nucleus.card_es, nucleus.card_en, book, { model: "gpt-4o-mini" });
  totalTokens += voiceVerdict.total_tokens || 0;
  console.log(`   🎭 Voz: ${voiceVerdict.consolidated} (conf ${voiceVerdict.confidence.toFixed(2)})`);

  // Composición visual (determinista)
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
    // Defensa en capas
    quality_overall: validation.overall,
    quality_warnings: validation.warnings,
    model_used: modelUsed,
    escalated: escalated
  };

  const resultado = validation.overall === "pass" && validationMeta.contrast_ratio_ok ? "✅" :
                    validation.overall === "pass_with_warnings" ? "🟡" : "⚠️";
  console.log(`   ${resultado} contraste=${visual.decisions.contrast_ratio}:1 | modelo=${modelUsed}${escalated ? " (escalado)" : ""}`);


  return nucleusToV974Format(book, extraction, tarjetaES, tarjetaEN, visual, voiceVerdict, validationMeta, inputsSnapshot, { totalTokens, totalElapsedMs, modelUsed, escalated });
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

async function writeJSON(p, data) { await fs.writeFile(p, `${JSON.stringify(data, null, 2)}\n`, "utf8"); }

async function snapshotInputs(inputs, crono) {
  const stamp = new Date().toISOString().replace(/[:]/g, "-").replace(/\..+$/, "");
  try {
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
  } catch (err) {
    console.log(`   ⚠️  No se pudo snapshot inputs: ${err.message}`);
    return stamp;
  }
}

async function writeMetrics(run) {
  try {
    await fs.mkdir(CFG.files.metricsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await writeJSON(`${CFG.files.metricsDir}/nucleus-${stamp}.json`, run);
  } catch {}
}

/* ─────────────────────────────────────────────────────────────────────────────
   MODOS
────────────────────────────────────────────────────────────────────────────── */

async function runBatch() {
  const t0 = Date.now();
  const books = await loadCSV();
  const seed = process.env.TRIGGUI_SEED || null;
  const shuffled = fisherYatesShuffle(books, seed);
  const selected = shuffled.slice(0, Math.min(CFG.maxBatch, books.length));

  const outputFile = CFG.shadowMode ? CFG.files.outShadow : CFG.files.outBatch;
  const crono = cronobioContext();
  const inputsSnapshot = await snapshotInputs(INPUTS, crono);

  console.log(`\n🚀 BATCH ${selected.length}/${books.length}`);
  console.log(`   Modo: ${CFG.shadowMode ? "🌒 SHADOW" : "⚡ PRODUCCIÓN"}`);
  console.log(`   ${crono.dia} ${crono.hora}h ${crono.franja} | energía ${Math.round(crono.energia * 100)}% | modo ${crono.modo}`);
  console.log(`   Lens: ${INPUTS.lens ? "✅" : "—"}  VisualIntent: ${INPUTS.visualIntent ? "✅" : "—"}`);
  console.log(`   Output: ${outputFile}`);

  const results = [];
  let totalTokens = 0, totalMs = 0, fallos = 0;

  for (let i = 0; i < selected.length; i += 1) {
    console.log(`\n━━━━━ [${i + 1}/${selected.length}] ━━━━━`);
    try {
      const result = await processBook(selected[i], INPUTS, inputsSnapshot);
      results.push(result);
      totalTokens += (result._metrics?.tokens_total || 0) + (result._metrics?.tokens_judge || 0);
      totalMs += result._metrics?.elapsed_ms || 0;
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
    pipeline: "nucleus-final-v1",
    mode: CFG.shadowMode ? "shadow" : "production",
    seed, model: CFG.model, temperature: CFG.temperature,
    crono, inputs_snapshot: inputsSnapshot,
    requested: selected.length, exitosos: exitosos.length, fallos,
    total_tokens: totalTokens,
    avg_tokens_per_book: Math.round(totalTokens / Math.max(exitosos.length, 1)),
    run_total_ms: runMs,
    libros: selected.map((b) => `${b.titulo} — ${b.autor}`)
  });

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ ${exitosos.length}/${selected.length} exitosos, ${fallos} fallos`);
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
  if (result._fallback) {
    console.log(`\n❌ SINGLE falló: ${result._error}`);
    await writeJSON(CFG.files.outSingle, { libros: [result] });
    process.exit(1);
  }
  await writeJSON(CFG.files.outSingle, { libros: [result] });
  console.log(`\n✅ ${CFG.files.outSingle}`);
}

async function main() {
  const isSingle = process.env.SINGLE_MODE === "true" || await fileExists(CFG.files.tmpBook);
  if (isSingle) await runSingle(); else await runBatch();
}

main().catch((err) => { console.error("❌", err); process.exit(1); });
