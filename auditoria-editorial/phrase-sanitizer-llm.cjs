#!/usr/bin/env node
"use strict";
const fs = require("node:fs");

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith("--"))
    .map(a => { const [k,v] = a.slice(2).split("="); return [k, v ?? "true"]; })
);

const CATALOG = args.catalog;
const MODE = (args.mode || "report").toLowerCase();
const ONLY_LAST = args["only-last"] === "true";
const MIN_PRESERVE_RATIO = parseFloat(args["min-preserve"] || "0.85");
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const MODEL = "gpt-4o-mini";

if (!CATALOG || !fs.existsSync(CATALOG)) { console.error("missing --catalog"); process.exit(2); }
if (!OPENAI_KEY) { console.error("missing OPENAI_API_KEY"); process.exit(2); }
if (!["report","fix"].includes(MODE)) { console.error("--mode must be report|fix"); process.exit(2); }

const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
const libros = ONLY_LAST ? [catalog.libros[catalog.libros.length-1]] : catalog.libros;

console.log("phrase-sanitizer-llm v3.0 (with preservation guardrail)");
console.log("  catalog:", CATALOG, "  mode:", MODE, "  libros:", libros.length);
console.log("  min-preserve-ratio:", MIN_PRESERVE_RATIO);
console.log("");

const PHRASE_FIELDS = [
  ["tagline", "string"],
  ["frases", "array_strings"], ["frases_en", "array_strings"],
  ["frases_og", "array_strings"], ["frases_og_en", "array_strings"],
  ["tarjeta.parrafoTop", "string"], ["tarjeta.parrafoBot", "string"],
  ["tarjeta.subtitulo", "string"], ["tarjeta.titulo", "string"],
  ["_nucleus.card_es.parrafoTop", "string"], ["_nucleus.card_es.parrafoBot", "string"],
  ["_nucleus.card_es.subtitulo", "string"], ["_nucleus.card_es.titulo", "string"],
  ["_nucleus.card_en.parrafoTop", "string"], ["_nucleus.card_en.parrafoBot", "string"],
  ["_nucleus.card_en.subtitulo", "string"], ["_nucleus.card_en.titulo", "string"],
  ["_nucleus.edition_blocks_es", "array_objects_phrase"],
  ["_nucleus.edition_blocks_en", "array_objects_phrase"],
  ["_nucleus.og_phrases_es", "array_objects_phrase"],
  ["_nucleus.og_phrases_en", "array_objects_phrase"],
];

function getNode(obj, dotPath) {
  const parts = dotPath.split(".");
  let cursor = obj;
  for (const p of parts) { if (cursor == null) return null; cursor = cursor[p]; }
  return cursor;
}
function setNode(obj, dotPath, value) {
  const parts = dotPath.split(".");
  let cursor = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cursor[parts[i]] == null) return false;
    cursor = cursor[parts[i]];
  }
  cursor[parts[parts.length - 1]] = value;
  return true;
}
function collectPhrases(libro) {
  const out = [];
  for (const [fpath, fkind] of PHRASE_FIELDS) {
    const node = getNode(libro, fpath);
    if (node == null) continue;
    if (fkind === "string" && typeof node === "string" && node.trim().length > 4) {
      out.push({ field: fpath, kind: fkind, idx: null, value: node });
    } else if (fkind === "array_strings" && Array.isArray(node)) {
      node.forEach((v, i) => { if (typeof v === "string" && v.trim().length > 4) out.push({field: fpath, kind: fkind, idx: i, value: v}); });
    } else if (fkind === "array_objects_phrase" && Array.isArray(node)) {
      node.forEach((obj, i) => { if (obj && typeof obj.phrase === "string" && obj.phrase.trim().length > 4) out.push({field: fpath, kind: fkind, idx: i, value: obj.phrase}); });
    }
  }
  return out;
}
function applyFix(libro, p, fixedPhrase) {
  const node = getNode(libro, p.field);
  if (p.kind === "string") return setNode(libro, p.field, fixedPhrase);
  if (p.kind === "array_strings" && Array.isArray(node) && p.idx != null) { node[p.idx] = fixedPhrase; return true; }
  if (p.kind === "array_objects_phrase" && Array.isArray(node) && p.idx != null) {
    if (node[p.idx] && typeof node[p.idx] === "object") { node[p.idx].phrase = fixedPhrase; return true; }
  }
  return false;
}

async function classifyPhrase(phrase) {
  const system = `Eres un detector y corrector estricto de frases truncadas en español o inglés. Respondes SOLO JSON.

UNA FRASE ESTÁ TRUNCADA si:
- Termina con palabra cortada (prefijo sin sufijo: "incertid", "tambi", "af.", "í.")
- Termina con preposición/artículo sin completar idea ("vivir en", "actúa desde.", "el af.")
- La idea sintáctica/semántica está claramente incompleta

NO ESTÁ TRUNCADA si:
- Termina con punto/?/! con idea cerrada coherente
- Es pregunta retórica completa
- Es título corto del catálogo
- Termina con expresión válida ("tú eres mucho más." "la oscuridad del ego.")

Sé CONSERVADOR: en duda razonable, di que NO está truncada.

═══════════════════════════════════════════════════════════════════
🛡️ REGLAS DURAS PARA "fixed_phrase" — NO LAS ROMPAS BAJO NINGUNA CIRCUNSTANCIA:

1. "fixed_phrase" DEBE empezar con LITERALMENTE las mismas palabras del original
   (incluido emoji inicial si lo tiene).
2. Solo modificas/agregas al FINAL de la frase, corrigiendo el truncamiento.
3. La longitud de "fixed_phrase" DEBE ser MAYOR O IGUAL al original.
4. NUNCA reemplaces, resumas, o acortes el texto previo.
5. Si el original es un párrafo de varias oraciones, PRESERVA TODAS las oraciones
   completas y solo corrige la última que está truncada.
6. Si no puedes corregir preservando todo el contexto, devuelve el original
   TRUNCADO AL ÚLTIMO PUNTO COMPLETO VÁLIDO (sin agregar palabras inventadas).
7. Si el truncamiento no tiene punto válido previo, omite "fixed_phrase".
═══════════════════════════════════════════════════════════════════

EJEMPLO CORRECTO:
  original:     "La vida es compleja. El destino nos sorprende. Aceptar es la"
  fixed_phrase: "La vida es compleja. El destino nos sorprende. Aceptar es la clave del bienestar."

EJEMPLO INCORRECTO (NO HACER):
  original:     "La vida es compleja. El destino nos sorprende. Aceptar es la"
  fixed_phrase: "Aceptar es la clave."   ← REEMPLAZÓ TODO, ESTÁ MAL

Responde JSON:
{
  "truncated": true|false,
  "confidence": 0.0-1.0,
  "fixed_phrase": "<frase ENTERA original con final corregido, preservando TODO contexto previo>",
  "reason": "<10 palabras max>"
}`;

  const user = "Frase original:\n\"" + phrase + "\"\n\nLongitud original: " + phrase.length + " chars.\nSi truncada, devuelve fixed_phrase de longitud ≥ " + phrase.length + " chars con TODO el contexto previo preservado.";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + OPENAI_KEY },
    body: JSON.stringify({
      model: MODEL, temperature: 0, max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }]
    })
  });
  if (!res.ok) { const t = await res.text(); throw new Error("OpenAI " + res.status + ": " + t.slice(0,150)); }
  const data = await res.json();
  return JSON.parse(data.choices?.[0]?.message?.content || "{}");
}

(async () => {
  const stats = { books: 0, phrases: 0, truncations: 0, fixed: 0, guardrail_skipped: 0, errors: 0 };
  const findings = [];

  for (const libro of libros) {
    stats.books++;
    const phrases = collectPhrases(libro);
    process.stdout.write("📖 " + (libro.titulo?.slice(0,55) || "?") + " (" + phrases.length + ")... ");
    let book_truncs = 0, book_fixed = 0, book_skipped = 0;
    for (const p of phrases) {
      stats.phrases++;
      try {
        const result = await classifyPhrase(p.value);
        if (result.truncated && (result.confidence ?? 1) >= 0.65) {
          stats.truncations++;
          book_truncs++;

          // 🛡️ GUARDRAIL: si fixed_phrase es < 85% del original, sospechar
          let guardrailMsg = null;
          if (result.fixed_phrase) {
            const ratio = result.fixed_phrase.length / p.value.length;
            if (ratio < MIN_PRESERVE_RATIO) {
              guardrailMsg = `fixed_phrase (${result.fixed_phrase.length} chars) is ${(ratio*100).toFixed(0)}% of original (${p.value.length} chars) — sospechoso, omitir`;
              result.fixed_phrase = null;
            }
            // 🛡️ GUARDRAIL 2: si fixed_phrase NO empieza con los primeros 20 chars del original, sospechar
            else if (p.value.length > 30 && result.fixed_phrase.slice(0, Math.min(20, p.value.length)).trim() !== p.value.slice(0, Math.min(20, p.value.length)).trim()) {
              guardrailMsg = "fixed_phrase no empieza con el original — sospechoso, omitir";
              result.fixed_phrase = null;
            }
          }

          findings.push({ libro: libro.titulo, field: p.field, idx: p.idx, original: p.value, ...result, guardrail: guardrailMsg });

          if (MODE === "fix" && result.fixed_phrase) {
            const ok = applyFix(libro, p, result.fixed_phrase);
            if (ok) { stats.fixed++; book_fixed++; }
          } else if (guardrailMsg) {
            stats.guardrail_skipped++;
            book_skipped++;
          }
        }
      } catch (e) { stats.errors++; }
    }
    let suffix = book_truncs + " truncs";
    if (MODE === "fix") suffix += " (" + book_fixed + " fixed";
    if (book_skipped > 0) suffix += ", " + book_skipped + " skip-guardrail";
    if (MODE === "fix") suffix += ")";
    console.log(suffix);
  }

  console.log("");
  console.log("RESUMEN");
  console.log("  libros:", stats.books, "  phrases:", stats.phrases);
  console.log("  truncamientos detectados:", stats.truncations);
  if (MODE === "fix") console.log("  fixed:", stats.fixed);
  console.log("  guardrail-skipped:", stats.guardrail_skipped);
  console.log("  errores:", stats.errors);
  console.log("");

  if (findings.length > 0) {
    console.log("DETALLE (" + findings.length + " truncamientos):");
    findings.forEach((f, i) => {
      console.log("");
      console.log((i+1) + ". 📖 " + f.libro);
      console.log("   campo:    " + f.field + (f.idx != null ? "[" + f.idx + "]" : ""));
      console.log("   ANTES (" + f.original.length + " chars):");
      console.log("      \"" + f.original.slice(0,160) + (f.original.length>160?"...":"") + "\"");
      if (f.fixed_phrase) {
        console.log("   DESPUÉS (" + f.fixed_phrase.length + " chars):");
        console.log("      \"" + f.fixed_phrase.slice(0,160) + (f.fixed_phrase.length>160?"...":"") + "\"");
      } else if (f.guardrail) {
        console.log("   DESPUÉS: 🛡️ GUARDRAIL ACTIVADO: " + f.guardrail);
      } else {
        console.log("   DESPUÉS: (no fix posible)");
      }
      console.log("   razón: " + f.reason + " | conf: " + f.confidence);
    });
    const ts = new Date().toISOString().replace(/[:.]/g,"-").slice(0,19);
    const reportPath = "audit-reports/phrase-sanitizer-llm-" + ts + ".json";
    fs.mkdirSync("audit-reports", { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify({ stats, findings, mode: MODE }, null, 2));
    console.log("");
    console.log("📂 Report: " + reportPath);
  }

  if (MODE === "fix" && stats.fixed > 0) {
    const bak = CATALOG + ".bak-pre-llm-sanitizer-" + new Date().toISOString().replace(/[:.]/g,"-").slice(0,19);
    fs.writeFileSync(bak, fs.readFileSync(CATALOG));
    fs.writeFileSync(CATALOG, JSON.stringify(catalog, null, 2));
    console.log("");
    console.log("✅ Catálogo actualizado: " + CATALOG);
    console.log("📦 Backup pre-fix:       " + bak);
  }
})().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
