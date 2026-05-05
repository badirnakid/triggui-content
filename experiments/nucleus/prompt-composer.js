/**
 * ════════════════════════════════════════════════════════════════════════════
 * prompt-composer.js — COMPOSITOR DINÁMICO DE LENTES
 * ════════════════════════════════════════════════════════════════════════════
 *
 * QUÉ HACE ESTE ARCHIVO
 * ─────────────────────
 * Lee la constitución de Triggui + el registro de lentes activos +
 * el contenido de cada lente activo, y los une en UN solo string que se
 * pasa como parámetro `lens` a las funciones de extractors.js.
 *
 * El motor de Triggui (extractors.js) ya acepta `lens` como string. Este
 * compositor solo construye un string MÁS RICO que el que venía por
 * env var antes — no hay que tocar extractors.js.
 *
 * POR QUÉ EXISTE
 * ──────────────
 * Hasta v6, el sistema corría con prompts inline y un solo lens opcional
 * pasado por env var. Esto significaba que:
 *   1. La constitución filosófica (164 líneas) NO se inyectaba al modelo
 *   2. Los lentes formalizados (chronobiology, game-theory, etc) NO se
 *      cargaban dinámicamente
 *   3. Activar/desactivar lentes requería cambios de código
 *
 * Este archivo arregla las 3 cosas leyendo:
 *   - prompts/constitution/triggui-core.md (siempre se inyecta)
 *   - lenses-registry.json (qué lentes están activos)
 *   - prompts/lenses/<id>.md por cada lente activo
 *
 * Y produciendo un string compuesto listo para pasar a extractors.js.
 *
 * CÓMO SE USA
 * ───────────
 *   import { composeLensSystemBlock } from './prompt-composer.js';
 *
 *   // Al inicio de un run de generación:
 *   INPUTS.lens = await composeLensSystemBlock({
 *     baseLens: process.env.TRIGGUI_LENS || ""
 *   });
 *
 *   // Después: extractors.js usa INPUTS.lens igual que antes,
 *   // pero ahora ese string contiene constitución + 5 lentes
 *   // formalizados + el lens base opcional.
 *
 * ════════════════════════════════════════════════════════════════════════════
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolución de paths relativos. El motor vive en experiments/nucleus/, así
// que para llegar a la raíz del repo subimos dos niveles.
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const PATHS = {
  constitution: path.join(REPO_ROOT, "prompts", "constitution", "triggui-core.md"),
  registry:     path.join(REPO_ROOT, "lenses-registry.json"),
  lensesDir:    path.join(REPO_ROOT, "prompts", "lenses"),
};

// Cache en memoria — la composición se hace UNA vez por run, no por libro.
let _cachedComposition = null;
let _cachedSourceMtime = null;

/**
 * Carga la constitución desde disco.
 * Si no existe el archivo (no debería pasar pero por defensa), devuelve "".
 */
async function loadConstitution() {
  try {
    const raw = await fs.readFile(PATHS.constitution, "utf8");
    return raw.trim();
  } catch (err) {
    console.warn(`⚠ prompt-composer: no pude cargar constitución desde ${PATHS.constitution}`);
    console.warn(`   Razón: ${err.message}`);
    console.warn(`   El sistema funcionará sin constitución inyectada.`);
    return "";
  }
}

/**
 * Carga el registro de lentes desde disco.
 * Si no existe, devuelve registro vacío (sin lentes activos).
 */
async function loadRegistry() {
  try {
    const raw = await fs.readFile(PATHS.registry, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.lenses)) {
      console.warn(`⚠ prompt-composer: lenses-registry.json no tiene array 'lenses'. Asumiendo vacío.`);
      return { lenses: [] };
    }
    return parsed;
  } catch (err) {
    console.warn(`⚠ prompt-composer: no pude cargar registry desde ${PATHS.registry}`);
    console.warn(`   Razón: ${err.message}`);
    console.warn(`   El sistema funcionará SIN lentes formalizados.`);
    return { lenses: [] };
  }
}

/**
 * Carga el contenido .md de un lente específico.
 *
 * @param {string} lensId - "chronobiology", "game-theory", etc
 * @returns {Promise<string>} - Contenido del archivo, o "" si no existe
 */
async function loadLens(lensId) {
  const lensPath = path.join(PATHS.lensesDir, `${lensId}.md`);
  try {
    const raw = await fs.readFile(lensPath, "utf8");
    return raw.trim();
  } catch (err) {
    console.warn(`⚠ prompt-composer: no pude cargar lente "${lensId}" (${lensPath})`);
    return "";
  }
}

/**
 * Lista los IDs de lentes activos (active === 1) del registro.
 *
 * @param {Object} registry - El objeto del registry
 * @returns {Array<string>} - IDs de lentes activos
 */
function getActiveLensIds(registry) {
  if (!registry || !Array.isArray(registry.lenses)) return [];
  return registry.lenses
    .filter(l => l && l.active === 1)
    .map(l => l.id);
}

/**
 * FUNCIÓN PRINCIPAL — compone el bloque completo que se pasa a extractors.js
 * como parámetro `lens`.
 *
 * Estructura del bloque resultante:
 *
 *   ═══ CONSTITUCIÓN TRIGGUI ═══
 *   [contenido de prompts/constitution/triggui-core.md]
 *
 *   ═══ LENTES EPISTEMOLÓGICOS ACTIVOS (N) ═══
 *
 *   ─── Lente 1: chronobiology ───
 *   [contenido de prompts/lenses/chronobiology.md]
 *
 *   ─── Lente 2: game-theory ───
 *   [contenido de prompts/lenses/game-theory.md]
 *
 *   ... (todos los lentes activos)
 *
 *   ═══ LENTE BASE DEL CURADOR (opcional) ═══
 *   [baseLens del env var, si existe]
 *
 * @param {Object} opts - Opciones
 * @param {string} opts.baseLens - Lens base opcional del env var TRIGGUI_LENS
 * @param {boolean} opts.refresh - Si true, ignora cache y recarga
 * @returns {Promise<string>} - Bloque completo listo para usar
 */
export async function composeLensSystemBlock(opts = {}) {
  const { baseLens = "", refresh = false } = opts;

  // Si tenemos cache y no se pidió refresh, devolverlo
  if (_cachedComposition !== null && !refresh && !baseLens) {
    return _cachedComposition;
  }

  const partes = [];

  // ─── 1. Constitución (siempre se inyecta si existe) ─────────────────────
  const constitution = await loadConstitution();
  if (constitution) {
    partes.push("═══════════════════════════════════════════════════════════════════");
    partes.push("CONSTITUCIÓN TRIGGUI");
    partes.push("═══════════════════════════════════════════════════════════════════");
    partes.push(constitution);
  }

  // ─── 2. Lentes activos ──────────────────────────────────────────────────
  const registry = await loadRegistry();
  const activeIds = getActiveLensIds(registry);

  if (activeIds.length > 0) {
    partes.push("");
    partes.push("═══════════════════════════════════════════════════════════════════");
    partes.push(`LENTES EPISTEMOLÓGICOS ACTIVOS (${activeIds.length})`);
    partes.push("═══════════════════════════════════════════════════════════════════");
    partes.push("");
    partes.push("Los siguientes lentes están activos en este run. Cada uno");
    partes.push("define una manera específica de leer el momento humano.");
    partes.push("Aplicalos en orden de aparición. El primero pesa más.");
    partes.push("");

    for (let i = 0; i < activeIds.length; i++) {
      const lensId = activeIds[i];
      const lensContent = await loadLens(lensId);
      if (!lensContent) continue;

      partes.push("");
      partes.push(`─── Lente ${i + 1}: ${lensId} ───`);
      partes.push("");
      partes.push(lensContent);
      partes.push("");
    }
  }

  // ─── 3. Lente base opcional del curador ─────────────────────────────────
  if (baseLens && baseLens.trim()) {
    partes.push("");
    partes.push("═══════════════════════════════════════════════════════════════════");
    partes.push("LENTE BASE DEL CURADOR (override puntual de este run)");
    partes.push("═══════════════════════════════════════════════════════════════════");
    partes.push(baseLens.trim());
  }

  const composed = partes.join("\n");

  // Guardar en cache solo si no había baseLens (porque baseLens es por-run)
  if (!baseLens) {
    _cachedComposition = composed;
  }

  // Log informativo (solo primera vez)
  if (!_cachedSourceMtime) {
    const tieneConstitucion = constitution.length > 0 ? "✓" : "✗";
    const lentesTxt = activeIds.length > 0 ? activeIds.join(", ") : "(ninguno)";
    const tieneBaseLens = baseLens && baseLens.trim() ? "✓" : "✗";
    console.log(`📜 prompt-composer: constitución ${tieneConstitucion} | lentes [${lentesTxt}] | baseLens ${tieneBaseLens}`);
    console.log(`   Total bloque: ${composed.length} caracteres`);
    _cachedSourceMtime = Date.now();
  }

  return composed;
}

/**
 * Devuelve la lista de IDs de lentes activos. Útil para que otros módulos
 * (ej: lens-compatibility-scorer.js) sepan qué lentes scorear sin volver
 * a leer el registry.
 *
 * @returns {Promise<Array<string>>} - IDs activos
 */
export async function getActiveLenses() {
  const registry = await loadRegistry();
  return getActiveLensIds(registry);
}

/**
 * Limpia el cache. Útil para tests o si el registry cambia mid-run.
 */
export function clearCache() {
  _cachedComposition = null;
  _cachedSourceMtime = null;
}

/**
 * Diagnóstico — verifica que todos los archivos referenciados existen.
 * Útil para correr al inicio del workflow y abortar con error claro si algo falta.
 *
 * @returns {Promise<Object>} - { ok: bool, missing: [...], summary: "..." }
 */
export async function diagnose() {
  const missing = [];
  const found = [];

  // Constitución
  try {
    await fs.access(PATHS.constitution);
    found.push("constitution");
  } catch {
    missing.push(PATHS.constitution);
  }

  // Registry
  let registry = { lenses: [] };
  try {
    const raw = await fs.readFile(PATHS.registry, "utf8");
    registry = JSON.parse(raw);
    found.push("registry");
  } catch {
    missing.push(PATHS.registry);
  }

  // Cada lente activo
  const activeIds = getActiveLensIds(registry);
  for (const id of activeIds) {
    const lensPath = path.join(PATHS.lensesDir, `${id}.md`);
    try {
      await fs.access(lensPath);
      found.push(`lens:${id}`);
    } catch {
      missing.push(lensPath);
    }
  }

  return {
    ok: missing.length === 0,
    missing,
    found,
    active_lenses: activeIds,
    summary: missing.length === 0
      ? `✓ ${found.length} archivos OK`
      : `⚠ ${missing.length} archivos faltantes: ${missing.join(", ")}`,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// EJEMPLO DE USO (descomentar para probar)
// ════════════════════════════════════════════════════════════════════════════
//
// import { composeLensSystemBlock, diagnose } from './prompt-composer.js';
//
// // Diagnóstico al inicio
// const diag = await diagnose();
// if (!diag.ok) {
//   console.error(diag.summary);
//   console.error("Archivos faltantes:", diag.missing);
//   process.exit(1);
// }
//
// // Componer el bloque
// const lensBlock = await composeLensSystemBlock({
//   baseLens: process.env.TRIGGUI_LENS || ""
// });
//
// // Pasar a extractors.js como antes (no cambia su API)
// // extractAnchors(openai, book, groundTruth, lensBlock, opts);
//
// ════════════════════════════════════════════════════════════════════════════