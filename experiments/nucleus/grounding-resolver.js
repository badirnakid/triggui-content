/* ═══════════════════════════════════════════════════════════════════════════════
   grounding-resolver.js — FASE 0: GROUND TRUTH MULTI-TIER

   Cascada de fuentes de verdad ordenadas por confianza:
     Tier 1: CURADOR — book_context del usuario (trust=1.0)
     Tier 2: API PÚBLICA — Google Books → OpenLibrary (trust=0.7-0.95)
     Tier 3: INFERENCIA — modelo infiere desde libros similares (trust=0.3-0.6)
     Tier 4: CIEGO — último recurso con warning prominente (trust=0.2)

   Output siempre contiene:
     - ground_truth: texto substantivo sobre el libro
     - grounding_source: "curator"|"google_books"|"openlibrary"|"model_inference"|"unsupported"
     - book_identity_confidence: 0-1 auditable
     - verified_identity: { titulo_real, autor_completo, año } si la fuente lo da
═══════════════════════════════════════════════════════════════════════════════ */

import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const CACHE_DIR = "grounding-cache";
const CACHE_TTL_DAYS = 30;

/* ─────────────────────────────────────────────────────────────────────────────
   CACHE por hash del libro
────────────────────────────────────────────────────────────────────────────── */

function bookHash(titulo, autor) {
  return createHash("sha256").update(`${titulo}|${autor}`.toLowerCase().trim()).digest("hex").slice(0, 16);
}

async function readCache(hash) {
  try {
    const p = path.join(CACHE_DIR, `${hash}.json`);
    const raw = await fs.readFile(p, "utf8");
    const cached = JSON.parse(raw);
    const ageDays = (Date.now() - new Date(cached.cached_at).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > CACHE_TTL_DAYS) return null;
    return cached;
  } catch { return null; }
}

async function writeCache(hash, data) {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const p = path.join(CACHE_DIR, `${hash}.json`);
    await fs.writeFile(p, JSON.stringify({ ...data, cached_at: new Date().toISOString() }, null, 2), "utf8");
  } catch (err) {
    console.warn(`   ⚠ Cache write failed: ${err.message}`);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   MATCH SCORE — qué tan bien un resultado matchea el libro buscado
────────────────────────────────────────────────────────────────────────────── */

function normalize(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function levenshteinRatio(a, b) {
  const A = normalize(a);
  const B = normalize(b);
  if (!A || !B) return 0;
  if (A === B) return 1;
  const matrix = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
  for (let i = 0; i <= A.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= B.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= A.length; i += 1) {
    for (let j = 1; j <= B.length; j += 1) {
      const cost = A[i - 1] === B[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  const maxLen = Math.max(A.length, B.length);
  return 1 - matrix[A.length][B.length] / maxLen;
}

function authorMatchScore(expected, found) {
  const E = normalize(expected);
  const F = normalize(found);
  if (!E || !F) return 0;
  // Si el autor esperado está contenido en el encontrado (CSV "covey" → API "Stephen R. Covey"), match
  if (F.includes(E)) return 1;
  if (E.includes(F)) return 0.9;
  // Match por apellido si el autor esperado es una sola palabra
  const eWords = E.split(" ");
  const fWords = F.split(" ");
  if (eWords.length === 1 && fWords.some((w) => w === E)) return 0.85;
  return levenshteinRatio(E, F);
}

function titleMatchScore(expected, found) {
  return levenshteinRatio(expected, found);
}

/* ─────────────────────────────────────────────────────────────────────────────
   TIER 2a — GOOGLE BOOKS
────────────────────────────────────────────────────────────────────────────── */

async function queryGoogleBooks(titulo, autor, isbn) {
  try {
    let url;
    if (isbn && isbn.trim()) {
      url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn.trim())}&maxResults=3`;
    } else {
      const q = `intitle:${encodeURIComponent(titulo)}+inauthor:${encodeURIComponent(autor)}`;
      url = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=5`;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { method: "GET", headers: { "Accept": "application/json" }, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return { found: false, reason: `http_${res.status}` };
    const data = await res.json();
    if (!data.items || data.items.length === 0) return { found: false, reason: "no_results" };

    let best = null;
    let bestScore = 0;
    for (const item of data.items) {
      const info = item.volumeInfo || {};
      const foundTitle = info.title || "";
      const foundAuthors = Array.isArray(info.authors) ? info.authors.join(", ") : "";
      const titleScore = titleMatchScore(titulo, foundTitle);
      const authorScore = authorMatchScore(autor, foundAuthors);
      const combined = titleScore * 0.55 + authorScore * 0.45;
      if (combined > bestScore) {
        bestScore = combined;
        best = { info, titleScore, authorScore, combined };
      }
    }

    if (!best || bestScore < 0.6) return { found: false, reason: `low_match_${bestScore.toFixed(2)}` };

    const info = best.info;
    const description = String(info.description || "").trim();
    if (description.length < 50) return { found: false, reason: "no_description" };

    return {
      found: true,
      source: "google_books",
      match_score: best.combined,
      title_match: best.titleScore,
      author_match: best.authorScore,
      verified_identity: {
        titulo_real: info.title || titulo,
        subtitulo: info.subtitle || "",
        autor_completo: Array.isArray(info.authors) ? info.authors.join(", ") : autor,
        año: info.publishedDate ? info.publishedDate.slice(0, 4) : null,
        idioma_detectado: info.language || null,
        editorial: info.publisher || null,
        paginas: info.pageCount || null,
        categorias: Array.isArray(info.categories) ? info.categories : []
      },
      synopsis: description
    };
  } catch (err) {
    return { found: false, reason: `error_${err.message.slice(0, 50)}` };
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   TIER 2b — OPENLIBRARY (fallback)
────────────────────────────────────────────────────────────────────────────── */

async function queryOpenLibrary(titulo, autor) {
  try {
    const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(titulo)}&author=${encodeURIComponent(autor)}&limit=5`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { method: "GET", headers: { "Accept": "application/json" }, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return { found: false, reason: `http_${res.status}` };
    const data = await res.json();
    if (!data.docs || data.docs.length === 0) return { found: false, reason: "no_results" };

    let best = null;
    let bestScore = 0;
    for (const doc of data.docs) {
      const foundTitle = doc.title || "";
      const foundAuthors = Array.isArray(doc.author_name) ? doc.author_name.join(", ") : "";
      const titleScore = titleMatchScore(titulo, foundTitle);
      const authorScore = authorMatchScore(autor, foundAuthors);
      const combined = titleScore * 0.55 + authorScore * 0.45;
      if (combined > bestScore) {
        bestScore = combined;
        best = { doc, titleScore, authorScore, combined };
      }
    }

    if (!best || bestScore < 0.6) return { found: false, reason: `low_match_${bestScore.toFixed(2)}` };

    const doc = best.doc;
    const subjects = Array.isArray(doc.subject) ? doc.subject.slice(0, 8).join("; ") : "";
    const synopsis = subjects ? `Temas del libro según OpenLibrary: ${subjects}` : "";
    if (synopsis.length < 30) return { found: false, reason: "no_subjects" };

    return {
      found: true,
      source: "openlibrary",
      match_score: best.combined,
      title_match: best.titleScore,
      author_match: best.authorScore,
      verified_identity: {
        titulo_real: doc.title || titulo,
        autor_completo: Array.isArray(doc.author_name) ? doc.author_name.join(", ") : autor,
        año: doc.first_publish_year ? String(doc.first_publish_year) : null,
        idioma_detectado: Array.isArray(doc.language) ? doc.language[0] : null,
        editorial: Array.isArray(doc.publisher) ? doc.publisher[0] : null,
        paginas: doc.number_of_pages_median || null,
        categorias: Array.isArray(doc.subject) ? doc.subject.slice(0, 5) : []
      },
      synopsis
    };
  } catch (err) {
    return { found: false, reason: `error_${err.message.slice(0, 50)}` };
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   TIER 3 — INFERENCIA DEL MODELO
   Le pregunto al modelo libros similares que SÍ conozca, e infiere tema.
────────────────────────────────────────────────────────────────────────────── */

const INFERENCE_SCHEMA = {
  name: "BookInference",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["book_known_directly", "similar_books", "inferred_theme", "inferred_voice", "inference_confidence"],
    properties: {
      book_known_directly: { type: "boolean" },
      similar_books: {
        type: "array",
        minItems: 2,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["titulo", "autor", "razon"],
          properties: {
            titulo: { type: "string", minLength: 2, maxLength: 100 },
            autor: { type: "string", minLength: 2, maxLength: 80 },
            razon: { type: "string", minLength: 20, maxLength: 200 }
          }
        }
      },
      inferred_theme: { type: "string", minLength: 80, maxLength: 500 },
      inferred_voice: { type: "string", minLength: 60, maxLength: 300 },
      inference_confidence: { type: "number", minimum: 0, maximum: 1 }
    }
  }
};

async function inferFromSimilar(openai, titulo, autor, tagline) {
  const systemPrompt = `Eres un experto en literatura que ayuda a identificar libros poco conocidos.

Cuando te dan un libro que no conoces directamente, tu trabajo es:
1. Evaluar honestamente si conoces ESTE libro específico (book_known_directly).
2. Listar 2-5 libros conocidos que compartan tema/voz/época con el libro buscado, basado en título y autor.
3. Inferir el tema probable del libro desconocido basándote en esos similares.
4. Inferir la voz probable del autor.
5. Reportar inference_confidence honesta: 0.8+ solo si estás muy seguro del género y voz; 0.5-0.7 si es plausible; <0.5 si es conjetura.

NUNCA inventes "este libro dice X". Solo describes tema y voz probable basado en similares.
Siempre en español.`;

  const userPrompt = `Libro buscado:
Título: "${titulo}"
Autor: ${autor}${tagline ? `\nContexto editorial: "${tagline}"` : ""}

¿Conoces ESTE libro específico? Si no, lista libros similares que conozcas y infiere el tema/voz probable.`;

  try {
    const chat = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: INFERENCE_SCHEMA
      }
    });

    let parsed = {};
    try { parsed = JSON.parse(chat.choices[0]?.message?.content || "{}"); } catch { parsed = {}; }

    const similarBooks = Array.isArray(parsed.similar_books) ? parsed.similar_books : [];
    const inferenceConfidence = typeof parsed.inference_confidence === "number" ? parsed.inference_confidence : 0;
    const bookKnownDirectly = typeof parsed.book_known_directly === "boolean" ? parsed.book_known_directly : false;
    const inferredTheme = typeof parsed.inferred_theme === "string" ? parsed.inferred_theme : "(tema no inferido)";
    const inferredVoice = typeof parsed.inferred_voice === "string" ? parsed.inferred_voice : "(voz no inferida)";

    if (similarBooks.length === 0 || !parsed.inferred_theme) {
      return { found: false, reason: "inference_shape_invalid" };
    }

    const similares = similarBooks.map((b) => `- "${b?.titulo || "?"}" (${b?.autor || "?"}): ${b?.razon || "?"}`).join("\n");
    const synopsis = `TEMA INFERIDO (el modelo no conoce este libro directamente, infiere desde similares):

${inferredTheme}

VOZ INFERIDA:
${inferredVoice}

LIBROS SIMILARES QUE COMPARTEN ADN CON ESTE:
${similares}`;

    return {
      found: true,
      source: "model_inference",
      book_known_directly: bookKnownDirectly,
      inference_confidence: inferenceConfidence,
      similar_books: similarBooks,
      synopsis,
      tokens: chat.usage?.total_tokens || 0
    };
  } catch (err) {
    return { found: false, reason: `inference_failed_${err.message.slice(0, 80)}` };
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   RESOLVER PRINCIPAL
────────────────────────────────────────────────────────────────────────────── */

export async function resolveGrounding(openai, book, inputs = {}) {
  const titulo = String(book.titulo || "").trim();
  const autor = String(book.autor || "").trim();
  const isbn = String(book.isbn || "").trim();
  const bookContext = String(inputs.bookContext || "").trim();

  const hash = bookHash(titulo, autor);

  // ── TIER 1: CURADOR (siempre prioritario si sustantivo)
  if (bookContext.length >= 100) {
    const result = {
      ground_truth: `CONTEXTO DEL CURADOR (máxima autoridad):\n\n${bookContext}`,
      grounding_source: "curator",
      book_identity_confidence: 1.0,
      verified_identity: { titulo_real: titulo, autor_completo: autor, año: null },
      resolution_path: ["tier1_curator"],
      tier_reached: 1,
      cost_tokens: 0
    };
    console.log(`   🎯 Tier 1: CURADOR (${bookContext.length} chars)`);
    return result;
  }

  // Cache lookup (solo para Tier 2+, el curador siempre gana)
  const cached = await readCache(hash);
  if (cached && cached.grounding_source !== "curator") {
    console.log(`   💾 Cache hit: ${cached.grounding_source} (trust ${cached.book_identity_confidence.toFixed(2)})`);
    return { ...cached, from_cache: true, resolution_path: [`cache_${cached.grounding_source}`] };
  }

  const resolutionPath = [];

  // ── TIER 2a: GOOGLE BOOKS
  console.log(`   🔍 Tier 2a: Google Books...`);
  const gb = await queryGoogleBooks(titulo, autor, isbn);
  resolutionPath.push(`tier2a_${gb.found ? "hit" : "miss"}_${gb.reason || gb.match_score?.toFixed(2)}`);
  if (gb.found && gb.match_score >= 0.75) {
    const result = {
      ground_truth: `SINOPSIS OFICIAL (Google Books):\n\n${gb.synopsis}\n\nMETADATA VERIFICADA:\n- Título: ${gb.verified_identity.titulo_real}\n- Autor: ${gb.verified_identity.autor_completo}${gb.verified_identity.año ? `\n- Año: ${gb.verified_identity.año}` : ""}${gb.verified_identity.editorial ? `\n- Editorial: ${gb.verified_identity.editorial}` : ""}${gb.verified_identity.categorias.length ? `\n- Categorías: ${gb.verified_identity.categorias.join(", ")}` : ""}`,
      grounding_source: "google_books",
      book_identity_confidence: Math.min(0.95, 0.6 + gb.match_score * 0.35),
      verified_identity: gb.verified_identity,
      match_score: gb.match_score,
      resolution_path: resolutionPath,
      tier_reached: 2,
      cost_tokens: 0
    };
    console.log(`   ✓ Google Books match=${gb.match_score.toFixed(2)} (title=${gb.title_match.toFixed(2)}, author=${gb.author_match.toFixed(2)})`);
    await writeCache(hash, result);
    return result;
  }

  // ── TIER 2b: OPENLIBRARY
  console.log(`   🔍 Tier 2b: OpenLibrary...`);
  const ol = await queryOpenLibrary(titulo, autor);
  resolutionPath.push(`tier2b_${ol.found ? "hit" : "miss"}_${ol.reason || ol.match_score?.toFixed(2)}`);
  if (ol.found && ol.match_score >= 0.7) {
    const result = {
      ground_truth: `INFORMACIÓN PARCIAL (OpenLibrary):\n\n${ol.synopsis}\n\nMETADATA VERIFICADA:\n- Título: ${ol.verified_identity.titulo_real}\n- Autor: ${ol.verified_identity.autor_completo}${ol.verified_identity.año ? `\n- Año: ${ol.verified_identity.año}` : ""}`,
      grounding_source: "openlibrary",
      book_identity_confidence: Math.min(0.8, 0.4 + ol.match_score * 0.4),
      verified_identity: ol.verified_identity,
      match_score: ol.match_score,
      resolution_path: resolutionPath,
      tier_reached: 2,
      cost_tokens: 0
    };
    console.log(`   ✓ OpenLibrary match=${ol.match_score.toFixed(2)}`);
    await writeCache(hash, result);
    return result;
  }

  // ── TIER 3: INFERENCIA DEL MODELO
  console.log(`   🧠 Tier 3: Model inference...`);
  const inf = await inferFromSimilar(openai, titulo, autor, book.tagline);
  resolutionPath.push(`tier3_${inf.found ? `conf_${inf.inference_confidence?.toFixed(2)}` : "failed"}`);
  if (inf.found && inf.inference_confidence >= 0.4) {
    const tier = inf.book_known_directly ? 2 : 3;
    const penaltyMultiplier = inf.book_known_directly ? 0.85 : 0.55;
    const result = {
      ground_truth: inf.synopsis,
      grounding_source: "model_inference",
      book_identity_confidence: inf.inference_confidence * penaltyMultiplier,
      verified_identity: { titulo_real: titulo, autor_completo: autor, año: null },
      inference_confidence: inf.inference_confidence,
      book_known_directly: inf.book_known_directly,
      similar_books: inf.similar_books,
      resolution_path: resolutionPath,
      tier_reached: tier,
      cost_tokens: inf.tokens
    };
    console.log(`   ✓ Inferencia: known=${inf.book_known_directly}, conf=${inf.inference_confidence.toFixed(2)}`);
    await writeCache(hash, result);
    return result;
  }

  // ── TIER 4: CIEGO (último recurso)
  console.log(`   ⚠ Tier 4: CIEGO — ningún ground truth disponible`);
  return {
    ground_truth: `SIN FUENTE AUTORITATIVA. El modelo no reconoce este libro y las APIs públicas no lo encontraron. Opera con lo que sea plausible dado título y autor, pero reconoce incertidumbre.`,
    grounding_source: "unsupported",
    book_identity_confidence: 0.2,
    verified_identity: { titulo_real: titulo, autor_completo: autor, año: null },
    resolution_path: [...resolutionPath, "tier4_blind"],
    tier_reached: 4,
    warning: "Este libro no pudo ser verificado. Considera agregar book_context manual.",
    cost_tokens: inf.tokens || 0
  };
}
