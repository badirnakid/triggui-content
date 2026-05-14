// scripts/cascade-final.mjs
// 🧬 CASCADE FINAL con Google Books (API key) — Apple MX/US + Google + OpenLib + OpenLib ISBN.

import fs from "node:fs/promises";

const CONTENT_DIR = "/workspaces/triggui-content";
const MIN_BYTES = 2048;
const THRESHOLD_WITH_AUTHOR = 0.55;
const THRESHOLD_NO_AUTHOR = 0.70;
const GOOGLE_KEY = process.env.GOOGLE_BOOKS_API_KEY || "";

if (!GOOGLE_KEY) console.warn("⚠️  GOOGLE_BOOKS_API_KEY no definida — Google Books desactivado");

const STOPWORDS = new Set([
  "el","la","los","las","un","una","unos","unas","de","del","en","con","por",
  "para","tu","su","mi","y","o","u","que","se","es","al","lo","ser","ya","no",
  "sus","como","mas","muy","sin","sobre","entre","cuando","si","este","esta",
  "esto","estos","estas","esa","eso","esas","esos",
  "the","a","an","of","in","on","at","to","for","with","by","from","and",
  "or","but","is","are","be","been","being","this","that","these","those",
  "as","it","its","jr","sr",
]);

const KNOWN_ORIGINAL_TITLES = {
  "la pequena casa en la pradera": "Little House on the Prairie",
  "la sastreria de gloucester": "The Tailor of Gloucester",
  "la telarana de carlota": "Charlotte's Web",
  "la casa del arbol el valle de los dinosaurios": "Magic Tree House Dinosaurs",
  "pequeno libro de instrucciones para la vida": "Life's Little Instruction Book",
};

const norm = (s) => String(s || "")
  .toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[\.,;]/g, " ")
  .replace(/\s+/g, " ").trim();

const sigWords = (s) => norm(s).split(/[\s\-_:;()¿?¡!"']+/)
  .filter(w => w.length > 2 && !STOPWORDS.has(w));

function smartMatch(target, found) {
  const t = sigWords(target);
  const f = norm(found);
  if (!t.length || !f) return 0;
  let hits = 0;
  for (const w of t) if (f.includes(w)) hits++;
  return hits / t.length;
}

function evaluateCandidate(variantQuery, candidate, targetAuthor) {
  const matchTitulo = smartMatch(variantQuery, candidate.title);
  let matchAutor = null;
  let threshold = THRESHOLD_NO_AUTHOR;
  let finalScore;
  if (targetAuthor && targetAuthor !== "Autor desconocido" && targetAuthor.trim()) {
    matchAutor = smartMatch(targetAuthor, candidate.author);
    threshold = THRESHOLD_WITH_AUTHOR;
    finalScore = matchTitulo * 0.65 + matchAutor * 0.35;
  } else {
    finalScore = matchTitulo;
  }
  return { matchTitulo, matchAutor, finalScore, threshold, passes: finalScore >= threshold };
}

function generateVariants(titulo) {
  const v = [];
  const t = titulo.trim();
  v.push({ name: "v1_original", q: t, useAuthor: true });
  const cutMatch = t.match(/^(.+?)\s*[:(—–]/);
  if (cutMatch && cutMatch[1] !== t && cutMatch[1].length > 3) {
    v.push({ name: "v2_sin_subtitulo", q: cutMatch[1].trim(), useAuthor: true });
  }
  const dotMatch = t.match(/^(.+?)\.\s+\w/);
  if (dotMatch && dotMatch[1].length > 3 && !v.some(x => x.q === dotMatch[1].trim())) {
    v.push({ name: "v2b_sin_frase_final", q: dotMatch[1].trim(), useAuthor: true });
  }
  const words = t.split(/\s+/);
  if (words.length > 4) {
    const short = words.slice(0, 4).join(" ");
    if (!v.some(x => x.q === short)) {
      v.push({ name: "v3_primeras_4", q: short, useAuthor: true });
    }
  }
  const eng = KNOWN_ORIGINAL_TITLES[norm(t)];
  if (eng) v.push({ name: "v4_titulo_ingles", q: eng, useAuthor: true });
  v.push({ name: "v5_solo_titulo_sin_autor", q: t, useAuthor: false });
  return v;
}

async function checkUrl(url) {
  if (!url) return null;
  try {
    let res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(6000), redirect: "follow" });
    if (!res.ok || !res.headers.get("content-length")) {
      res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(6000), redirect: "follow" });
      if (!res.headers.get("content-length") && res.ok) {
        const buf = await res.arrayBuffer();
        return { ok: buf.byteLength >= MIN_BYTES, status: res.status, bytes: buf.byteLength };
      }
    }
    const len = parseInt(res.headers.get("content-length") || "0", 10);
    return { ok: res.ok && len >= MIN_BYTES, status: res.status, bytes: len };
  } catch (_) { return null; }
}

async function searchApple(query, autor, country) {
  try {
    const term = (autor ? `${query} ${autor}` : query).trim().slice(0, 200);
    if (!term) return [];
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=ebook&limit=5&country=${country}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const d = await r.json();
    if (!d.results?.length) return [];
    return d.results.map(x => ({
      source: `apple_${country}`,
      title: x.trackName || "",
      author: x.artistName || "",
      url: x.artworkUrl100?.replace(/\/(\d+x\d+)bb\.(jpg|png)/, "/2400x2400bb.$2") || null,
      isbn: x.artworkUrl100?.match(/\/(\d{10,13})\.(jpg|png|jpeg)/i)?.[1] || null,
    })).filter(x => x.url);
  } catch (_) { return []; }
}

async function searchGoogle(query, autor, mode) {
  if (!GOOGLE_KEY) return [];
  try {
    let q;
    if (mode === "strict") q = autor ? `intitle:"${query}" inauthor:"${autor}"` : `intitle:"${query}"`;
    else q = (autor ? `${query} ${autor}` : query).trim();
    if (!q) return [];
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5&key=${GOOGLE_KEY}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const d = await r.json();
    if (!d.items?.length) return [];
    return d.items.map(v => {
      const info = v.volumeInfo;
      const il = info?.imageLinks || {};
      // Tomar el más grande disponible (fix de bug v3)
      const rawUrl = il.extraLarge || il.large || il.medium || il.small || il.thumbnail || il.smallThumbnail || null;
      const cleanUrl = rawUrl ? rawUrl.replace("http://", "https://").replace("&edge=curl", "") : null;
      // Extraer ISBN si disponible
      const isbn = info?.industryIdentifiers?.find(x => x.type === "ISBN_13" || x.type === "ISBN_10")?.identifier || null;
      return {
        source: `google_${mode}`,
        title: info?.title || "",
        author: info?.authors?.join(", ") || "",
        url: cleanUrl,
        isbn,
      };
    }).filter(x => x.url);
  } catch (_) { return []; }
}

async function searchOpenLibrary(query, autor) {
  try {
    const params = new URLSearchParams();
    if (query) params.set("title", query);
    if (autor) params.set("author", autor);
    params.set("limit", "5");
    if (![...params].length) return [];
    const url = `https://openlibrary.org/search.json?${params}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return [];
    const d = await r.json();
    if (!d.docs?.length) return [];
    return d.docs.filter(x => x.cover_i || x.isbn?.length).map(x => ({
      source: "openlib_search",
      title: x.title || "",
      author: x.author_name?.[0] || "",
      url: x.cover_i ? `https://covers.openlibrary.org/b/id/${x.cover_i}-L.jpg` : null,
      isbn: x.isbn?.[0] || null,
    })).filter(x => x.url || x.isbn);
  } catch (_) { return []; }
}

const openlibIsbnUrl = (isbn) => `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;

async function findCandidates(titulo, autor) {
  const variants = generateVariants(titulo);
  const allCandidates = [];

  for (const v of variants) {
    const eff_autor = v.useAuthor ? autor : "";
    const results = (await Promise.all([
      searchApple(v.q, eff_autor, "mx"),
      searchApple(v.q, eff_autor, "us"),
      searchGoogle(v.q, eff_autor, "strict"),
      searchGoogle(v.q, eff_autor, "relaxed"),
      searchOpenLibrary(v.q, eff_autor),
    ])).flat();

    for (const r of results) {
      const evalRes = evaluateCandidate(v.q, r, eff_autor);
      if (evalRes.passes) {
        allCandidates.push({ ...r, ...evalRes, variant: v.name });
      }
    }
  }

  // OpenLib ISBN lookup
  const isbnsFound = new Set();
  for (const c of allCandidates) if (c.isbn) isbnsFound.add(c.isbn);
  for (const isbn of isbnsFound) {
    const url = openlibIsbnUrl(isbn);
    if (allCandidates.some(c => c.url === url)) continue;
    allCandidates.push({
      source: "openlib_isbn_lookup",
      title: `(via ISBN ${isbn})`,
      author: autor,
      url, isbn,
      matchTitulo: 1.0, matchAutor: 1.0, finalScore: 0.99,
      variant: "isbn_lookup", passes: true,
    });
  }

  const seen = new Set();
  const unique = allCandidates.filter(c => {
    if (seen.has(c.url)) return false;
    seen.add(c.url); return true;
  });
  unique.sort((a, b) => b.finalScore - a.finalScore);

  const top3 = [];
  for (const c of unique) {
    if (top3.length >= 3) break;
    const check = await checkUrl(c.url);
    if (check?.ok) top3.push({ ...c, validation: check });
  }
  return top3;
}

async function main() {
  console.log("🧬 CASCADE FINAL — Apple MX/US + Google Books (con key) + OpenLib + OpenLib ISBN\n");
  console.log(`Google Books: ${GOOGLE_KEY ? "✅ con API key" : "❌ DESACTIVADO (sin key)"}\n`);

  const audit = JSON.parse(await fs.readFile(`${CONTENT_DIR}/audit-portadas-fallback.json`, "utf8"));
  console.log(`📋 Procesando ${audit.length} libros\n`);

  const results = [];
  for (const lib of audit) {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📚 [${lib.catalog}] "${lib.titulo_json}"`);
    const autor = lib.autor_csv || lib.autor_json || "";
    console.log(`   autor: "${autor}"`);

    const t0 = Date.now();
    const candidates = await findCandidates(lib.titulo_json, autor);
    const elapsed = Date.now() - t0;
    results.push({ ...lib, candidates, elapsed_ms: elapsed });

    if (candidates.length) {
      console.log(`   ✅ ${candidates.length} candidato(s)  (${elapsed}ms)\n`);
      candidates.forEach((c, i) => {
        const ma = c.matchAutor !== null ? ` autor=${c.matchAutor.toFixed(2)}` : "";
        console.log(`   #${i+1}  final=${c.finalScore.toFixed(2)} (tit=${c.matchTitulo.toFixed(2)}${ma}) via ${c.variant} (${c.source})`);
        console.log(`        título: "${c.title}"`);
        console.log(`        autor:  "${c.author}"`);
        console.log(`        bytes:  ${c.validation.bytes}`);
        console.log(`        URL:    ${c.url}\n`);
      });
    } else {
      console.log(`   ❌ sin candidatos  (${elapsed}ms)\n`);
    }
  }

  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("🏆 RESUMEN");
  console.log("══════════════════════════════════════════════════════════════");
  const ok = results.filter(r => r.candidates.length > 0);
  const fail = results.filter(r => r.candidates.length === 0);
  console.log(`✅ Con candidatos: ${ok.length}/${results.length}`);
  console.log(`❌ Sin candidatos: ${fail.length}/${results.length}`);
  if (fail.length) {
    console.log(`\n🆘 Sin candidatos (curación manual):`);
    for (const r of fail) console.log(`   [${r.catalog}] "${r.titulo_json}"`);
  }

  console.log(`\n📋 TABLA — verifica visualmente cada URL:\n`);
  for (const r of results) {
    console.log(`[${r.catalog.padEnd(7)}] "${r.titulo_json}"`);
    if (!r.candidates.length) { console.log(`            ❌ sin candidatos\n`); continue; }
    r.candidates.forEach((c, i) => {
      console.log(`   #${i+1} (${c.finalScore.toFixed(2)}) "${c.title}" — ${c.author}`);
      console.log(`        ${c.url}`);
    });
    console.log("");
  }

  await fs.writeFile(`${CONTENT_DIR}/recovery-final.json`, JSON.stringify(results, null, 2));
  console.log(`💾 ${CONTENT_DIR}/recovery-final.json`);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
