/**
 * ════════════════════════════════════════════════════════════════════════════
 * lens-compatibility-scorer.js — CALCULA _lens_compatibility POR LIBRO
 * ════════════════════════════════════════════════════════════════════════════
 *
 * QUÉ HACE ESTE ARCHIVO
 * ─────────────────────
 * Después de que el motor genera el contenido editorial de un libro, este
 * archivo hace UNA llamada LLM adicional que produce el vector de
 * compatibilidad del libro con cada lente activo:
 *
 *   {
 *     "self-knowledge": 0.92,
 *     "game-theory":    0.15,
 *     "hawkins":        0.78,
 *     "chronobiology":  0.40,
 *     "pilares": {
 *       "cuerpo":      0.20,
 *       "mente":       0.65,
 *       "negocio":     0.05,
 *       "familia":     0.85,
 *       "espiritu":    0.80,
 *       "relaciones":  0.95,
 *       "finanzas":    0.05
 *     }
 *   }
 *
 * Este vector se guarda en `_lens_compatibility` del libro en `contenido.json`,
 * y es lo que después la app.triggui.com usa para hacer matching matemático
 * en runtime sin necesidad de LLM en cada consulta.
 *
 * POR QUÉ EXISTE
 * ──────────────
 * La inteligencia se cristaliza en la generación: el LLM razona UNA vez
 * sobre cada libro, decide cuán compatible es con cada lente, y guarda
 * los scores. Después, cuando el usuario en app.triggui.com pide una
 * recomendación, el sistema solo hace matemática vectorial sobre estos
 * scores ya pre-calculados. Cero LLM en runtime, costo cero, latencia
 * <50ms a cualquier escala.
 *
 * COSTO
 * ─────
 * 1 llamada LLM extra por libro generado:
 *   - Modelo: gpt-4o-mini
 *   - Input: ~1500 tokens (anchors + content snippets + lens definitions)
 *   - Output: ~200 tokens (JSON con scores)
 *   - Costo: ~$0.0003 por libro
 *
 * En batch de 20 libros: ~$0.006 extra por batch. Trivial.
 *
 * CÓMO SE USA
 * ───────────
 *   import { scoreLensCompatibility } from './lens-compatibility-scorer.js';
 *
 *   const lensCompat = await scoreLensCompatibility(openai, {
 *     book,
 *     groundTruth,
 *     anchors: anchorsData,
 *     contentES: contentESFinal,
 *   });
 *
 *   mapped._lens_compatibility = lensCompat;
 *
 * ════════════════════════════════════════════════════════════════════════════
 */

import { getActiveLenses } from "./prompt-composer.js";

// Lista de los 7 pilares (debe coincidir con prompts/lenses/pilares.md)
const PILARES = ["cuerpo", "mente", "negocio", "familia", "espiritu", "relaciones", "finanzas"];

/**
 * Construye el system prompt para el scorer.
 * El prompt es DETERMINISTA y dirige al modelo a devolver scores numéricos
 * estrictamente entre 0 y 1.
 */
function buildScorerSystemPrompt(activeLenses) {
  const lensListText = activeLenses
    .map((l, i) => `${i + 1}. ${l}`)
    .join("\n");

  return `Eres un evaluador de compatibilidad epistemológica para Triggui.

Recibes información sobre un libro (anchors, voz autorial, contenido editorial generado, ground truth) y debes evaluar QUÉ TAN COMPATIBLE es ese libro con cada uno de los lentes interpretativos de Triggui.

LENTES A EVALUAR:
${lensListText}

DEFINICIÓN DE CADA LENTE (resumen para evaluación):
- self-knowledge: lente del autoconocimiento. Patrones internos, señales corporales/emocionales, fricción percepción-realidad, autoengaño. Favorece libros que enseñan a leer al sí mismo.
- game-theory: lente de teoría de juegos. Estructura de decisiones, incentivos, juego repetido, señales, reputación. Favorece libros sobre estrategia y decisiones humanas.
- hawkins: lente del Mapa de Conciencia (Hawkins). Niveles vibracionales 20-1000. Favorece libros que resuenan con un nivel calibrado específico.
- chronobiology: lente del ritmo biológico. Tiempo, energía, ciclos, momento. Favorece libros sobre cuerpo, ritmos, presencia temporal.
- pilares: lente de los 7 pilares (Cuerpo, Mente, Negocio, Familia, Espíritu, Relaciones, Finanzas). Cada libro tiene afinidad con uno o más pilares.

CÓMO EVALUAR:
- Score 0.0 = el libro NO toca este lente
- Score 0.3 = el libro toca tangencialmente
- Score 0.5 = el libro tiene afinidad media
- Score 0.7 = el libro toca este lente sustancialmente
- Score 0.9 = el libro es CASI sobre esto
- Score 1.0 = el libro es exactamente sobre esto

REGLAS DURAS:
1. Sé HONESTO. No infles. Un libro de cocina tiene self-knowledge=0.1, no 0.5.
2. Los scores NO suman 1. Cada lente se evalúa independientemente.
3. Para "pilares": evalúa los 7 sub-pilares INDIVIDUALMENTE. Un libro puede tener mente=0.9 y finanzas=0.05.
4. Devuelve EXCLUSIVAMENTE el JSON pedido. Sin texto adicional.`;
}

/**
 * Construye el user prompt con la info del libro.
 */
function buildScorerUserPrompt(input) {
  const { book, groundTruth, anchors, contentES } = input;

  const anchorsText = anchors?.book_grounding_anchors
    ? `Conceptos: ${(anchors.book_grounding_anchors.concepts || []).map(c => `"${c}"`).join(", ")}\n` +
      `Key terms: ${(anchors.book_grounding_anchors.key_terms || []).join(", ")}\n` +
      `Voz autorial: ${anchors.book_grounding_anchors.authorial_voice_notes || "(no especificada)"}`
    : "(sin anchors)";

  const surfaceText = anchors?.surface_hints
    ? `Dimensión: ${anchors.surface_hints.dimension}\n` +
      `Punto Hawkins: ${anchors.surface_hints.punto_hawkins}\n` +
      `Franja ideal: ${anchors.surface_hints.franja_ideal}`
    : "(sin surface hints)";

  const contentText = contentES?.card_es
    ? `Título tarjeta: ${contentES.card_es.titulo}\n` +
      `Párrafo top: ${contentES.card_es.parrafoTop}\n` +
      `Subtítulo: ${contentES.card_es.subtitulo}\n` +
      `Párrafo bot: ${contentES.card_es.parrafoBot}`
    : "(sin contenido)";

  const groundText = (groundTruth || "").slice(0, 500);

  return `LIBRO: "${book.titulo}" — ${book.autor}

GROUND TRUTH (extracto):
${groundText}${groundText.length >= 500 ? "..." : ""}

ANCHORS EXTRAÍDOS:
${anchorsText}

SURFACE HINTS:
${surfaceText}

CONTENIDO EDITORIAL GENERADO:
${contentText}

Devuelve EXACTAMENTE este JSON (los scores deben ser números entre 0.0 y 1.0):

{
  "self-knowledge": <number>,
  "game-theory": <number>,
  "hawkins": <number>,
  "chronobiology": <number>,
  "pilares": {
    "cuerpo": <number>,
    "mente": <number>,
    "negocio": <number>,
    "familia": <number>,
    "espiritu": <number>,
    "relaciones": <number>,
    "finanzas": <number>
  }
}`;
}

/**
 * Función defensiva: parsea JSON o devuelve fallback.
 */
function safeParseJSON(raw) {
  if (!raw || typeof raw !== "string") return null;
  try { return JSON.parse(raw); }
  catch { return null; }
}

/**
 * Función defensiva: valida que un score esté en [0, 1].
 */
function clampScore(value, defaultValue = 0.5) {
  if (typeof value !== "number" || !Number.isFinite(value)) return defaultValue;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Función defensiva: construye un vector de compatibilidad vacío (todos 0.5)
 * para los lentes activos. Se usa cuando el LLM falla o devuelve garbage.
 */
async function buildEmptyCompatibility() {
  const activeLenses = await getActiveLenses();
  const compat = {};
  
  for (const lensId of activeLenses) {
    if (lensId === "pilares") {
      compat.pilares = {};
      for (const pilar of PILARES) {
        compat.pilares[pilar] = 0.5;
      }
    } else {
      compat[lensId] = 0.5;
    }
  }
  
  return compat;
}

/**
 * Función defensiva: limpia y valida el output del LLM. Si falta algún
 * lente activo, lo rellena con 0.5 (neutro). Si hay valores fuera de
 * rango, los clampa.
 */
async function sanitizeCompatibility(parsed) {
  const activeLenses = await getActiveLenses();
  const sanitized = {};

  for (const lensId of activeLenses) {
    if (lensId === "pilares") {
      sanitized.pilares = {};
      for (const pilar of PILARES) {
        const raw = parsed?.pilares?.[pilar];
        sanitized.pilares[pilar] = clampScore(raw, 0.5);
      }
    } else {
      const raw = parsed?.[lensId];
      sanitized[lensId] = clampScore(raw, 0.5);
    }
  }

  return sanitized;
}

/**
 * FUNCIÓN PRINCIPAL — calcula la compatibilidad del libro con cada lente activo.
 *
 * @param {OpenAI} openai - Cliente OpenAI ya autenticado
 * @param {Object} input - Datos del libro:
 *   - book: { titulo, autor, ... }
 *   - groundTruth: string con info verificada del libro
 *   - anchors: output de extractAnchors
 *   - contentES: output de extractContentES (con card_es, etc)
 * @param {Object} opts - Opciones:
 *   - model: modelo a usar (default: "gpt-4o-mini")
 *   - temperature: temperatura (default: 0.2 — queremos consistencia)
 * @returns {Promise<Object>} - Vector de compatibilidad listo para guardar
 *                              en _lens_compatibility del libro
 */
export async function scoreLensCompatibility(openai, input, opts = {}) {
  const model = opts.model || "gpt-4o-mini";
  const temperature = opts.temperature ?? 0.2; // baja para consistencia

  const activeLenses = await getActiveLenses();
  
  // Caso degenerate: no hay lentes activos. Devolver vacío.
  if (activeLenses.length === 0) {
    console.warn("⚠ lens-compatibility-scorer: no hay lentes activos en el registry");
    return {};
  }

  const systemPrompt = buildScorerSystemPrompt(activeLenses);
  const userPrompt = buildScorerUserPrompt(input);

  try {
    const response = await openai.chat.completions.create({
      model,
      temperature,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const raw = response?.choices?.[0]?.message?.content;
    const parsed = safeParseJSON(raw);

    if (!parsed) {
      console.warn(`⚠ lens-compatibility-scorer: respuesta no parseable. Usando vector neutro.`);
      return await buildEmptyCompatibility();
    }

    const sanitized = await sanitizeCompatibility(parsed);
    return sanitized;
  } catch (err) {
    console.warn(`⚠ lens-compatibility-scorer falló: ${err.message}`);
    console.warn(`   Usando vector neutro (todos los scores = 0.5).`);
    return await buildEmptyCompatibility();
  }
}

/**
 * Helper: deriva las 3 dimensiones agregadas (Bienestar, Prosperidad, Conexión)
 * a partir del vector de pilares. Útil si algún consumidor del JSON necesita
 * las dimensiones en lugar de los pilares granulares.
 *
 * @param {Object} pilaresCompat - { cuerpo: 0.X, mente: 0.X, ... }
 * @returns {Object} - { Bienestar: 0.X, Prosperidad: 0.X, Conexion: 0.X }
 */
export function pilaresToDimensiones(pilaresCompat) {
  if (!pilaresCompat || typeof pilaresCompat !== "object") {
    return { Bienestar: 0.5, Prosperidad: 0.5, Conexion: 0.5 };
  }

  const c = (k) => clampScore(pilaresCompat[k], 0.5);

  return {
    Bienestar:   (c("cuerpo") + c("mente") + c("espiritu")) / 3,
    Prosperidad: (c("negocio") + c("finanzas")) / 2,
    Conexion:    (c("familia") + c("relaciones")) / 2,
  };
}

/**
 * Helper: deriva el _hawkins_range estimado para un libro a partir de
 * surface_hints.punto_hawkins. Esto evita pedirle al LLM que adivine rangos
 * numéricos cuando ya tenemos la categoría.
 *
 * @param {string} puntoHawkins - "Cero" | "Creativo" | "Activo" | "Maximo"
 * @returns {Array<number>} - [min, max]
 */
export function puntoHawkinsToRange(puntoHawkins) {
  const ranges = {
    "Cero":     [20, 125],   // Vergüenza, Culpa, Apatía, Aflicción, Miedo, Deseo
    "Creativo": [150, 250],  // Ira, Orgullo, Coraje, Neutralidad
    "Activo":   [310, 500],  // Voluntad, Aceptación, Razón, Amor
    "Maximo":   [540, 1000], // Alegría, Paz, Iluminación
  };
  return ranges[puntoHawkins] || [200, 500]; // default si viene raro
}

/**
 * Helper: deriva _chronobiology_optimal a partir de los anchors+surface_hints.
 * Esto se computa en runtime (no requiere otra llamada LLM).
 *
 * @param {Object} anchors - Output de extractAnchors
 * @returns {Object} - { preferred_franjas, preferred_dias, energy_minimum_required }
 */
export function deriveChronobiologyOptimal(anchors) {
  const surface = anchors?.surface_hints || {};
  
  const preferred_franjas = [];
  if (surface.franja_ideal) {
    preferred_franjas.push(surface.franja_ideal);
  }

  // Estimación heurística de energía requerida basada en punto_hawkins
  let energy_minimum_required = 0.5; // default
  switch (surface.punto_hawkins) {
    case "Maximo":   energy_minimum_required = 0.8; break;
    case "Activo":   energy_minimum_required = 0.6; break;
    case "Creativo": energy_minimum_required = 0.4; break;
    case "Cero":     energy_minimum_required = 0.3; break;
  }

  return {
    preferred_franjas,
    preferred_dias: [],  // no inferimos día de la semana automáticamente; queda para curaduría manual
    energy_minimum_required,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// EJEMPLO DE USO EN PIPELINE (descomentar para probar)
// ════════════════════════════════════════════════════════════════════════════
//
// import OpenAI from "openai";
// import { scoreLensCompatibility, puntoHawkinsToRange, deriveChronobiologyOptimal } from './lens-compatibility-scorer.js';
//
// const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });
//
// const lensCompat = await scoreLensCompatibility(openai, {
//   book: { titulo: "El Arte de Amar", autor: "Erich Fromm" },
//   groundTruth: "...",
//   anchors: anchorsData,
//   contentES: contentESFinal,
// });
//
// // Guardar en el libro:
// mapped._lens_compatibility = lensCompat;
// mapped._hawkins_range = puntoHawkinsToRange(anchorsData.surface_hints.punto_hawkins);
// mapped._chronobiology_optimal = deriveChronobiologyOptimal(anchorsData);
//
// ════════════════════════════════════════════════════════════════════════════