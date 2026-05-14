// scripts/audit-portadas-fallback.mjs
// 🩺 NIVEL DIOS — Diagnóstico STANDALONE de portadas SVG fallback.
// No depende del nucleus. Reimplementa el cascade Apple+Google+OpenLibrary
// llamando directo a las APIs públicas. Reporta por libro qué API encontró
// match, si la cover URL responde con tamaño válido, y clasifica causa raíz.

import fs from "node:fs/promises";
import { parse } from "csv-parse/sync";

const CONTENT_DIR = "/workspaces/triggui-content";
const PATHS = {
  csv_adult:  `${CONTENT_DIR}/data/libros_master.csv`,
  csv_kids:   `${CONTENT_DIR}/data/libros_master_kids.csv`,
  json_adult: `${CONTENT_DIR}/contenido.json`,
  json_kids:  `${CONTENT_DIR}/contenido_kids.json`,
};

const MIN_COVER_BYTES = 2048; // misma regla que checkImageURL del nucleus

const isSvgFallback = (s) => typeof s === "string" && s.startsWith("data:image/svg");
const norm = (s) => String(s || "").toLowerCase().trim();

async function loadCSV(p) {
  return parse(await fs.readFile(p, "utf8"), { columns: true, skip_empty_lines: true });
}
async function loadJSON(p) { return JSON.parse(await fs.readFile(p, "utf8")); }

function findInCsv(csv, titulo) {
  const t = norm(titulo);
  if (!t) return null;
  for (const row of csv) {
    const c = norm(row.titulo);
    if (!c) continue;
    if (c === t || c.includes(t) || t.includes(c)) return row;
  }
  return null;
}

// Score básico: % de palabras del título buscado que aparecen en el devuelto
function matchScore(targetTitle, foundTitle) {
  const target = norm(targetTitle).split(/\s+/).filter((w) => w.length > 2);
  const found = norm(foundTitle);
  if (!target.length || !found) return 0;
  let hits = 0;
  for (const w of target) if (found.includes(w)) hits++;
  return hits / target.length;
}

// Devuelve { ok, contentLength, status } — true si responde 200 y >2KB
async function checkImageURL(url, timeoutMs = 6000) {
  if (!url) return { ok: false, status: 0, contentLength: 0 };
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    // HEAD primero (más rápido), fallback a GET si el server no soporta HEAD
    let res = await fetch(url, { method: "HEAD", signal: controller.signal, redirect: "follow" });
    if (!res.ok || !res.headers.get("content-length")) {
      // algunos servers no responden HEAD bien — fallback a GET parcial
      res = await fetch(url, { method: "GET", signal: controller.signal, redirect: "follow" });
    }
    clearTimeout(t);
    const len = parseInt(res.headers.get("content-length") || "0", 10);
    const ok = res.ok && len >= MIN_COVER_BYTES;
    return { ok, status: res.status, contentLength: len };
  } catch (err) {
    return { ok: false, status: 0, contentLength: 0, error: String(err).slice(0, 80) };
  }
}

// ─── APPLE BOOKS (iTunes Search) ──────────────────────────────────────
async function fetchApple(titulo, autor) {
  const out = { ok: false, n_covers: 0, isbn: null, match: 0, best_url: null };
  try {
    const term = `${titulo} ${autor}`.trim().slice(0, 200);
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=ebook&limit=5&country=mx`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return out;
    const data = await res.json();
    if (!data.results?.length) return out;
    // Mejor match por título
    let best = null, bestScore = 0;
    for (const r of data.results) {
      const s = matchScore(titulo, r.trackName);
      if (s > bestScore) { bestScore = s; best = r; }
    }
    if (!best || bestScore < 0.3) return out;
    out.ok = true;
    out.match = bestScore;
    out.isbn = String(best.trackId || "");
    // Apple artwork: 100x100 → reemplazar por 2400x2400bb.jpg para grande
    if (best.artworkUrl100) {
      out.best_url = best.artworkUrl100.replace(/\/(\d+x\d+)bb\.(jpg|png)/, "/2400x2400bb.$2");
      out.n_covers = 1;
    }
  } catch (_) {}
  return out;
}

// ─── GOOGLE BOOKS ─────────────────────────────────────────────────────
async function fetchGoogle(titulo, autor) {
  const out = { ok: false, n_covers: 0, isbn: null, match: 0, best_url: null };
  try {
    const q = autor ? `intitle:"${titulo}" inauthor:"${autor}"` : `intitle:"${titulo}"`;
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return out;
    const data = await res.json();
    if (!data.items?.length) return out;
    let best = null, bestScore = 0;
    for (const v of data.items) {
      const s = matchScore(titulo, v.volumeInfo?.title);
      if (s > bestScore) { bestScore = s; best = v; }
    }
    if (!best || bestScore < 0.3) return out;
    out.ok = true;
    out.match = bestScore;
    const idents = best.volumeInfo?.industryIdentifiers || [];
    out.isbn = idents.find((i) => i.type === "ISBN_13")?.identifier ||
              idents.find((i) => i.type === "ISBN_10")?.identifier || null;
    const thumb = best.volumeInfo?.imageLinks?.thumbnail || best.volumeInfo?.imageLinks?.smallThumbnail;
    if (thumb) {
      out.best_url = thumb.replace("http://", "https://").replace("&edge=curl", "") + "&fife=w800";
      out.n_covers = 1;
    }
  } catch (_) {}
  return out;
}

// ─── OPENLIBRARY ──────────────────────────────────────────────────────
async function fetchOpenLibrary(titulo, autor) {
  const out = { ok: false, n_covers: 0, isbn: null, match: 0, best_url: null };
  try {
    const params = new URLSearchParams();
    params.set("title", titulo);
    if (autor) params.set("author", autor);
    params.set("limit", "5");
    const url = `https://openlibrary.org/search.json?${params}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return out;
    const data = await res.json();
    if (!data.docs?.length) return out;
    let best = null, bestScore = 0;
    for (const d of data.docs) {
      const s = matchScore(titulo, d.title);
      if (s > bestScore) { bestScore = s; best = d; }
    }
    if (!best || bestScore < 0.3) return out;
    out.ok = true;
    out.match = bestScore;
    out.isbn = best.isbn?.[0] || null;
    if (best.cover_i) {
      out.best_url = `https://covers.openlibrary.org/b/id/${best.cover_i}-L.jpg`;
      out.n_covers = 1;
    }
  } catch (_) {}
  return out;
}

async function auditOne(book, csvRow, catalog) {
  const autor_for_fetch = csvRow?.autor || book.autor || "";
  const r = {
    catalog,
    titulo_json: book.titulo,
    autor_json:  book.autor,
    isbn_json:   book.isbn || "",
    autor_csv:   csvRow?.autor || null,
    isbn_csv:    csvRow?.isbn  || null,
    portada_csv: csvRow?.portada || null,
    autor_for_fetch,
    apple:   null,
    google:  null,
    openlib: null,
    covers_validated: [],
    valid_covers: 0,
    best_url: null,
    best_source: null,
    conclusion: null,
  };

  const [apple, google, openlib] = await Promise.all([
    fetchApple(book.titulo, autor_for_fetch),
    fetchGoogle(book.titulo, autor_for_fetch),
    fetchOpenLibrary(book.titulo, autor_for_fetch),
  ]);
  r.apple = apple; r.google = google; r.openlib = openlib;

  // Validar las cover URLs encontradas
  const candidates = [
    { source: "apple_books",  url: apple.best_url,  match: apple.match },
    { source: "google_books", url: google.best_url, match: google.match },
    { source: "openlibrary",  url: openlib.best_url, match: openlib.match },
  ].filter((c) => c.url);

  for (const c of candidates) {
    const check = await checkImageURL(c.url);
    r.covers_validated.push({ source: c.source, url: c.url, match: c.match, ...check });
  }
  const validCovers = r.covers_validated.filter((c) => c.ok);
  r.valid_covers = validCovers.length;
  if (validCovers.length) {
    // Preferencia: Apple > Google > OpenLibrary
    const order = ["apple_books", "google_books", "openlibrary"];
    validCovers.sort((a, b) => order.indexOf(a.source) - order.indexOf(b.source));
    r.best_url = validCovers[0].url;
    r.best_source = validCovers[0].source;
  }

  // ─── Clasificación de causa raíz ──────────────────────────────────
  const anyApiOk = apple.ok || google.ok || openlib.ok;
  const totalRawCovers = (apple.n_covers || 0) + (google.n_covers || 0) + (openlib.n_covers || 0);

  if (r.valid_covers > 0) {
    if (csvRow && csvRow.autor && csvRow.autor !== book.autor) {
      r.conclusion = "HIPOTESIS_A_CONFIRMADA:autor_desincronizado_csv_vs_json";
    } else {
      r.conclusion = "HIPOTESIS_C_CONFIRMADA:cache_o_run_estocastico_anterior";
    }
  } else if (!anyApiOk) {
    r.conclusion = "HIPOTESIS_E:ninguna_api_responde_con_match_solido";
  } else if (totalRawCovers > 0) {
    r.conclusion = "HIPOTESIS_F:apis_devuelven_covers_pero_validacion_HTTP_las_rechaza";
  } else {
    r.conclusion = "HIPOTESIS_G:apis_matchearon_pero_response_sin_cover_url";
  }

  return r;
}

async function main() {
  console.log("🩺 AUDITORÍA STANDALONE — Portadas SVG fallback\n");

  const [csvAdult, csvKids, jsonAdult, jsonKids] = await Promise.all([
    loadCSV(PATHS.csv_adult), loadCSV(PATHS.csv_kids),
    loadJSON(PATHS.json_adult), loadJSON(PATHS.json_kids),
  ]);

  const affected = [
    ...jsonAdult.libros.filter((b) => isSvgFallback(b.portada))
      .map((b) => ({ book: b, csvRow: findInCsv(csvAdult, b.titulo), catalog: "adulto" })),
    ...jsonKids.libros.filter((b) => isSvgFallback(b.portada))
      .map((b) => ({ book: b, csvRow: findInCsv(csvKids, b.titulo), catalog: "kids" })),
  ];

  console.log(`📊 Total afectados: ${affected.length}`);
  console.log(`   • adulto: ${affected.filter((a) => a.catalog === "adulto").length}/${jsonAdult.libros.length}`);
  console.log(`   • kids:   ${affected.filter((a) => a.catalog === "kids").length}/${jsonKids.libros.length}\n`);

  if (!affected.length) {
    console.log("🎉 Cero libros afectados. Nada que diagnosticar.");
    return;
  }

  const results = [];
  for (const { book, csvRow, catalog } of affected) {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📚 [${catalog}] "${book.titulo}"`);
    console.log(`   JSON  autor="${book.autor}"  isbn="${book.isbn || ""}"`);
    if (csvRow) {
      const flag = csvRow.autor === book.autor ? "✓ match" : "⚠️  DIFIERE";
      console.log(`   CSV   autor="${csvRow.autor || ""}"  isbn="${csvRow.isbn || ""}"  ${flag}`);
    } else {
      console.log(`   CSV   ❌ NO ENCONTRADO`);
    }
    console.log(`   → fetch con autor="${(csvRow?.autor || book.autor || "")}"`);
    const r = await auditOne(book, csvRow, catalog);
    results.push(r);
    console.log(`   ⚡ Apple    ${r.apple.ok ? "✓" : "✗"}  match=${r.apple.match.toFixed(2)}  isbn=${r.apple.isbn || "—"}  url=${r.apple.best_url ? r.apple.best_url.slice(0, 60) : "—"}`);
    console.log(`   ⚡ Google   ${r.google.ok ? "✓" : "✗"}  match=${r.google.match.toFixed(2)}  isbn=${r.google.isbn || "—"}  url=${r.google.best_url ? r.google.best_url.slice(0, 60) : "—"}`);
    console.log(`   ⚡ OpenLib  ${r.openlib.ok ? "✓" : "✗"}  match=${r.openlib.match.toFixed(2)}  isbn=${r.openlib.isbn || "—"}  url=${r.openlib.best_url ? r.openlib.best_url.slice(0, 60) : "—"}`);
    if (r.covers_validated.length) {
      console.log(`   🔬 Validación HTTP de URLs encontradas:`);
      for (const c of r.covers_validated) {
        console.log(`      ${c.ok ? "✓" : "✗"} ${c.source.padEnd(12)} status=${c.status} bytes=${c.contentLength}${c.error ? ` err=${c.error}` : ""}`);
      }
    }
    console.log(`   📦 Valid covers: ${r.valid_covers}${r.best_url ? `  → ${r.best_source}: ${r.best_url.slice(0, 80)}` : ""}`);
    console.log(`   🧭 ${r.conclusion}\n`);
  }

  // ─── PATRONES AGREGADOS ──────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("🏆 PATRONES");
  console.log("══════════════════════════════════════════════════════════════");

  const byConclusion = {};
  for (const r of results) byConclusion[r.conclusion] = (byConclusion[r.conclusion] || 0) + 1;
  console.log("\nPor causa raíz:");
  for (const [c, n] of Object.entries(byConclusion).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${n}× ${c}`);
  }

  const recovered = results.filter((r) => r.valid_covers > 0);
  const stillBad  = results.filter((r) => r.valid_covers === 0);

  console.log(`\n🟢 ${recovered.length}/${results.length} recuperan cover válido con autor del CSV`);
  console.log(`🔴 ${stillBad.length}/${results.length} NO recuperan ni con autor del CSV`);

  const autorMismatches = results.filter((r) => r.autor_csv && r.autor_csv !== r.autor_json);
  if (autorMismatches.length) {
    console.log(`\n⚠️  ${autorMismatches.length} libros con autor desincronizado CSV ↔ JSON:`);
    for (const r of autorMismatches) {
      console.log(`   [${r.catalog}] "${r.titulo_json}"`);
      console.log(`      CSV:  "${r.autor_csv}"`);
      console.log(`      JSON: "${r.autor_json}"`);
    }
  }

  const noCsv = results.filter((r) => !r.autor_csv);
  if (noCsv.length) {
    console.log(`\n❌ ${noCsv.length} libros que NO matchearon en CSV (findInCsv falló):`);
    for (const r of noCsv) {
      console.log(`   [${r.catalog}] "${r.titulo_json}"  JSON.autor="${r.autor_json}"`);
    }
  }

  if (recovered.length) {
    console.log(`\n✨ LIBROS LISTOS para regenerar (cover URL ya validada):`);
    for (const r of recovered) {
      console.log(`   [${r.catalog}] "${r.titulo_json}"`);
      console.log(`      → ${r.best_source}: ${r.best_url}`);
    }
  }

  const outPath = `${CONTENT_DIR}/audit-portadas-fallback.json`;
  await fs.writeFile(outPath, JSON.stringify(results, null, 2), "utf8");
  console.log(`\n💾 Detalle JSON completo: ${outPath}`);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
