#!/usr/bin/env node
/**
 * sanitize-catalog.mjs — v2.0 NIVEL DIOS CUÁNTICO-QUARK
 *
 * Limpieza matemática de contenido.json y contenido_kids.json.
 * Originalmente creado en v3.8.14 (perdido del repo). Recreado desde la
 * spec documentada en TRIGGUI_ARCHIVO_MAESTRO_V10.md §30.3.
 *
 * Tres pases en orden quirúrgico:
 *   1. ANSI escape sequences completas (\u001b[...m, \u001b[K, etc.)
 *   2. Bug del modelo \u001f<NNN hex> → repara matemáticamente a emoji
 *      Spec V10: el modelo escribe "\u001f440" queriendo "\u1f440" (👀).
 *      Reparación: parseInt("1f" + NNN, 16) = codepoint del emoji intentado.
 *   3. Otros control chars C0 (\u0000-\u001f) excepto \t \n \r — eliminar
 *
 * Verificación: post-sanitize debe quedar 0 control chars residuales,
 * sino restaura el backup automáticamente.
 *
 * Idempotente: si los catálogos ya están limpios, no hace cambios.
 */

import fs from 'node:fs/promises';

const TARGETS = [
  '/workspaces/triggui-content/contenido.json',
  '/workspaces/triggui-content/contenido_kids.json'
];

// Walker recursivo: aplica fn a cada string del árbol JSON
function walk(obj, fn) {
  if (typeof obj === 'string') return fn(obj);
  if (Array.isArray(obj)) return obj.map(x => walk(x, fn));
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const k of Object.keys(obj)) out[k] = walk(obj[k], fn);
    return out;
  }
  return obj;
}

const PASSES = [
  // 1. ANSI escape sequences COMPLETAS (preserva contexto antes de limpiar)
  {
    name: 'ansi_sequences',
    re: /\u001b\[[0-9;]*[a-zA-Z]/g,
    repl: () => ''
  },

  // 2. Bug \u001f<3 hex chars> → reparar a emoji
  // Modelo escribe "\u001f440" queriendo "\u1f440" (👀 codepoint 0x1F440).
  // JSON.parse interpreta como U+001F + texto "440".
  // Reparación: parseInt("1f" + "440", 16) = 0x1f440 = 128064 = 👀
  {
    name: 'emoji_bug_repair',
    re: /\u001f([0-9a-fA-F]{3})/g,
    repl: (m, hex) => {
      try {
        const cp = parseInt('1f' + hex.toLowerCase(), 16);
        // Rango de emojis: 0x1F000 - 0x1FFFF
        if (cp >= 0x1f000 && cp <= 0x1ffff) {
          return String.fromCodePoint(cp);
        }
      } catch (_) {}
      return ''; // si no es codepoint emoji válido, eliminar el U+001F
    }
  },

  // 3. Otros control chars C0 (\u0000-\u001f) excepto \t (0x09), \n (0x0a), \r (0x0d)
  {
    name: 'control_chars',
    re: /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,
    repl: () => ''
  }
];

function sanitizeString(s, stats) {
  let r = s;
  for (const pass of PASSES) {
    const before = r;
    r = r.replace(pass.re, pass.repl);
    if (r !== before) {
      // Conteo aproximado: chars eliminados o reparados
      const delta = (before.match(pass.re) || []).length;
      stats[pass.name] = (stats[pass.name] || 0) + delta;
    }
  }
  return r;
}

console.log('═══ sanitize-catalog v2.0 NIVEL DIOS CUÁNTICO-QUARK ═══\n');

let totalErrors = 0;

for (const path of TARGETS) {
  const filename = path.split('/').pop();
  console.log(`▸ ${filename}`);

  // Existence check
  try { await fs.access(path); }
  catch { console.log('  (no existe — skip)\n'); continue; }

  // Backup
  const backup = `${path}.backup-sanitize-${Date.now()}.json`;
  await fs.copyFile(path, backup);
  console.log(`  backup: ${backup.split('/').pop()}`);

  // Read + parse
  const raw = await fs.readFile(path, 'utf8');
  let data;
  try { data = JSON.parse(raw); }
  catch (e) {
    console.error(`  FAIL: JSON parse error — ${e.message}`);
    totalErrors++;
    continue;
  }

  // Conteo pre-sanitize (para reportar)
  const pre = (raw.match(/\\u00[01][0-9a-fA-F]/g) || []).length;

  // Sanitize
  const stats = {};
  const cleaned = walk(data, (s) => sanitizeString(s, stats));

  // Serializar manteniendo formato bonito del original (2-space indent)
  const out = JSON.stringify(cleaned, null, 2);

  // Verificación matemática post-sanitize
  const post = (out.match(/\\u00[01][0-9a-fA-F]/g) || []).length;

  if (post > 0) {
    console.error(`  FAIL: aún quedan ${post} control chars tras sanitize. Restaurando backup...`);
    await fs.copyFile(backup, path);
    totalErrors++;
    continue;
  }

  // Atomic write (tmp + rename)
  const tmp = `${path}.tmp-${Date.now()}`;
  await fs.writeFile(tmp, out, 'utf8');
  await fs.rename(tmp, path);

  // Reporte
  console.log(`  pre-sanitize:  ${pre} control chars`);
  console.log(`  post-sanitize: ${post} control chars`);
  if (Object.keys(stats).length > 0) {
    for (const [name, count] of Object.entries(stats)) {
      console.log(`    ${name}: ${count}`);
    }
  }
  console.log('  ✓ limpio\n');
}

console.log('═══ Verificación final independiente ═══');
let finalTotal = 0;
for (const path of TARGETS) {
  try {
    const raw = await fs.readFile(path, 'utf8');
    const count = (raw.match(/\\u00[01][0-9a-fA-F]/g) || []).length;
    finalTotal += count;
    const mark = count === 0 ? '✓' : '✗';
    console.log(`  ${mark} ${path.split('/').pop()}: ${count} control chars`);
  } catch (_) {}
}

console.log('');
if (totalErrors === 0 && finalTotal === 0) {
  console.log('🎯 NIVEL DIOS CUÁNTICO-QUARK — 0/0 control chars en ambos catálogos');
  process.exit(0);
} else {
  console.error(`FAIL — errores: ${totalErrors}, residuales: ${finalTotal}`);
  process.exit(1);
}
