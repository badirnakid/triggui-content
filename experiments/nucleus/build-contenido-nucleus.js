/* ═══════════════════════════════════════════════════════════════════════════════
   build-contenido-nucleus.js — EL ORQUESTADOR NIVEL DIOS

   Reemplaza build-contenido.js v9.7.4 (1764 líneas).
   Este archivo tiene ~150 líneas y hace lo mismo, pero mejor.

   Flujo:
     1. Leer libro (CSV batch o SINGLE)
     2. extractNucleus → 1 llamada IA con schema estricto
     3. validateNucleus → rechaza si el nucleus es mediocre
     4. renderTarjetaES + renderTarjetaEN → determinista, sin IA
     5. validateTarjeta → verifica que la compilación salió bien
     6. Escribir output en formato compatible con v9.7.4

   Ejecución:
     export OPENAI_KEY=sk-...
     node build-contenido-nucleus.js               # BATCH con CSV
     SINGLE_MODE=true node build-contenido-nucleus.js  # SINGLE con /tmp/triggui-book.json
═══════════════════════════════════════════════════════════════════════════════ */

import fs from "node:fs/promises";
import { randomInt } from "node:crypto";
import { parse } from "csv-parse/sync";
import OpenAI from "openai";

import { extractNucleus } from "./extract-nucleus.js";
import { renderTarjetaES, renderTarjetaEN } from "./render-tarjeta.js";
import { validateNucleus, validateTarjeta } from "./triggui-quality-engine.js";

const KEY = process.env.OPENAI_KEY;
if (!KEY) {
  console.log("🔕 Sin OPENAI_KEY");
  process.exit(0);
}

const openai = new OpenAI({ apiKey: KEY });

const CFG = {
  model: process.env.TRIGGUI_MODEL || "gpt-4o-mini",
  temperature: Number(process.env.TRIGGUI_TEMP || 0.7),
  files: {
    csv: "data/libros_master.csv",
    outBatch: "contenido.json",
    outSingle: "contenido_edicion.json",
    tmpBook: "/tmp/triggui-book.json"
  },
  maxBatch: 20,
  delayMs: 5000
};

/* ─────────────────────────────────────────────────────────────────────────────
   ORQUESTACIÓN POR LIBRO
────────────────────────────────────────────────────────────────────────────── */

async function processBook(book) {
  console.log(`\n📖 ${book.titulo} — ${book.autor}`);

  // 1. Extracción única
  const extraction = await extractNucleus(openai, book, {
    model: CFG.model,
    temperature: CFG.temperature
  });
  console.log(`   ✓ Nucleus extraído (${extraction.usage?.total_tokens} tokens, ${extraction.elapsed_ms}ms)`);

  // 2. Validación semántica del nucleus
  const nv = validateNucleus(extraction.nucleus);
  console.log(`   ✓ Validación nucleus: ${nv.nivel} (${nv.passed}/${nv.total})`);
  if (!nv.aprobado) {
    console.log(`   ⚠️  Checks fallidos: ${nv.failed.join(", ")}`);
    return { ...book, _fallback: true, _error: `Nucleus inválido: ${nv.failed.join(", ")}` };
  }

  // 3. Compilación determinista
  const tarjetaES = renderTarjetaES(extraction.nucleus);
  const tarjetaEN = renderTarjetaEN(extraction.nucleus);

  // 4. Validación de tarjetas compiladas
  const vES = validateTarjeta(tarjetaES, "es");
  const vEN = validateTarjeta(tarjetaEN, "en");
  console.log(`   ✓ Tarjeta ES: ${vES.nivel} (${vES.passed}/${vES.total})`);
  console.log(`   ✓ Tarjeta EN: ${vEN.nivel} (${vEN.passed}/${vEN.total})`);

  if (!vES.aprobado || !vEN.aprobado) {
    console.log(`   ⚠️  Tarjeta ES fallidos: ${vES.failed.join(", ")}`);
    console.log(`   ⚠️  Tarjeta EN fallidos: ${vEN.failed.join(", ")}`);
  }

  // 5. Output compatible con formato v9.7.4
  return {
    titulo: book.titulo,
    autor: book.autor,
    tagline: book.tagline || "",
    portada: book.portada || book.portada_url || "",
    portada_url: book.portada_url || book.portada || "",
    isbn: book.isbn || "",

    // Campos canónicos del nucleus
    titulo_es: extraction.nucleus.book_identity.titulo_es,
    titulo_en: extraction.nucleus.book_identity.titulo_en,
    idioma_original: extraction.nucleus.book_identity.idioma_original,

    // Compatibilidad con v9.7.4: palabras/frases/colores derivados
    palabras: extraction.nucleus.emotional_vector.es,
    palabras_en: extraction.nucleus.emotional_vector.en,
    frases: buildFrasesCompat(extraction.nucleus, "es"),
    frases_en: buildFrasesCompat(extraction.nucleus, "en"),
    colores: extraction.nucleus.visual_tokens.palette,
    fondo: extraction.nucleus.visual_tokens.paper,
    dimension: extraction.nucleus.surface_hints.dimension,
    punto: extraction.nucleus.surface_hints.punto_hawkins,

    // Tarjetas compiladas
    tarjeta: tarjetaES,
    tarjeta_base: tarjetaES,
    tarjeta_presentacion: tarjetaES,
    tarjeta_en: tarjetaEN,
    tarjeta_base_en: tarjetaEN,
    tarjeta_presentacion_en: tarjetaEN,

    // Metadata auditable
    _nucleus: extraction.nucleus,
    _validation: {
      nucleus: { score: nv.score, nivel: nv.nivel },
      tarjeta_es: { score: vES.score, nivel: vES.nivel },
      tarjeta_en: { score: vEN.score, nivel: vEN.nivel }
    },
    _metrics: {
      tokens: extraction.usage?.total_tokens,
      elapsed_ms: extraction.elapsed_ms,
      model: extraction.model,
      version: "nucleus-v1"
    },

    videoUrl: `https://duckduckgo.com/?q=!ducky+site:youtube.com+${encodeURIComponent(`${book.titulo} ${book.autor}`)}`,
    videoUrl_en: `https://duckduckgo.com/?q=!ducky+site:youtube.com+${encodeURIComponent(`${extraction.nucleus.book_identity.titulo_en} ${book.autor} interview`)}`
  };
}

// Deriva frases emoji desde emotional_vector + micro_action para mantener compat
function buildFrasesCompat(nucleus, lang = "es") {
  const vector = lang === "en" ? nucleus.emotional_vector.en : nucleus.emotional_vector.es;
  const emojis = ["⚡", "🎯", "📖", "✨"];
  const { seconds, instruction_es, instruction_en } = nucleus.micro_action;
  const instr = lang === "en" ? instruction_en : instruction_es;
  return [
    `${emojis[0]} ${vector[0]}`,
    `${emojis[1]} ${vector[1]}`,
    `${emojis[2]} ${vector[2]}`,
    `${emojis[3]} ${seconds}s: ${instr.slice(0, 60)}`
  ];
}

/* ─────────────────────────────────────────────────────────────────────────────
   ENTRADA: BATCH o SINGLE
────────────────────────────────────────────────────────────────────────────── */

async function fileExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function loadCSV() {
  const raw = await fs.readFile(CFG.files.csv, "utf8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true });
  return rows.map((row) => ({
    titulo: String(row.titulo || row.title || "").trim(),
    autor: String(row.autor || row.author || "").trim(),
    tagline: String(row.tagline || "").trim(),
    portada: String(row.portada || row.portada_url || "").trim(),
    portada_url: String(row.portada_url || row.portada || "").trim(),
    isbn: String(row.isbn || "").trim()
  })).filter((r) => r.titulo && r.autor);
}

async function loadSingle() {
  if (await fileExists(CFG.files.tmpBook)) return JSON.parse(await fs.readFile(CFG.files.tmpBook, "utf8"));
  if (process.env.SINGLE_BOOK) return JSON.parse(process.env.SINGLE_BOOK);
  return null;
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function writeJSON(path, data) {
  await fs.writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function runBatch() {
  const books = await loadCSV();
  const selected = shuffle(books).slice(0, Math.min(CFG.maxBatch, books.length));
  console.log(`\n🚀 BATCH: ${selected.length} libros de ${books.length} totales`);

  const results = [];
  for (let i = 0; i < selected.length; i += 1) {
    console.log(`\n[${i + 1}/${selected.length}]`);
    try {
      results.push(await processBook(selected[i]));
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      results.push({ ...selected[i], _fallback: true, _error: error.message });
    }
    if (i < selected.length - 1) await new Promise((r) => setTimeout(r, CFG.delayMs));
  }

  const exitosos = results.filter((r) => !r._fallback);
  await writeJSON(CFG.files.outBatch, { libros: exitosos });
  console.log(`\n✅ ${exitosos.length}/${results.length} libros procesados`);
  console.log(`📚 ${CFG.files.outBatch} actualizado`);
}

async function runSingle() {
  const source = await loadSingle();
  if (!source) throw new Error("SINGLE_MODE sin /tmp/triggui-book.json ni SINGLE_BOOK env");
  const book = {
    titulo: String(source.titulo || "").trim(),
    autor: String(source.autor || "").trim(),
    tagline: String(source.tagline || "").trim(),
    portada: String(source.portada_url || source.portada || "").trim(),
    portada_url: String(source.portada_url || source.portada || "").trim(),
    isbn: String(source.isbn || "").trim()
  };
  if (!book.titulo || !book.autor) throw new Error("Libro inválido: falta titulo/autor");

  console.log(`\n🚀 SINGLE: ${book.titulo}`);
  const result = await processBook(book);

  if (result._fallback) {
    console.log(`\n❌ SINGLE falló: ${result._error}`);
    process.exit(1);
  }

  await writeJSON(CFG.files.outSingle, { libros: [result] });
  console.log(`\n✅ ${CFG.files.outSingle} actualizado`);
}

async function main() {
  const isSingle = process.env.SINGLE_MODE === "true" || await fileExists(CFG.files.tmpBook);
  if (isSingle) await runSingle();
  else await runBatch();
}

main().catch((err) => {
  console.error("❌ Pipeline falló:", err);
  process.exit(1);
});
