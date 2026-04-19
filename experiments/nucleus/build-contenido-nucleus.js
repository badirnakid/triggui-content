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

function nucleusToV974Format(book, extraction, tarjetaES, tarjetaEN, visual, voiceVerdict, validation, inputsSnapshot) {
  const n = extraction.nucleus;
  const style = { accent: visual.accent, paper: visual.paper, ink: visual.ink, border: visual.border };
  const colores = visual.palette;

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
    frases: prepareOGPhrases(n.edition_phrases_es),
    frases_en: prepareOGPhrases(n.edition_phrases_en),
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
    _visual: { cssVars: visual.cssVars, decisions: visual.decisions, signature: visual.signature },
    _voice_verdict: voiceVerdict,
    _validation: validation,
    _inputs_snapshot: inputsSnapshot,
    _crono: extraction.crono,
    _metrics: {
      tokens_prompt: extraction.usage?.prompt_tokens || 0,
      tokens_output: extraction.usage?.completion_tokens || 0,
      tokens_total: extraction.usage?.total_tokens || 0,
      tokens_judge: voiceVerdict?.total_tokens || 0,
      elapsed_ms: extraction.elapsed_ms,
      model: extraction.model,
      pipeline_version: "nucleus-final-v1",
      extraction_attempts: validation.extraction_attempts,
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

  let extraction = await extractNucleus(openai, book, effectiveInputs, {
    model: CFG.model,
    temperature: CFG.temperature
  });
  console.log(`   ✓ Nucleus (${extraction.usage?.total_tokens}t, ${extraction.elapsed_ms}ms)`);

  let extractionAttempts = 1;
  const n = extraction.nucleus;

  console.log(`   ✓ Firma: ${n.visual_signature.typography_family}/${n.visual_signature.density}/${n.visual_signature.rhythm}/${n.visual_signature.genre_visual}`);

  // Anclajes del libro (visibles en logs para verificar calidad)
  if (n.book_grounding_anchors) {
    const known = n.book_grounding_anchors.book_known ? "✓" : "⚠";
    console.log(`   ${known} Book known: ${n.book_grounding_anchors.book_known}`);
    const concepts = (n.book_grounding_anchors.concepts || []).slice(0, 3);
    if (concepts.length) console.log(`   ⚓ Anchors: ${concepts.map(c => c.slice(0, 60)).join(" | ")}`);
  }

  // Análisis de lente (visible)
  if (n.lens_analysis && n.lens_analysis.lens_provided) {
    console.log(`   🔍 Lens decision: ${n.lens_analysis.decision}`);
    console.log(`   🔍 Lens analysis: ${n.lens_analysis.analysis.slice(0, 120)}${n.lens_analysis.analysis.length > 120 ? "..." : ""}`);
  }

  if (n.lens_relevance.applied) console.log(`   ✅ Lente APLICADA al contenido`);
  else if (n.lens_analysis?.lens_provided) console.log(`   ⚪ Lente NO aplicada: ${n.lens_relevance.reason.slice(0, 100)}`);

  // Gestos de Edición Viva (visibles para verificar variedad)
  if (Array.isArray(n.edition_gestures_meta_es)) {
    console.log(`   🎭 Edition gestures: ${n.edition_gestures_meta_es.join(" • ")}`);
  }

  // Voice judge con circuit breaker
  let voiceVerdict = await judgeBothVoices(openai, n.card_es, n.card_en, book, { model: CFG.model });
  console.log(`   🎭 Voz: ${voiceVerdict.consolidated} (conf ${voiceVerdict.confidence.toFixed(2)})`);

  // Re-extracción UNA vez máximo si reseña con alta confianza
  if (voiceVerdict.should_reextract) {
    console.log(`   🔄 Re-extract (circuit breaker: 1 máximo)`);
    extractionAttempts += 1;
    extraction = await extractNucleus(openai, book, effectiveInputs, {
      model: CFG.model,
      temperature: Math.max(0.3, CFG.temperature - 0.4)
    });
    voiceVerdict = await judgeBothVoices(openai, extraction.nucleus.card_es, extraction.nucleus.card_en, book, { model: CFG.model });
    console.log(`   🎭 Post re-extract: ${voiceVerdict.consolidated}`);
  }

  const nucleus = extraction.nucleus;
  const visual = composeVisual(nucleus.visual_signature);
  const tarjetaES = renderTarjetaES(nucleus.card_es, visual);
  const tarjetaEN = renderTarjetaEN(nucleus.card_en, visual);

  const validation = {
    voice_verdict: voiceVerdict.consolidated,
    voice_warning: voiceVerdict.consolidated === "resena",
    extraction_attempts: extractionAttempts,
    contrast_ratio: parseFloat(visual.decisions.contrast_ratio),
    contrast_ratio_ok: parseFloat(visual.decisions.contrast_ratio) >= 4.5,
    confidence: nucleus.confidence,
    lens_applied: nucleus.lens_relevance.applied,
    circuit_tripped: voiceVerdict.circuit_tripped
  };

  const resultado = validation.voice_verdict === "pagina" && validation.contrast_ratio_ok ? "✅" : (validation.voice_verdict === "resena" ? "⚠️  voz-warning" : "⚠️  contraste");
  console.log(`   ${resultado} contraste=${visual.decisions.contrast_ratio}:1`);

  return nucleusToV974Format(book, extraction, tarjetaES, tarjetaEN, visual, voiceVerdict, validation, inputsSnapshot);
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
