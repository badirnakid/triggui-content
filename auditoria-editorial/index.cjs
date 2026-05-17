#!/usr/bin/env node
'use strict';
/**
 * auditoria-editorial — Entry point principal v1.1.0
 * Pipeline: SANITIZE -> SCORE -> DECIDE -> APPLY -> REPORT
 */
const fs = require('fs');
const path = require('path');

const { sanitizeCatalog } = require('./sanitizer.cjs');
const { scoreBook } = require('./scorer.cjs');
const { decide } = require('./decider.cjs');
const { applyToContenido, applyToCSV } = require('./actions.cjs');
const {
  generateConsoleReport,
  generateMarkdownReport,
  generateJSONReport,
  generateGitHubSummary
} = require('./reporter.cjs');

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    const m = arg.match(/^--([^=]+)=?(.*)$/);
    if (m) args[m[1]] = m[2] || true;
  });

  const required = ['catalog', 'profile'];
  for (const r of required) {
    if (!args[r]) {
      console.error('Falta --' + r);
      console.error('USO: node index.cjs --catalog=path/contenido.json --profile=kids|adult [--mode=report|quarantine|auto-fix] [--csv=path] [--output-dir=path]');
      process.exit(1);
    }
  }

  args.mode = args.mode || 'report';
  args['output-dir'] = args['output-dir'] || '.';

  if (!['report', 'quarantine', 'auto-fix'].includes(args.mode)) {
    console.error('Mode invalido: ' + args.mode);
    process.exit(1);
  }
  if (!['kids', 'adult'].includes(args.profile)) {
    console.error('Profile invalido: ' + args.profile);
    process.exit(1);
  }

  return args;
}

function main() {
  const args = parseArgs();

  const rulesPath = path.join(__dirname, 'rules-' + args.profile + '.json');
  if (!fs.existsSync(rulesPath)) {
    console.error('Rules no encontradas: ' + rulesPath);
    process.exit(1);
  }
  const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

  if (!fs.existsSync(args.catalog)) {
    console.error('Catalog no encontrado: ' + args.catalog);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(args.catalog, 'utf8'));
  const libros = data.libros || [];

  if (libros.length === 0) {
    console.error('Catalog vacio');
    process.exit(1);
  }

  console.log('');
  console.log('Auditoria editorial iniciando...');
  console.log('   Catalog:  ' + args.catalog);
  console.log('   Profile:  ' + args.profile);
  console.log('   Mode:     ' + args.mode);
  console.log('   Books:    ' + libros.length);
  console.log('');

  // ═══════════════════════════════════════════════════════════════════
  // FASE 0 — SANITIZACION (truncamientos LLM)
  // ═══════════════════════════════════════════════════════════════════
  const truncationPatterns = rules.truncation_patterns || [];
  let sanitizationReport = { totalRemoved: 0, perLibro: [] };
  
  if (truncationPatterns.length > 0) {
    if (args.mode === 'report') {
      // En modo report: NO modificar, solo detectar (clonar para no mutar)
      const clone = JSON.parse(JSON.stringify(libros));
      sanitizationReport = sanitizeCatalog(clone, truncationPatterns);
      if (sanitizationReport.totalRemoved > 0) {
        console.log('🔬 Sanitizer (dry-run): ' + sanitizationReport.totalRemoved + ' phrases truncadas detectadas en ' + sanitizationReport.perLibro.length + ' libros');
      }
    } else {
      // En quarantine/auto-fix: modificar in-place (se escribe al final)
      sanitizationReport = sanitizeCatalog(libros, truncationPatterns);
      if (sanitizationReport.totalRemoved > 0) {
        console.log('🔬 Sanitizer: ' + sanitizationReport.totalRemoved + ' phrases truncadas removidas de ' + sanitizationReport.perLibro.length + ' libros');
        sanitizationReport.perLibro.forEach(l => {
          console.log('   - [' + l.idx + '] ' + l.titulo + ': ' + l.removed.length + ' phrases');
        });
        // Persistir el catalog ya sanitizado ANTES del scoring
        fs.writeFileSync(args.catalog, JSON.stringify(data, null, 2), 'utf8');
        console.log('   ✓ Catalog persistido (post-sanitize, pre-scoring)');
      }
    }
    console.log('');
  }

  // ═══════════════════════════════════════════════════════════════════
  // FASE 1 — SCORE + DECIDE
  // ═══════════════════════════════════════════════════════════════════
  const decisions = libros.map((libro, i) => {
    const scoring = scoreBook(libro, i + 1, libros, rules);
    const decision = decide(scoring, rules);
    return Object.assign({}, scoring, decision);
  });

  // ═══════════════════════════════════════════════════════════════════
  // FASE 2 — APPLY (remove + quarantine + CSV)
  // ═══════════════════════════════════════════════════════════════════
  let results = { kept: 0, warned: 0, quarantined: 0, removed: 0, modifications: [] };
  let csvResults = { modifications: [], removed: 0, deduped: 0 };

  if (args.mode !== 'report') {
    results = applyToContenido(args.catalog, decisions, args.mode);
    if (args.csv) {
      csvResults = applyToCSV(args.csv, decisions, args.mode);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // FASE 3 — REPORTS
  // ═══════════════════════════════════════════════════════════════════
  generateConsoleReport(decisions, {
    profile: args.profile,
    mode: args.mode,
    totalLibros: libros.length,
    results
  });

  const outputDir = args['output-dir'];
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const jsonPath = path.join(outputDir, 'audit-' + args.profile + '-' + ts + '.json');
  const mdPath = path.join(outputDir, 'audit-' + args.profile + '-' + ts + '.md');

  const jsonReport = generateJSONReport(decisions, {
    profile: args.profile, mode: args.mode, totalLibros: libros.length, results
  });
  jsonReport.sanitization = sanitizationReport;

  fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2), 'utf8');
  fs.writeFileSync(mdPath, generateMarkdownReport(decisions, {
    profile: args.profile, mode: args.mode, totalLibros: libros.length, results
  }), 'utf8');

  console.log('Reportes guardados:');
  console.log('   - ' + jsonPath);
  console.log('   - ' + mdPath);

  if (results.backup) console.log('Backup catalog: ' + results.backup);
  if (csvResults.backup) console.log('Backup CSV:     ' + csvResults.backup);
  
  if (sanitizationReport.totalRemoved > 0 && args.mode !== 'report') {
    console.log('Sanitizer aplico: ' + sanitizationReport.totalRemoved + ' truncadas removidas');
  }

  generateGitHubSummary(decisions, {
    profile: args.profile,
    mode: args.mode,
    totalLibros: libros.length
  });

  console.log('');
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { main };
