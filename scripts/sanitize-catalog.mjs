#!/usr/bin/env node
/**
 * 🌒 sanitize-catalog.mjs — Sanitización cuántico-quark NIVEL DIOS de los JSONs
 *
 * Aplica EXACTAMENTE los mismos pases que el frontend (__triggguiSanitizeText)
 * pero al ESCRIBIR en disco. Doble defensa nivel dios: el JSON crudo en disco
 * queda limpio + el frontend re-sanitiza al cargar = garantía matemática absoluta.
 *
 * Uso:
 *   node scripts/sanitize-catalog.mjs                 # dry-run, reporta cambios
 *   node scripts/sanitize-catalog.mjs --apply         # escribe los archivos limpios
 *   node scripts/sanitize-catalog.mjs --apply --backup # hace backup antes de escribir
 *
 * Procesa: contenido.json + contenido_kids.json
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════════════════════
// SANITIZACIÓN — copia EXACTA de __triggguiSanitizeText del index.html
// (4 pases ANSI + 4 pases originales = 8 pases total nivel dios cuántico-quark)
// ═══════════════════════════════════════════════════════════════════════════

function __triggguiSanitizeText(s) {
  if (typeof s !== 'string' || s.length === 0) return s;

  // Pase 0a: ANSI escape sequences COMPLETAS (CSI sequences \x1B[...m)
  let result = s.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');

  // Pase 0b: residuos ANSI SIN escape prefix ([1m, [m, [N;Nm)
  result = result.replace(/\[[\d;]*m/g, '');

  // Pase 0c: brackets "[" huérfanos sin "]" cercano (preserva [NOTE], [Smith 2020], [tag])
  result = result.replace(/ \[ (?![^\[\]]{0,40}\])/g, ' ');
  result = result.replace(/^\[ (?![^\[\]]{0,40}\])/g, '');
  result = result.replace(/ \[$(?![^\[\]]{0,40}\])/g, '');

  // Pase 1: control char (U+0000-U+001F excepto \t \n \r) seguido de hex literal.
  // Caso del bug: "\u001f440" donde firstCP="1f" + resto="440" → 0x1F440 → 👀
  result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]([0-9a-fA-F]{2,5})/g, function(match, hexRest) {
    const firstCP = match.codePointAt(0);
    const intentedCP = parseInt(firstCP.toString(16) + hexRest, 16);
    const isValidEmoji = (
      (intentedCP >= 0x1F000 && intentedCP <= 0x1FAFF) ||
      (intentedCP >= 0x2600  && intentedCP <= 0x27BF)  ||
      (intentedCP >= 0x1F600 && intentedCP <= 0x1F64F) ||
      (intentedCP >= 0x1F680 && intentedCP <= 0x1F6FF) ||
      (intentedCP >= 0x1F900 && intentedCP <= 0x1F9FF)
    );
    if (isValidEmoji) {
      try { return String.fromCodePoint(intentedCP); } catch (_) {}
    }
    return hexRest;
  });

  // Pase 2: control chars residuales (sin hex después)
  result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  // Pase 3: surrogates huérfanos UTF-16
  result = result.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');

  // Pase 4: replacement char U+FFFD
  result = result.replace(/\uFFFD/g, '');

  return result;
}

function __triggguiSanitizeAll(obj, stats) {
  if (typeof obj === 'string') {
    const cleaned = __triggguiSanitizeText(obj);
    if (cleaned !== obj) {
      stats.stringsChanged++;
      stats.charsRemoved += obj.length - cleaned.length;
      if (stats.samples.length < 10) {
        stats.samples.push({ before: obj.slice(0, 60), after: cleaned.slice(0, 60) });
      }
    }
    return cleaned;
  }
  if (Array.isArray(obj)) return obj.map(item => __triggguiSanitizeAll(item, stats));
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        out[k] = __triggguiSanitizeAll(obj[k], stats);
      }
    }
    return out;
  }
  return obj;
}

// ═══════════════════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════════════════

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const BACKUP = args.includes('--backup');

const FILES = ['contenido.json', 'contenido_kids.json'];

console.log('🌒 sanitize-catalog.mjs — NIVEL DIOS CUÁNTICO-QUARK');
console.log(`   Modo: ${APPLY ? 'APPLY (escribe cambios)' : 'DRY-RUN (solo reporta)'}`);
console.log(`   Backup: ${BACKUP ? 'SÍ' : 'NO'}`);
console.log('');

let totalChanged = 0;

for (const filename of FILES) {
  const path = resolve(__dirname, '..', filename);

  if (!existsSync(path)) {
    console.log(`⏭️  ${filename} no existe, skip`);
    continue;
  }

  console.log(`═══════════════════════════════════════════════════════════════════`);
  console.log(`🔬 Analizando: ${filename}`);
  console.log(`═══════════════════════════════════════════════════════════════════`);

  const raw = readFileSync(path, 'utf-8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error(`   ❌ Error parseando JSON: ${e.message}`);
    continue;
  }

  const stats = { stringsChanged: 0, charsRemoved: 0, samples: [] };
  const cleaned = __triggguiSanitizeAll(data, stats);

  console.log(`   📊 Strings modificados: ${stats.stringsChanged}`);
  console.log(`   📊 Caracteres removidos: ${stats.charsRemoved}`);

  if (stats.samples.length > 0) {
    console.log('   📋 Ejemplos (primeros 10):');
    stats.samples.forEach((s, i) => {
      console.log(`      ${i+1}. "${s.before}" → "${s.after}"`);
    });
  }

  if (stats.stringsChanged === 0) {
    console.log('   ✅ Archivo ya estaba limpio, no se escribió');
    continue;
  }

  totalChanged += stats.stringsChanged;

  if (APPLY) {
    if (BACKUP) {
      const backupPath = `${path}.bak-pre-sanitize-${Date.now()}`;
      copyFileSync(path, backupPath);
      console.log(`   💾 Backup: ${backupPath}`);
    }

    // Escribir con misma estructura/indentación que el original
    const indent = raw.includes('  "') ? 2 : (raw.includes('    "') ? 4 : 0);
    const json = indent > 0 ? JSON.stringify(cleaned, null, indent) : JSON.stringify(cleaned);
    writeFileSync(path, json + (raw.endsWith('\n') ? '\n' : ''), 'utf-8');
    console.log(`   ✅ Escrito ${filename}`);
  } else {
    console.log(`   ℹ️  Dry-run: re-ejecuta con --apply para escribir`);
  }
}

console.log('');
console.log(`═══════════════════════════════════════════════════════════════════`);
console.log(`🏆 TOTAL strings sanitizados: ${totalChanged}`);
console.log(`═══════════════════════════════════════════════════════════════════`);

if (!APPLY && totalChanged > 0) {
  console.log('');
  console.log('⚠️  Re-ejecuta con --apply para escribir los archivos limpios:');
  console.log('   node scripts/sanitize-catalog.mjs --apply --backup');
}
