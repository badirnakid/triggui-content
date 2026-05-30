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
const BATCH_SIZE = Math.max(1, parseInt(args["batch-size"] || "1", 10));
const HEALING = args.healing !== "false";
const MIN_PRESERVE_RATIO = parseFloat(args["min-preserve"] || "0.85");
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const MODEL = "gpt-4o-mini";

if (!CATALOG || !fs.existsSync(CATALOG)) { console.error("missing --catalog"); process.exit(2); }
if (!OPENAI_KEY) { console.error("missing OPENAI_API_KEY"); process.exit(2); }
if (!["report","fix"].includes(MODE)) { console.error("--mode must be report|fix"); process.exit(2); }

const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8"));

// v3.1 NIVEL DIOS — nuevos + healing rotation
let librosToAudit;
let healingInfo = null;

if (ONLY_LAST) {
  const total = catalog.libros.length;
  const N = Math.min(BATCH_SIZE, total);
  const newBooks = catalog.libros.slice(0, N);

  if (HEALING && total > N) {
    const oldPoolStart = N;
    const oldPoolSize = total - N;
    catalog.meta = catalog.meta || {};
    const currentIdx = Number.isInteger(catalog.meta.healing_rotation_idx)
      ? catalog.meta.healing_rotation_idx
      : 0;
    const healingBookIdx = oldPoolStart + (currentIdx % oldPoolSize);
    const healingBook = catalog.libros[healingBookIdx];
    librosToAudit = [...newBooks, healingBook];
    healingInfo = {
      idx: healingBookIdx,
      rotation_idx: currentIdx,
      next_rotation: (currentIdx + 1) % oldPoolSize,
      pool_size: oldPoolSize,
      titulo: healingBook.titulo || "?"
    };
  } else {
    librosToAudit = newBooks;
  }
} else {
  librosToAudit = catalog.libros;
}

console.log("phrase-sanitizer-llm v3.2 (grounding-aware completion + deterministic trim/remove guarantee)");
console.log("  catalog:        " + CATALOG);
console.log("  mode:           " + MODE);
console.log("  total catalog:  " + catalog.libros.length + " libros");
if (ONLY_LAST) {
  const N = Math.min(BATCH_SIZE, catalog.libros.length);
  console.log("  selección:      ONLY_LAST" + (HEALING ? " + healing rotation" : " (sin healing)"));
  console.log("  batch_size:     " + BATCH_SIZE);
  console.log("  audit nuevos:   libros[0.." + (N-1) + "] (" + N + " libro" + (N>1?"s":"") + ")");
  if (healingInfo) {
    console.log("  audit healing:  libros[" + healingInfo.idx + "] = \"" + healingInfo.titulo.slice(0,50) + (healingInfo.titulo.length>50?"...":"") + "\"");
    console.log("                  (rotation " + healingInfo.rotation_idx + " / pool " + healingInfo.pool_size + ")");
  }
} else {
  console.log("  selección:      FULL CATALOG");
}
console.log("  min-preserve:   " + MIN_PRESERVE_RATIO);
console.log("  libros a audit: " + librosToAudit.length);
console.log("");

// ════════════════════════════════════════════════════════════════════════════
// v3.2 — Cierre legítimo determinista (mismo criterio que el nucleus)
// Una frase está "completa" si termina en uno de estos signos.
// ════════════════════════════════════════════════════════════════════════════
const LEGITIMATE = [".", "?", "!", "…", "—", '"', "»", ")", "]"];

// Recorta a la ÚLTIMA oración completa (último cierre legítimo).
//  - Si ya termina completa → la devuelve igual.
//  - Si hay una oración completa antes del corte → devuelve esa parte (REPARA, conserva lo bueno).
//  - Si NO hay ningún cierre legítimo (fragmento puro) → devuelve "" (no hay nada que rescatar).
function trimToLastComplete(text) {
  if (typeof text !== "string") return "";
  const t = text.trim();
  if (!t) return "";
  if (LEGITIMATE.includes(t.slice(-1))) return t;
  let cut = -1;
  for (let i = t.length - 1; i >= 0; i--) {
    if (LEGITIMATE.includes(t[i])) { cut = i; break; }
  }
  if (cut === -1) return "";
  return t.slice(0, cut + 1).trim();
}

// ════════════════════════════════════════════════════════════════════════════
// v3.2 — Grounding del libro: material REAL para completar fiel (no inventar).
// Vive en _nucleus.book_grounding_anchors + _nucleus.book_identity.
// Si el libro no tiene grounding → null (el LLM completa como antes, "a ciegas",
// y la red determinista sigue garantizando que nada truncado sobreviva).
// ════════════════════════════════════════════════════════════════════════════
function bookGrounding(libro) {
  const n = (libro && libro._nucleus) ? libro._nucleus : {};
  const a = n.book_grounding_anchors || {};
  const id = n.book_identity || {};
  const concepts = Array.isArray(a.concepts) ? a.concepts.filter(x => typeof x === "string" && x.trim()) : [];
  const terms    = Array.isArray(a.key_terms) ? a.key_terms.filter(x => typeof x === "string" && x.trim()) : [];
  const voice    = (typeof a.authorial_voice_notes === "string") ? a.authorial_voice_notes.trim() : "";
  const titulo   = id.titulo_es || (libro && libro.titulo) || "";
  const autor    = id.autor_completo || (libro && libro.autor) || "";
  if (!concepts.length && !terms.length && !voice) return null;
  return { titulo, autor, concepts, terms, voice };
}

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

// v3.2 — Remoción de fragmentos puros SOLO de pools (arrays), con GUARDA:
// nunca vacía el pool (si quedara 1 elemento, no remueve). Aplica en orden
// descendente para no corromper índices. Devuelve cuántos removió.
function removeFromPool(libro, field, indices, kind) {
  const node = getNode(libro, field);
  if (!Array.isArray(node)) return 0;
  const sorted = [...new Set(indices)].sort((a, b) => b - a);
  let removed = 0;
  for (const idx of sorted) {
    if (node.length <= 1) break; // GUARDA: jamás vaciar un pool
    if (idx >= 0 && idx < node.length) {
      node.splice(idx, 1);
      removed++;
    }
  }
  return removed;
}

async function classifyPhrase(phrase, grounding) {
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
📚 FIDELIDAD AL LIBRO — cuando se te dé "CONTEXTO DEL LIBRO":
8. Completa usando SOLO ideas, términos y tono coherentes con ese contexto.
9. NUNCA inventes conceptos, datos o ideas ajenas al libro para rellenar.
10. Si no puedes completar de forma fiel al contexto del libro, aplica la regla 6
    (recorta al último punto completo) o la 7 (omite). Mejor corto y fiel del libro
    que largo e inventado. La autenticidad pesa más que la longitud.
═══════════════════════════════════════════════════════════════════

EJEMPLO CORRECTO (con contexto del libro):
  contexto:     conceptos del libro incluyen "la conexión entre emociones y eficacia en el trabajo"
  original:     "La clave está en la conexión entre emociones y"
  fixed_phrase: "La clave está en la conexión entre emociones y eficacia en el trabajo."

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

  let groundingBlock = "";
  if (grounding) {
    groundingBlock =
      "\n\nCONTEXTO DEL LIBRO (úsalo para completar FIEL — NO inventes nada fuera de esto):" +
      "\nLibro: \"" + grounding.titulo + "\"" + (grounding.autor ? " — " + grounding.autor : "") +
      (grounding.concepts.length ? "\nConceptos del libro: " + grounding.concepts.join("; ") : "") +
      (grounding.terms.length ? "\nTérminos clave: " + grounding.terms.join(", ") : "") +
      (grounding.voice ? "\nVoz del autor: " + grounding.voice : "");
  }

  const user = "Frase original:\n\"" + phrase + "\"\n\nLongitud original: " + phrase.length +
    " chars.\nSi truncada, devuelve fixed_phrase de longitud ≥ " + phrase.length +
    " chars con TODO el contexto previo preservado." + groundingBlock;

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
  const stats = { books: 0, phrases: 0, truncations: 0, fixed: 0, trimmed: 0, removed: 0, guardrail_skipped: 0, left_fragment: 0, errors: 0 };
  const findings = [];
  const removalQueue = []; // { libro, field, idx, kind }

  for (let bookIdx = 0; bookIdx < librosToAudit.length; bookIdx++) {
    const libro = librosToAudit[bookIdx];
    const isHealing = healingInfo && bookIdx === librosToAudit.length - 1;
    const labelPrefix = isHealing ? "🔁 [HEALING]" : "📖";
    stats.books++;
    const grounding = bookGrounding(libro);          // v3.2 — material del libro
    const phrases = collectPhrases(libro);
    process.stdout.write(labelPrefix + " " + (libro.titulo?.slice(0,55) || "?") + " (" + phrases.length + (grounding ? ", grounded" : ", sin-grounding") + ")... ");
    let book_truncs = 0, book_fixed = 0, book_trimmed = 0, book_removed = 0, book_skipped = 0;
    for (const p of phrases) {
      stats.phrases++;
      try {
        const result = await classifyPhrase(p.value, grounding);
        if (result.truncated && (result.confidence ?? 1) >= 0.65) {
          stats.truncations++;
          book_truncs++;

          let guardrailMsg = null;
          if (result.fixed_phrase) {
            const ratio = result.fixed_phrase.length / p.value.length;
            if (ratio < MIN_PRESERVE_RATIO) {
              guardrailMsg = `fixed_phrase (${result.fixed_phrase.length} chars) is ${(ratio*100).toFixed(0)}% of original (${p.value.length} chars) — sospechoso, omitir`;
              result.fixed_phrase = null;
            }
            else if (p.value.length > 30 && result.fixed_phrase.slice(0, Math.min(20, p.value.length)).trim() !== p.value.slice(0, Math.min(20, p.value.length)).trim()) {
              guardrailMsg = "fixed_phrase no empieza con el original — sospechoso, omitir";
              result.fixed_phrase = null;
            }
          }

          const finding = { libro: libro.titulo, field: p.field, idx: p.idx, original: p.value, ...result, guardrail: guardrailMsg, is_healing: isHealing, resolution: "report_only" };
          findings.push(finding);

          if (MODE === "fix") {
            // ══════════════════════════════════════════════════════════════
            // v3.2 — JERARQUÍA DE REPARACIÓN: completar → recortar → remover
            //   Garantía: una frase truncada NUNCA se queda truncada.
            // ══════════════════════════════════════════════════════════════
            if (result.fixed_phrase) {
              // 1) COMPLETAR (LLM, fiel al libro vía grounding)
              const ok = applyFix(libro, p, result.fixed_phrase);
              if (ok) { stats.fixed++; book_fixed++; finding.resolution = "completed_llm"; }
            } else {
              // 2) RECORTAR determinista a la última oración completa (REPARA, conserva lo bueno)
              const trimmed = trimToLastComplete(p.value);
              const originalTrim = p.value.trim();
              if (trimmed && trimmed !== originalTrim) {
                const ok = applyFix(libro, p, trimmed);
                if (ok) { stats.trimmed++; book_trimmed++; finding.resolution = "trimmed_deterministic"; finding.trimmed_to = trimmed; }
              } else if (!trimmed) {
                // 3) FRAGMENTO PURO (sin ninguna oración completa que rescatar)
                if (p.kind === "string") {
                  // campo obligatorio: no se puede vaciar sin romper render → se deja + log (rarísimo: fallo de generación)
                  finding.resolution = "left_required_fragment";
                  stats.left_fragment++; book_skipped++;
                } else {
                  // pool: encolar remoción (con guarda anti-vacío, se aplica tras el libro)
                  removalQueue.push({ libro, field: p.field, idx: p.idx, kind: p.kind });
                  finding.resolution = "remove_queued";
                }
              } else {
                // trimmed === original → ya terminaba en cierre legítimo; el detector LLM fue dudoso. No tocar.
                finding.resolution = "kept_legitimate_close";
              }
            }
          } else if (guardrailMsg) {
            stats.guardrail_skipped++;
            book_skipped++;
          }
        }
      } catch (e) { stats.errors++; }
    }

    // v3.2 — aplicar remociones de este libro (guarda anti-vacío adentro)
    if (MODE === "fix" && removalQueue.length) {
      const mine = removalQueue.filter(r => r.libro === libro);
      const byField = {};
      mine.forEach(r => { (byField[r.field] = byField[r.field] || []).push(r.idx); });
      for (const field of Object.keys(byField)) {
        const kind = (mine.find(r => r.field === field) || {}).kind;
        const n = removeFromPool(libro, field, byField[field], kind);
        stats.removed += n; book_removed += n;
        const notRemoved = byField[field].length - n;
        if (notRemoved > 0) {
          // la guarda impidió vaciar el pool → recortar esos en su lugar (fallback del fallback)
          findings.filter(f => f.libro === libro.titulo && f.field === field && f.resolution === "remove_queued")
            .forEach(f => { f.resolution = "kept_pool_floor"; });
          stats.left_fragment += notRemoved; book_skipped += notRemoved;
        }
        findings.filter(f => f.libro === libro.titulo && f.field === field && f.resolution === "remove_queued")
          .forEach(f => { f.resolution = "removed_from_pool"; });
      }
      // limpiar la cola de este libro
      for (let i = removalQueue.length - 1; i >= 0; i--) if (removalQueue[i].libro === libro) removalQueue.splice(i, 1);
    }

    let suffix = book_truncs + " truncs";
    if (MODE === "fix") {
      const parts = [];
      if (book_fixed) parts.push(book_fixed + " completadas");
      if (book_trimmed) parts.push(book_trimmed + " recortadas");
      if (book_removed) parts.push(book_removed + " removidas");
      if (book_skipped) parts.push(book_skipped + " sin-tocar");
      suffix += " (" + (parts.length ? parts.join(", ") : "0 cambios") + ")";
    }
    console.log(suffix);
  }

  console.log("");
  console.log("RESUMEN");
  console.log("  libros:", stats.books, "  phrases:", stats.phrases);
  console.log("  truncamientos detectados:", stats.truncations);
  if (MODE === "fix") {
    console.log("  ✅ completadas (LLM, fiel):", stats.fixed);
    console.log("  ✂️  recortadas (determinista):", stats.trimmed);
    console.log("  🗑️  removidas (fragmento puro, pool):", stats.removed);
    console.log("  ⚠️  fragmentos sin tocar (campo obligatorio / piso de pool):", stats.left_fragment);
  }
  console.log("  guardrail-skipped:", stats.guardrail_skipped);
  console.log("  errores:", stats.errors);
  // v3.2 — invariante: en fix, todo truncamiento detectado quedó resuelto salvo left_fragment (rarísimo, logueado)
  if (MODE === "fix") {
    const resolved = stats.fixed + stats.trimmed + stats.removed;
    const pendientes = stats.truncations - resolved - stats.left_fragment;
    console.log("  🛡️  resueltos: " + resolved + " / detectados: " + stats.truncations +
      " (sin resolver no-logueados: " + Math.max(0, pendientes) + ")");
  }
  console.log("");

  if (findings.length > 0) {
    console.log("DETALLE (" + findings.length + " truncamientos):");
    findings.forEach((f, i) => {
      console.log("");
      console.log((i+1) + ". " + (f.is_healing ? "🔁 [HEALING] " : "📖 ") + f.libro);
      console.log("   campo:    " + f.field + (f.idx != null ? "[" + f.idx + "]" : ""));
      console.log("   resolución: " + f.resolution);
      console.log("   ANTES (" + f.original.length + " chars):");
      console.log("      \"" + f.original.slice(0,160) + (f.original.length>160?"...":"") + "\"");
      if (f.fixed_phrase) {
        console.log("   DESPUÉS — completada (" + f.fixed_phrase.length + " chars):");
        console.log("      \"" + f.fixed_phrase.slice(0,160) + (f.fixed_phrase.length>160?"...":"") + "\"");
      } else if (f.trimmed_to) {
        console.log("   DESPUÉS — recortada (" + f.trimmed_to.length + " chars):");
        console.log("      \"" + f.trimmed_to.slice(0,160) + (f.trimmed_to.length>160?"...":"") + "\"");
      } else if (f.resolution === "removed_from_pool") {
        console.log("   DESPUÉS — removida del pool (era fragmento puro)");
      } else if (f.guardrail) {
        console.log("   DESPUÉS: 🛡️ GUARDRAIL: " + f.guardrail);
      } else {
        console.log("   DESPUÉS: (sin fix LLM)");
      }
      console.log("   razón: " + f.reason + " | conf: " + f.confidence);
    });
    const ts = new Date().toISOString().replace(/[:.]/g,"-").slice(0,19);
    const reportPath = "audit-reports/phrase-sanitizer-llm-" + ts + ".json";
    fs.mkdirSync("audit-reports", { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify({ stats, findings, mode: MODE, healing: healingInfo }, null, 2));
    console.log("");
    console.log("📂 Report: " + reportPath);
  }

  // v3.2 — escribir si hubo CUALQUIER modificación (completar, recortar o remover)
  const hadModifications = MODE === "fix" && (stats.fixed + stats.trimmed + stats.removed) > 0;
  const advanceCounter = ONLY_LAST && HEALING && healingInfo && MODE === "fix";

  if (hadModifications || advanceCounter) {
    if (advanceCounter) {
      catalog.meta = catalog.meta || {};
      catalog.meta.healing_rotation_idx = healingInfo.next_rotation;
      catalog.meta.last_healing_book = healingInfo.titulo;
      catalog.meta.last_healing_timestamp = new Date().toISOString();
    }

    if (hadModifications) {
      const bak = CATALOG + ".bak-pre-llm-sanitizer-" + new Date().toISOString().replace(/[:.]/g,"-").slice(0,19);
      fs.writeFileSync(bak, fs.readFileSync(CATALOG));
      console.log("");
      console.log("📦 Backup pre-fix:       " + bak);
    }

    fs.writeFileSync(CATALOG, JSON.stringify(catalog, null, 2));
    console.log("✅ Catálogo actualizado: " + CATALOG);
    if (hadModifications) {
      console.log("   • completadas: " + stats.fixed + "  recortadas: " + stats.trimmed + "  removidas: " + stats.removed);
    }
    if (advanceCounter) console.log("   • healing_rotation_idx: " + healingInfo.rotation_idx + " → " + healingInfo.next_rotation);
  }

  if (healingInfo) {
    console.log("");
    console.log("🔁 Healing rotation summary:");
    console.log("   este run audit:  libros[" + healingInfo.idx + "] = \"" + healingInfo.titulo.slice(0,50) + "\"");
    console.log("   próximo run idx: libros[" + (Math.min(BATCH_SIZE, catalog.libros.length) + healingInfo.next_rotation) + "]");
    console.log("   pool healing:    " + healingInfo.pool_size + " libros (~" + healingInfo.pool_size + " runs por ciclo completo)");
  }
})().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
