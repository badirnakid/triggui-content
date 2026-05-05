/**
 * ════════════════════════════════════════════════════════════════════════════
 * lens-composer.js — EL CORAZÓN MATEMÁTICO DE TRIGGUI
 * ════════════════════════════════════════════════════════════════════════════
 *
 * QUÉ HACE ESTE ARCHIVO
 * ─────────────────────
 * Este archivo implementa dos funciones críticas:
 *
 * 1. composeWeights(layers) — combina los pesos de los 3 layers (cronobiología,
 *    trigger, toggle) en un vector de pesos finales por lente.
 *
 * 2. scoreBook(libro, contexto) — calcula qué tan bien encaja un libro con
 *    un momento+usuario específico. Usa scoring multi-dimensional de 8 ejes.
 *
 * Es el código que convierte la inteligencia compilada en `_lens_compatibility`
 * de cada libro en una recomendación final, en menos de 50 milisegundos,
 * sin LLM en runtime, con razonamiento auditable.
 *
 * POR QUÉ EXISTE
 * ──────────────
 * Triggui no usa embeddings (caja negra) ni similarity matching (un solo eje).
 * Usa 8 ejes de scoring, cada uno extraído de los datos pre-calculados de
 * cada libro al generarse. La inteligencia se cristaliza en los datos. Este
 * archivo ejecuta esa inteligencia en tiempo real.
 *
 * CÓMO SE USA
 * ───────────
 *   import { composeWeights, scoreBook, selectBestBook } from './lens-composer.js';
 *
 *   // 1. Componer pesos del momento
 *   const layers = {
 *     chronobiology: { 'self-knowledge': 0.95, 'game-theory': 0.20, ... },
 *     trigger:       { 'self-knowledge': 1.4, ... },        // multipliers
 *     toggle:        { 'self-knowledge': 1, 'game-theory': 1, ... }, // 0|1
 *   };
 *   const finalWeights = composeWeights(layers);
 *
 *   // 2. Scorear cada libro del catálogo
 *   const scored = libros.map(libro => ({
 *     libro,
 *     score: scoreBook(libro, { weights: finalWeights, ...otrosContextos }),
 *   }));
 *
 *   // 3. O usar el helper que hace todo
 *   const resultado = selectBestBook(libros, contexto);
 *
 * ARQUITECTURA DE 8 EJES DE SCORING
 * ──────────────────────────────────
 *   α₁ × lens_fit             — producto vectorial pesos × _lens_compatibility
 *   α₂ × hawkins_overlap      — overlap entre rango Hawkins momento y libro
 *   α₃ × franja_match         — qué tan óptima es esta franja para el libro
 *   α₄ × dia_match            — qué tan óptimo es este día para el libro
 *   α₅ × energy_compat        — ¿la energía del usuario alcanza para este libro?
 *   α₆ × pilar_directo_boost  — si trigger menciona pilar específico
 *   α₇ × confidence_factor    — boost a libros con mayor calidad de generación
 *   α₈ × diversity_factor     — penaliza autor/tema visto recientemente
 *
 * COMENTARIOS EN ESPAÑOL
 * ──────────────────────
 * Cada bloque explica qué hace y por qué. Los coeficientes α se pueden ajustar
 * en la sección PESOS_DE_SCORING. Si un cliente B2B quiere darle más
 * importancia a un eje específico (ej: priorizar diversity), solo cambia el α.
 *
 * ════════════════════════════════════════════════════════════════════════════
 */

import {
  calcularHawkinsOverlap,
  calcularFranjaMatch,
  calcularDiaMatch,
} from './chronobiology-engine.js';

// ════════════════════════════════════════════════════════════════════════════
// COEFICIENTES DE SCORING — estos α deciden qué eje pesa más
// ════════════════════════════════════════════════════════════════════════════
//
// La suma de todos los α debe ser 1.0.
//
// Si un cliente B2B quiere personalizar (ej: hotel de lujo prioriza diversity
// para que huéspedes no vean el mismo libro 2 veces, coaching ejecutivo
// prioriza lens_fit por encima de todo), se puede pasar coeficientes custom
// al scoreBook(). Estos son los defaults nivel dios.
// ════════════════════════════════════════════════════════════════════════════

const PESOS_DE_SCORING = {
  lens_fit:           0.35,  // el match epistemológico es lo más importante
  hawkins_overlap:    0.15,  // resonancia vibracional
  franja_match:       0.10,  // qué tan óptimo el momento del día
  dia_match:          0.05,  // qué tan óptimo el día de la semana
  energy_compat:      0.10,  // si el libro requiere más energía de la disponible
  pilar_directo_boost:0.10,  // si trigger menciona pilar específico
  confidence_factor:  0.10,  // calidad de la generación del libro
  diversity_factor:   0.05,  // anti-repetición y diversidad
};

// Validación interna — la suma debe dar 1.0 (con margen de error de coma flotante)
const SUMA_PESOS = Object.values(PESOS_DE_SCORING).reduce((a, b) => a + b, 0);
if (Math.abs(SUMA_PESOS - 1.0) > 0.001) {
  throw new Error(`PESOS_DE_SCORING no suman 1.0 (suman ${SUMA_PESOS}). Ajustar coeficientes.`);
}

// ════════════════════════════════════════════════════════════════════════════
// FUNCIÓN 1 — COMPOSICIÓN DE PESOS DE LOS 3 LAYERS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Combina los pesos de los 3 layers (cronobiología × trigger × toggle).
 *
 * Fórmula:
 *   peso_final[L] = chronobiology[L] × trigger[L] × toggle[L]
 *
 * Donde:
 *   chronobiology[L] ∈ [0, 1]   — viene de la matriz por día/franja
 *   trigger[L]       ∈ [0, 2]   — multiplicador del trigger del usuario (1.0 = neutro)
 *   toggle[L]        ∈ {0, 1}   — del lenses-registry.json
 *
 * El resultado NO se normaliza (no suma 1). Son magnitudes absolutas que
 * se usan después en producto vectorial contra _lens_compatibility de libros.
 *
 * @param {Object} layers - { chronobiology: {...}, trigger: {...}, toggle: {...} }
 * @returns {Object} - { lente: peso_final, ... }
 */
export function composeWeights(layers) {
  const { chronobiology = {}, trigger = {}, toggle = {} } = layers;
  
  const finales = {};
  
  // Iterar sobre los lentes que existen en chronobiology (la fuente principal)
  for (const lente of Object.keys(chronobiology)) {
    const baseChrono = chronobiology[lente] ?? 0;
    const modTrigger = trigger[lente] ?? 1.0;  // default 1.0 = no afecta
    const modToggle = toggle[lente] ?? 1;      // default 1 = activo
    
    finales[lente] = baseChrono * modTrigger * modToggle;
  }
  
  return finales;
}

// ════════════════════════════════════════════════════════════════════════════
// FUNCIÓN 2 — SCORING DE UN LIBRO CONTRA UN CONTEXTO
// ════════════════════════════════════════════════════════════════════════════

/**
 * Calcula el score de match de un libro contra un contexto de usuario.
 *
 * @param {Object} libro - Un libro completo de contenido.json
 * @param {Object} contexto - {
 *     weights: pesos finales del momento (output de composeWeights),
 *     dia: día actual,
 *     franja: franja actual,
 *     hawkins_range: [min, max] del momento,
 *     energia: energía del momento (0-1.5),
 *     trigger_text: texto del trigger del usuario (opcional),
 *     trigger_pilares: pilares mencionados en trigger (opcional),
 *     seen_recently: array de slugs vistos recientemente (opcional),
 *     coeficientes: PESOS_DE_SCORING custom (opcional)
 *   }
 * @returns {Object} - {
 *     score: 0-1,
 *     breakdown: { lens_fit: 0.78, hawkins_overlap: 0.5, ... },
 *     explanation: "..."
 *   }
 */
export function scoreBook(libro, contexto) {
  const coef = contexto.coeficientes ?? PESOS_DE_SCORING;
  const breakdown = {};

  // ─── Eje 1: lens_fit ────────────────────────────────────────────────────
  // Producto vectorial: pesos × _lens_compatibility del libro
  // Captura: "qué tan alineado está este libro con lo que el momento pide"
  breakdown.lens_fit = computarLensFit(contexto.weights, libro._lens_compatibility);

  // ─── Eje 2: hawkins_overlap ─────────────────────────────────────────────
  // ¿El rango Hawkins del libro encaja con el rango óptimo del momento?
  breakdown.hawkins_overlap = calcularHawkinsOverlap(
    contexto.hawkins_range ?? [20, 1000],
    libro._hawkins_range ?? [20, 1000]
  );

  // ─── Eje 3: franja_match ────────────────────────────────────────────────
  // ¿El libro prefiere esta franja del día?
  breakdown.franja_match = calcularFranjaMatch(
    contexto.franja,
    libro._chronobiology_optimal?.preferred_franjas ?? []
  );

  // ─── Eje 4: dia_match ───────────────────────────────────────────────────
  // ¿El libro prefiere este día de la semana?
  breakdown.dia_match = calcularDiaMatch(
    contexto.dia,
    libro._chronobiology_optimal?.preferred_dias ?? []
  );

  // ─── Eje 5: energy_compat ───────────────────────────────────────────────
  // ¿La energía del momento alcanza para este libro?
  breakdown.energy_compat = computarEnergyCompat(
    contexto.energia ?? 0.8,
    libro._chronobiology_optimal?.energy_minimum_required ?? 0.5
  );

  // ─── Eje 6: pilar_directo_boost ─────────────────────────────────────────
  // Si trigger menciona pilar específico, boost a libros con alta compatibilidad
  // con ese pilar
  breakdown.pilar_directo_boost = computarPilarBoost(
    contexto.trigger_pilares ?? [],
    libro._lens_compatibility?.pilares ?? {}
  );

  // ─── Eje 7: confidence_factor ───────────────────────────────────────────
  // Boost a libros con mayor calidad de generación
  breakdown.confidence_factor = libro._grounding?.confidence_combined ?? 0.7;

  // ─── Eje 8: diversity_factor ────────────────────────────────────────────
  // Penaliza libros vistos recientemente
  breakdown.diversity_factor = computarDiversityFactor(
    libro,
    contexto.seen_recently ?? []
  );

  // ─── SCORE PONDERADO FINAL ──────────────────────────────────────────────
  const score = (
    coef.lens_fit            * breakdown.lens_fit +
    coef.hawkins_overlap     * breakdown.hawkins_overlap +
    coef.franja_match        * breakdown.franja_match +
    coef.dia_match           * breakdown.dia_match +
    coef.energy_compat       * breakdown.energy_compat +
    coef.pilar_directo_boost * breakdown.pilar_directo_boost +
    coef.confidence_factor   * breakdown.confidence_factor +
    coef.diversity_factor    * breakdown.diversity_factor
  );

  // ─── EXPLICACIÓN HUMANA ─────────────────────────────────────────────────
  // Genera una explicación legible de por qué este score
  const explanation = generarExplicacion(libro, contexto, breakdown, score);

  return { score, breakdown, explanation };
}

// ════════════════════════════════════════════════════════════════════════════
// HELPERS DE SCORING — funciones que computan cada eje
// ════════════════════════════════════════════════════════════════════════════

/**
 * Eje 1 — Lens fit
 * Calcula el producto vectorial entre los pesos del momento y la
 * compatibilidad del libro con cada lente.
 *
 * IMPORTANTE: pilares es un sub-vector. Hay que sumar la compatibilidad
 * promedio de los 7 pilares cuando el peso es para "pilares" general.
 */
function computarLensFit(weights, lensCompat) {
  if (!weights || !lensCompat) return 0.5;

  let suma = 0;
  let pesoTotal = 0;

  for (const [lente, peso] of Object.entries(weights)) {
    let compatLente = 0.5; // default neutral

    if (lente === 'pilares') {
      // Pilares es un objeto anidado: promediar los 7 sub-pilares
      const pilaresCompat = lensCompat.pilares;
      if (pilaresCompat && typeof pilaresCompat === 'object') {
        const valores = Object.values(pilaresCompat).filter(v => typeof v === 'number');
        if (valores.length > 0) {
          compatLente = valores.reduce((a, b) => a + b, 0) / valores.length;
        }
      }
    } else {
      // Lente simple
      compatLente = lensCompat[lente] ?? 0.5;
    }

    suma += peso * compatLente;
    pesoTotal += peso;
  }

  // Normalizar: dividir por suma de pesos para que el resultado sea 0-1
  return pesoTotal > 0 ? suma / pesoTotal : 0.5;
}

/**
 * Eje 5 — Energy compatibility
 * 
 * Si el libro requiere más energía de la que el momento ofrece, penaliza.
 * Si el momento ofrece más energía de la que el libro requiere, está bien
 * (un libro fácil en momento de alta energía no es un problema, solo es
 * subóptimo).
 */
function computarEnergyCompat(energiaMomento, energiaRequerida) {
  if (energiaMomento >= energiaRequerida) {
    // El momento tiene la energía necesaria. Score completo.
    return 1.0;
  } else {
    // El momento NO tiene la energía. Score proporcional al déficit.
    const ratio = energiaMomento / energiaRequerida;
    return Math.max(0.2, ratio); // mínimo 0.2 para no eliminar completamente
  }
}

/**
 * Eje 6 — Pilar boost
 *
 * Si el trigger del usuario menciona un pilar específico (ej: "tengo problema
 * con mi pareja" → trigger_pilares: ["relaciones"]), boostear libros con
 * alta compatibilidad con ese pilar.
 */
function computarPilarBoost(triggerPilares, libroPilares) {
  if (!triggerPilares || triggerPilares.length === 0) return 0.5;
  if (!libroPilares || Object.keys(libroPilares).length === 0) return 0.5;

  let maxCompat = 0;
  for (const pilar of triggerPilares) {
    const compat = libroPilares[pilar] ?? 0;
    if (compat > maxCompat) maxCompat = compat;
  }

  return maxCompat;
}

/**
 * Eje 8 — Diversity factor
 *
 * Penaliza libros vistos recientemente. La penalización es gradiente:
 * - El libro exacto visto: 0.0 (eliminar)
 * - Otro libro del mismo autor visto recientemente: 0.4 (penalizar fuerte)
 * - Libro nuevo: 1.0 (no penalizar)
 */
function computarDiversityFactor(libro, seenRecently) {
  if (!seenRecently || seenRecently.length === 0) return 1.0;

  // Si el slug exacto fue visto, eliminar (score 0)
  if (seenRecently.some(s => s.slug === libro.slug)) {
    return 0.0;
  }

  // Si otro libro del mismo autor fue visto en los últimos 5, penalizar
  const ultimosCinco = seenRecently.slice(0, 5);
  const mismoAutor = ultimosCinco.some(s => 
    s.autor && libro.autor && 
    normalizarTexto(s.autor) === normalizarTexto(libro.autor)
  );
  if (mismoAutor) return 0.4;

  return 1.0;
}

/**
 * Helper — normalizar texto para comparación (lowercase, sin acentos)
 */
function normalizarTexto(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ════════════════════════════════════════════════════════════════════════════
// FUNCIÓN 3 — GENERADOR DE EXPLICACIÓN HUMANA
// ════════════════════════════════════════════════════════════════════════════

/**
 * Genera una explicación legible de por qué se eligió un libro.
 * Esto se puede mostrar al usuario o al cliente B2B para auditabilidad.
 *
 * Ejemplo de output:
 *   "Este libro porque resonó con tu lente self-knowledge dominante
 *    en madrugada (peso 0.95), su rango Hawkins encaja con tu momento,
 *    y tiene alta confianza editorial."
 */
function generarExplicacion(libro, contexto, breakdown, score) {
  const partes = [];

  // Razón principal: lens fit
  if (breakdown.lens_fit > 0.7) {
    const topLente = encontrarTopLente(contexto.weights, libro._lens_compatibility);
    partes.push(`resonó con tu lente ${topLente} dominante en ${contexto.franja}`);
  }

  // Razón Hawkins
  if (breakdown.hawkins_overlap > 0.5) {
    partes.push(`su rango Hawkins encaja con tu momento (${contexto.hawkins_range[0]}-${contexto.hawkins_range[1]})`);
  }

  // Razón franja
  if (breakdown.franja_match >= 1.0) {
    partes.push(`es óptimo para ${contexto.franja}`);
  }

  // Razón confidence
  if (breakdown.confidence_factor > 0.85) {
    partes.push(`tiene alta confianza editorial`);
  }

  if (partes.length === 0) {
    return `Match general (score ${score.toFixed(2)}) — sin razón dominante específica.`;
  }

  return `Este libro porque ${partes.join(', ')}.`;
}

function encontrarTopLente(weights, lensCompat) {
  if (!weights || !lensCompat) return 'general';
  
  let mejorLente = 'general';
  let mejorProducto = 0;

  for (const [lente, peso] of Object.entries(weights)) {
    let compat = 0.5;
    if (lente === 'pilares' && lensCompat.pilares) {
      const valores = Object.values(lensCompat.pilares).filter(v => typeof v === 'number');
      if (valores.length > 0) {
        compat = valores.reduce((a, b) => a + b, 0) / valores.length;
      }
    } else {
      compat = lensCompat[lente] ?? 0.5;
    }

    const producto = peso * compat;
    if (producto > mejorProducto) {
      mejorProducto = producto;
      mejorLente = lente;
    }
  }

  return mejorLente;
}

// ════════════════════════════════════════════════════════════════════════════
// FUNCIÓN 4 — SELECCIÓN DEL MEJOR LIBRO (ORQUESTADOR PRINCIPAL)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Función de alto nivel que hace TODO: scorea todos los libros, ordena,
 * detecta empates, devuelve el ganador + alternativas.
 *
 * Esta es la función que el frontend o el server llama cuando un usuario
 * pide una recomendación. El "API público" del módulo.
 *
 * @param {Array} libros - Array de libros del catálogo (libros[] de contenido.json)
 * @param {Object} contexto - Contexto del momento (output de getBaseline + trigger)
 * @returns {Object} - {
 *     winner: { libro, score, breakdown, explanation },
 *     alternatives: [...top 2-3 alternatives],
 *     tie_detected: bool (si los top 2 están a <0.05 de diferencia)
 *   }
 */
export function selectBestBook(libros, contexto) {
  if (!Array.isArray(libros) || libros.length === 0) {
    throw new Error('lens-composer: array de libros vacío o inválido');
  }

  // Scorear cada libro
  const scored = libros.map(libro => ({
    libro,
    ...scoreBook(libro, contexto),
  }));

  // Ordenar por score descendente
  scored.sort((a, b) => b.score - a.score);

  // Detectar empate (top 2 a menos de 0.05 de diferencia)
  const tieDetected = 
    scored.length >= 2 && 
    (scored[0].score - scored[1].score) < 0.05;

  return {
    winner: scored[0],
    alternatives: scored.slice(1, 4), // top 2-3 alternativas
    tie_detected: tieDetected,
    total_scored: scored.length,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// EJEMPLO DE USO COMPLETO (descomentar para probar)
// ════════════════════════════════════════════════════════════════════════════
//
// import { getBaseline } from './chronobiology-engine.js';
// import { composeWeights, selectBestBook } from './lens-composer.js';
// import fs from 'node:fs/promises';
//
// // Paso 1: cargar el catálogo
// const contenido = JSON.parse(
//   await fs.readFile('contenido.json', 'utf8')
// );
//
// // Paso 2: computar baseline cronobiológico
// const baseline = await getBaseline(new Date(), 'America/Mexico_City');
//
// // Paso 3: layers (trigger y toggle son opcionales)
// const layers = {
//   chronobiology: baseline.pesos,
//   trigger: { 'self-knowledge': 1.4, 'game-theory': 0.5 }, // si hay trigger
//   toggle: { 'self-knowledge': 1, 'game-theory': 1, 'hawkins': 1, 'pilares': 1, 'chronobiology': 1 },
// };
//
// // Paso 4: componer pesos finales
// const weights = composeWeights(layers);
//
// // Paso 5: seleccionar
// const contexto = {
//   weights,
//   dia: baseline.dia,
//   franja: baseline.franja,
//   hawkins_range: baseline.hawkins_range,
//   energia: baseline.energia,
//   trigger_pilares: ['relaciones'], // si trigger menciona pilar
//   seen_recently: [], // de localStorage del usuario
// };
//
// const resultado = selectBestBook(contenido.libros, contexto);
//
// console.log('Libro elegido:', resultado.winner.libro.titulo);
// console.log('Score:', resultado.winner.score.toFixed(3));
// console.log('Razón:', resultado.winner.explanation);
// console.log('Alternativas:', resultado.alternatives.map(a => a.libro.titulo));
// if (resultado.tie_detected) {
//   console.log('⚠️ Empate detectado — considerar mostrar top 3 al usuario');
// }
//
// ════════════════════════════════════════════════════════════════════════════