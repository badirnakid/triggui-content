/**
 * ════════════════════════════════════════════════════════════════════════════
 * chronobiology-engine.js — LAYER 1 DEL MOTOR CUÁNTICO DE TRIGGUI
 * ════════════════════════════════════════════════════════════════════════════
 *
 * QUÉ HACE ESTE ARCHIVO
 * ─────────────────────
 * Este archivo es el ORQUESTADOR de cronobiología. Su única responsabilidad
 * es: dado una fecha + hora + zona horaria, devolver el vector de pesos
 * baseline para los 5 lentes de Triggui.
 *
 * Es el primer paso del sistema de 3 capas:
 *   Layer 1 (este archivo)     → cuándo es el usuario / cuándo se genera
 *   Layer 2 (trigger-modulator) → qué trae el usuario emocionalmente
 *   Layer 3 (lens-composer)     → qué lentes están permitidos por toggle
 *
 * POR QUÉ EXISTE
 * ──────────────
 * La cronobiología es la única dimensión universal entre humanos: a las 4am,
 * el cerebro de cualquier persona en cualquier país está en el mismo estado
 * bioquímico (cortisol bajo, melatonin alto, prefrontal poco activo). Esto
 * permite que Triggui ofrezca recomendaciones que respetan el momento
 * biológico real del usuario, no solo su contenido emocional declarado.
 *
 * CÓMO SE USA
 * ───────────
 * Server-side (GitHub Actions, generación de libros):
 *   import { getBaseline } from './chronobiology-engine.js';
 *   const result = getBaseline(new Date(), 'America/Mexico_City');
 *
 * Client-side (browser del usuario en app.triggui.com):
 *   La función getBaseline es pura — funciona idéntico en browser que en server.
 *   Solo se necesita cargar la matriz como JSON.
 *
 * COMENTARIOS EN ESPAÑOL
 * ──────────────────────
 * Este archivo está comentado paso a paso para que cualquier humano
 * (incluyendo niños y viejitos curiosos) o LLM pueda leerlo y entender
 * qué hace cada bloque. Cuando se modifique, mantener este nivel de
 * comentario.
 *
 * ════════════════════════════════════════════════════════════════════════════
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Localizar el archivo de la matriz ─────────────────────────────────────
// La matriz vive en data/chronobiology-matrix.json relativo a la raíz del
// repo. Este código resuelve el path absoluto desde donde corre el script.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MATRIX_PATH = path.resolve(__dirname, '..', '..', 'data', 'chronobiology-matrix.json');

// ─── Cache en memoria ───────────────────────────────────────────────────────
// La matriz se lee una sola vez por proceso. Los runs subsecuentes usan la
// versión en memoria. Si necesitas forzar reload (ej: durante tests), usa
// la función reloadMatrix().
let _matrixCache = null;

/**
 * Carga la matriz cronobiológica desde disco.
 * 
 * En entorno Node.js (server, GitHub Actions): lee el archivo JSON.
 * En entorno browser: el caller debe pasar la matriz directamente.
 *
 * @returns {Promise<Object>} La matriz completa parseada.
 */
async function loadMatrix() {
  if (_matrixCache) return _matrixCache;

  try {
    const raw = await fs.readFile(MATRIX_PATH, 'utf8');
    _matrixCache = JSON.parse(raw);
    return _matrixCache;
  } catch (err) {
    throw new Error(
      `chronobiology-engine: no pude cargar la matriz desde ${MATRIX_PATH}. ` +
      `Verifica que el archivo existe y tiene JSON válido. Error original: ${err.message}`
    );
  }
}

/**
 * Permite inyectar la matriz manualmente. Útil para:
 *   - Browser: el frontend la fetch desde /chronobiology-matrix.json y la pasa aquí
 *   - Tests: pasar una matriz mock para validar comportamiento
 *
 * @param {Object} matrix - La matriz completa parseada
 */
export function setMatrix(matrix) {
  _matrixCache = matrix;
}

/**
 * Fuerza la recarga de la matriz desde disco. Útil después de editar
 * el archivo de la matriz sin reiniciar el proceso.
 */
export function reloadMatrix() {
  _matrixCache = null;
}

/**
 * Detecta el día de la semana en español a partir de una fecha + zona horaria.
 *
 * IMPORTANTE: la zona horaria importa. Si el server está en UTC pero el
 * usuario está en CDMX, lo que es "domingo 11pm" para el usuario es
 * "lunes 5am" en UTC. Siempre usar la zona horaria del usuario.
 *
 * @param {Date} date - Fecha a evaluar
 * @param {string} timezone - Zona horaria IANA (ej: "America/Mexico_City")
 * @returns {string} - "lunes" | "martes" | ... | "domingo"
 */
function getDiaDeLaSemana(date, timezone) {
  // Intl.DateTimeFormat es el método más confiable para esto
  const formatter = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    timeZone: timezone,
  });
  
  const dia = formatter.format(date).toLowerCase();
  
  // Normalizar acentos: el formato "miércoles" / "sábado" ya viene con acento
  // y nuestra matriz también los tiene con acento, así que coincide.
  return dia;
}

/**
 * Detecta la hora local del usuario (0-23).
 *
 * @param {Date} date - Fecha a evaluar
 * @param {string} timezone - Zona horaria IANA
 * @returns {number} - Hora 0-23
 */
function getHoraLocal(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: timezone,
  });
  
  const horaStr = formatter.format(date);
  // formatter devuelve "0" a "23" como string; parsear
  return parseInt(horaStr, 10);
}

/**
 * Mapea una hora del día (0-23) a una franja cronobiológica.
 *
 * Las 4 franjas dividen el día en bloques de 6 horas, alineados con los
 * picos hormonales típicos del ciclo circadiano humano:
 *
 *   madrugada (00-06): cortisol bajo, melatonin alto, prefrontal mínimo
 *   manana    (06-12): pico cortisol, prefrontal activo, energía ejecutiva
 *   tarde     (12-18): caída postprandial, energía emocional
 *   noche     (18-24): melatonin sube, sistema parasimpático
 *
 * @param {number} hora - 0 a 23
 * @returns {string} - "madrugada" | "manana" | "tarde" | "noche"
 */
function getFranja(hora) {
  if (hora >= 0 && hora < 6) return 'madrugada';
  if (hora >= 6 && hora < 12) return 'manana';
  if (hora >= 12 && hora < 18) return 'tarde';
  return 'noche';
}

/**
 * FUNCIÓN PRINCIPAL — calcula los pesos baseline para un momento específico.
 *
 * Esta es la función que el sistema llama en CADA generación de libro
 * (server) y en CADA consulta del usuario (client). Es pura y rápida:
 * solo hace lookups en la matriz, no llama APIs ni hace cálculos pesados.
 *
 * @param {Date} date - Fecha y hora a evaluar (default: ahora)
 * @param {string} timezone - Zona horaria IANA del usuario (default: server timezone)
 * @returns {Promise<Object>} - {
 *     dia: "lunes",
 *     franja: "madrugada",
 *     hora: 4,
 *     energia: 0.8,
 *     hawkins_range: [20, 75],
 *     pesos: { 
 *       "self-knowledge": 0.95, 
 *       "game-theory": 0.20, 
 *       "hawkins": 0.40,
 *       "pilares": 0.30,
 *       "chronobiology": 0.85
 *     },
 *     _explanation: "lunes madrugada con energía 0.8"
 *   }
 */
export async function getBaseline(date = new Date(), timezone = 'America/Mexico_City') {
  const matrix = await loadMatrix();

  // Paso 1: detectar día y hora del usuario
  const dia = getDiaDeLaSemana(date, timezone);
  const hora = getHoraLocal(date, timezone);
  const franja = getFranja(hora);

  // Paso 2: validar que el día existe en la matriz (defensivo)
  if (!matrix.matriz[dia]) {
    throw new Error(
      `chronobiology-engine: día "${dia}" no existe en la matriz. ` +
      `Días válidos: ${Object.keys(matrix.matriz).join(', ')}`
    );
  }

  // Paso 3: validar que la franja existe (defensivo)
  if (!matrix.matriz[dia][franja]) {
    throw new Error(
      `chronobiology-engine: franja "${franja}" no existe para el día "${dia}". ` +
      `Esto sugiere que la matriz está incompleta. Revisar data/chronobiology-matrix.json`
    );
  }

  // Paso 4: extraer los pesos del momento. Limpiamos campos que no son lentes
  // (campos como _filosofia_del_dia que son comentarios)
  const pesosRaw = matrix.matriz[dia][franja];
  const pesos = {};
  for (const [lente, valor] of Object.entries(pesosRaw)) {
    if (lente.startsWith('_')) continue; // ignorar campos de documentación
    pesos[lente] = valor;
  }

  // Paso 5: extraer información complementaria
  const energia = matrix.energia_por_dia[dia] ?? 0.8;
  const hawkins_range = matrix.hawkins_range_por_franja[franja] ?? [20, 1000];

  // Paso 6: devolver el resultado completo
  return {
    dia,
    hora,
    franja,
    energia,
    hawkins_range,
    pesos,
    _explanation: `${dia} ${franja} (${hora}h) con energía ${energia} y rango Hawkins ${hawkins_range[0]}-${hawkins_range[1]}`,
  };
}

/**
 * Función auxiliar — obtiene SOLO el vector de pesos. Útil cuando el caller
 * solo necesita los pesos y no la metadata adicional.
 *
 * @param {Date} date 
 * @param {string} timezone 
 * @returns {Promise<Object>} - { lente: peso, ... }
 */
export async function getPesos(date = new Date(), timezone = 'America/Mexico_City') {
  const baseline = await getBaseline(date, timezone);
  return baseline.pesos;
}

/**
 * Función auxiliar — obtiene SOLO la franja del momento. Útil para lógica
 * que no necesita los pesos completos.
 *
 * @param {Date} date 
 * @param {string} timezone 
 * @returns {Promise<string>} - "madrugada" | "manana" | "tarde" | "noche"
 */
export async function getFranjaActual(date = new Date(), timezone = 'America/Mexico_City') {
  const hora = getHoraLocal(date, timezone);
  return getFranja(hora);
}

/**
 * Función auxiliar — devuelve true si el rango Hawkins de un libro tiene
 * overlap con el rango Hawkins óptimo del momento.
 *
 * Esto se usa en el matching: un libro de rango [200, 500] es mal candidato
 * para un momento de rango [20, 75], porque no hay overlap. Pero un libro
 * de rango [50, 150] sí encaja parcialmente.
 *
 * @param {Array<number>} rangoMomento - [min, max] del momento
 * @param {Array<number>} rangoLibro - [min, max] del libro
 * @returns {number} - Overlap entre 0 (sin solapar) y 1 (solapa totalmente)
 */
export function calcularHawkinsOverlap(rangoMomento, rangoLibro) {
  if (!Array.isArray(rangoMomento) || !Array.isArray(rangoLibro)) return 0.5;
  if (rangoMomento.length !== 2 || rangoLibro.length !== 2) return 0.5;

  const [minM, maxM] = rangoMomento;
  const [minL, maxL] = rangoLibro;

  // Sin overlap
  if (maxL < minM || minL > maxM) return 0;

  // Calcular intersección y unión
  const overlapStart = Math.max(minM, minL);
  const overlapEnd = Math.min(maxM, maxL);
  const overlapSize = overlapEnd - overlapStart;

  const unionStart = Math.min(minM, minL);
  const unionEnd = Math.max(maxM, maxL);
  const unionSize = unionEnd - unionStart;

  // Jaccard similarity normalizada
  return unionSize > 0 ? overlapSize / unionSize : 0;
}

/**
 * Función auxiliar — devuelve qué tan bien encaja la franja actual con
 * las franjas preferidas de un libro.
 *
 * @param {string} franjaActual - "madrugada" | "manana" | "tarde" | "noche"
 * @param {Array<string>} franjasPreferidas - Lista de franjas preferidas del libro
 * @returns {number} - 1.0 si match, 0.5 si franja adyacente, 0.2 si opuesta
 */
export function calcularFranjaMatch(franjaActual, franjasPreferidas) {
  if (!franjasPreferidas || franjasPreferidas.length === 0) return 0.5;
  if (franjasPreferidas.includes(franjaActual)) return 1.0;

  // Definir adyacencia: madrugada↔manana, manana↔tarde, tarde↔noche, noche↔madrugada
  const adyacentes = {
    'madrugada': ['noche', 'manana'],
    'manana': ['madrugada', 'tarde'],
    'tarde': ['manana', 'noche'],
    'noche': ['tarde', 'madrugada'],
  };

  const adyacentesActual = adyacentes[franjaActual] || [];
  const tieneAdyacente = franjasPreferidas.some(f => adyacentesActual.includes(f));

  return tieneAdyacente ? 0.5 : 0.2;
}

/**
 * Función auxiliar — devuelve qué tan bien encaja el día actual con los
 * días preferidos de un libro.
 *
 * @param {string} diaActual 
 * @param {Array<string>} diasPreferidos 
 * @returns {number} - 1.0 si match, 0.6 si día cercano, 0.3 si día lejano
 */
export function calcularDiaMatch(diaActual, diasPreferidos) {
  if (!diasPreferidos || diasPreferidos.length === 0) return 0.5;
  if (diasPreferidos.includes(diaActual)) return 1.0;

  // Definir cercanía simple: cada día tiene 2 vecinos
  const ordenSemanal = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const idxActual = ordenSemanal.indexOf(diaActual);
  if (idxActual === -1) return 0.3;

  const cercanos = [
    ordenSemanal[(idxActual + 6) % 7], // día anterior
    ordenSemanal[(idxActual + 1) % 7], // día siguiente
  ];

  const tieneCercano = diasPreferidos.some(d => cercanos.includes(d));
  return tieneCercano ? 0.6 : 0.3;
}

// ════════════════════════════════════════════════════════════════════════════
// EJEMPLO DE USO (descomentar para probar)
// ════════════════════════════════════════════════════════════════════════════
//
// import { getBaseline } from './chronobiology-engine.js';
//
// const ahora = new Date();
// const baseline = await getBaseline(ahora, 'America/Mexico_City');
// console.log(baseline);
//
// // Salida ejemplo (lunes 4:30am):
// // {
// //   dia: 'lunes',
// //   hora: 4,
// //   franja: 'madrugada',
// //   energia: 0.8,
// //   hawkins_range: [20, 75],
// //   pesos: {
// //     'self-knowledge': 0.95,
// //     'game-theory': 0.20,
// //     'hawkins': 0.40,
// //     'pilares': 0.30,
// //     'chronobiology': 0.85
// //   },
// //   _explanation: 'lunes madrugada (4h) con energía 0.8 y rango Hawkins 20-75'
// // }
//
// ════════════════════════════════════════════════════════════════════════════