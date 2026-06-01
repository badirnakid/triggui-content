#!/usr/bin/env node
'use strict';
/**
 * sanitizer.cjs — Sanitización pre-scoring del catálogo
 * Detecta y remueve phrases truncadas LLM (artefactos de generación).
 *
 * Standalone CLI:
 *   node sanitizer.cjs --catalog=path.json --rules=rules-kids.json [--report-only]
 *
 * Programmatic:
 *   const { sanitizeCatalog } = require('./sanitizer.cjs');
 *   const result = sanitizeCatalog(libros, truncationPatterns);
 */
const fs = require('fs');
const path = require('path');

function isTruncatedPhrase(text, compiledPatterns) {
  if (!text || typeof text !== 'string') return false;
  return compiledPatterns.some(r => r.test(text));
}

function isTruncatedItem(item, patterns) {
  if (typeof item === 'string') return isTruncatedPhrase(item, patterns);
  if (item && typeof item === 'object') {
    return isTruncatedPhrase(item.phrase, patterns) ||
           isTruncatedPhrase(item.anchor, patterns);
  }
  return false;
}

function sanitizeLibro(libro, patterns) {
  const removed = [];
  
  // ═══════════════════════════════════════════════════════════════════
  // 🌒 FIX RAÍZ v2 — bug "bloque vacío" (Vende como loco) + desync og (Historias)
  // ───────────────────────────────────────────────────────────────────
  // ANTES este filtro DROPEABA frases truncadas con .filter(), SIN piso-de-4
  // y SIN paridad ES↔EN. Consecuencias verificadas en producción:
  //   • En arrays de LAYOUT FIJO (frases, palabras): al quitar un elemento,
  //     frases quedaba en 3. La app (index.html) pinta SIEMPRE 4 bloques
  //     (for i<4) → el bloque sin frase salía VACÍO bajo su label.
  //   • En arrays PARALELOS (frases_og / edition_blocks / og_phrases): dropeaba
  //     un lado (p.ej. ES) y dejaba el otro (EN) intacto → paridad rota,
  //     pool del Eco/OG desincronizado.
  // Aguas abajo del pipeline corre el COMPLETER LLM grounded
  // (auditoria-editorial/phrase-sanitizer-llm.cjs), que completa FIEL cada
  // truncamiento (jerarquía completar→recortar→remover) respetando
  // campo-obligatorio y piso-de-pool, y espeja a tarjeta/base/presentación.
  // Por eso el drop determinista es REDUNDANTE y DAÑINO: borra lo que el
  // completer habría reparado correctamente.
  // FIX: NO removemos nada aquí. Delegamos 100% al completer LLM.
  //      `removed` queda vacío → totalRemoved=0 → 0 mutaciones al catálogo.
  // ═══════════════════════════════════════════════════════════════════
  const cleanArray = (arr, _srcName) => arr;
  const cleanString = (_obj, _key, _srcName) => { /* no-op: delegado al completer LLM grounded */ };
  
  // NIVEL 1: campos visibles en la app
  ['frases', 'frases_og', 'frases_en', 'og_phrases_es', 'og_phrases_en'].forEach(k => {
    if (Array.isArray(libro[k])) {
      libro[k] = cleanArray(libro[k], k);
    }
  });
  if (Array.isArray(libro.edition_blocks_es)) {
    libro.edition_blocks_es = cleanArray(libro.edition_blocks_es, 'edition_blocks_es');
  }
  if (Array.isArray(libro.edition_blocks_en)) {
    libro.edition_blocks_en = cleanArray(libro.edition_blocks_en, 'edition_blocks_en');
  }
  
  // NIVEL 2: campos _nucleus.* (trazabilidad — la app no los muestra pero por
  // doctrina nivel dios cuantico-quark se limpian también)
  if (libro._nucleus) {
    // v1.3.2: TODOS los arrays de phrases en _nucleus
    ['frases', 'frases_og', 'frases_en', 'og_phrases_es', 'og_phrases_en'].forEach(k => {
      if (Array.isArray(libro._nucleus[k])) {
        libro._nucleus[k] = cleanArray(libro._nucleus[k], '_nucleus.' + k);
      }
    });
    if (Array.isArray(libro._nucleus.edition_blocks_es)) {
      libro._nucleus.edition_blocks_es = cleanArray(libro._nucleus.edition_blocks_es, '_nucleus.edition_blocks_es');
    }
    if (Array.isArray(libro._nucleus.edition_blocks_en)) {
      libro._nucleus.edition_blocks_en = cleanArray(libro._nucleus.edition_blocks_en, '_nucleus.edition_blocks_en');
    }
    // v1.3.2: card_es y card_en (parrafoTop, parrafoBot son strings sueltos)
    if (libro._nucleus.card_es) {
      cleanString(libro._nucleus.card_es, 'parrafoTop', '_nucleus.card_es.parrafoTop');
      cleanString(libro._nucleus.card_es, 'parrafoBot', '_nucleus.card_es.parrafoBot');
    }
    if (libro._nucleus.card_en) {
      cleanString(libro._nucleus.card_en, 'parrafoTop', '_nucleus.card_en.parrafoTop');
      cleanString(libro._nucleus.card_en, 'parrafoBot', '_nucleus.card_en.parrafoBot');
    }
  }
  
  return removed;
}

function sanitizeCatalog(libros, patternsRaw) {
  if (!Array.isArray(libros) || libros.length === 0) {
    return { totalRemoved: 0, perLibro: [] };
  }
  
  const compiled = (patternsRaw || []).map(p => {
    if (p instanceof RegExp) return p;
    return new RegExp(p, 'i');
  });
  
  if (compiled.length === 0) {
    return { totalRemoved: 0, perLibro: [] };
  }
  
  let totalRemoved = 0;
  const perLibro = [];
  
  libros.forEach((libro, i) => {
    const removed = sanitizeLibro(libro, compiled);
    if (removed.length > 0) {
      perLibro.push({
        idx: i + 1,
        titulo: libro.titulo,
        autor: libro.autor,
        removed
      });
      totalRemoved += removed.length;
    }
  });
  
  return { totalRemoved, perLibro };
}

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    const m = arg.match(/^--([^=]+)=?(.*)$/);
    if (m) args[m[1]] = m[2] || true;
  });
  return args;
}

function main() {
  const args = parseArgs();
  if (!args.catalog || !args.rules) {
    console.error('USO: node sanitizer.cjs --catalog=path.json --rules=rules-kids.json [--report-only]');
    process.exit(1);
  }
  
  const catalog = JSON.parse(fs.readFileSync(args.catalog, 'utf8'));
  const rules = JSON.parse(fs.readFileSync(args.rules, 'utf8'));
  const patterns = rules.truncation_patterns || [];
  
  if (patterns.length === 0) {
    console.log('No truncation_patterns in rules - nothing to sanitize');
    process.exit(0);
  }
  
  console.log('🔬 Sanitizer: profile=' + (rules.profile || '?') + ', patterns=' + patterns.length);
  
  const libros = catalog.libros || [];
  const result = sanitizeCatalog(libros, patterns);
  
  console.log('Total truncated phrases: ' + result.totalRemoved);
  console.log('Libros afectados: ' + result.perLibro.length);
  console.log('');
  
  result.perLibro.forEach(l => {
    console.log('[' + l.idx + '] ' + l.titulo + ' - ' + (l.autor || '?'));
    l.removed.forEach(r => {
      console.log('  REMOVED ' + r.src + ': "' + r.text + '"');
    });
  });
  
  if (args['report-only']) {
    console.log('');
    console.log('(report-only mode - no changes written)');
    process.exit(0);
  }
  
  if (result.totalRemoved > 0) {
    const backupPath = args.catalog + '.bak-sanitize-' + 
      new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    fs.copyFileSync(args.catalog, backupPath);
    fs.writeFileSync(args.catalog, JSON.stringify(catalog, null, 2), 'utf8');
    console.log('');
    console.log('✓ Catalog updated. Backup: ' + backupPath);
  } else {
    console.log('');
    console.log('✓ Catalog clean - no changes needed');
  }
}

if (require.main === module) {
  main();
}

module.exports = { sanitizeCatalog, sanitizeLibro, isTruncatedPhrase };
