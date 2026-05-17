'use strict';
/**
 * reporter.cjs — Genera reportes en multiples formatos.
 */
const fs = require('fs');
const path = require('path');

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m'
};

function decisionTag(d) {
  switch (d) {
    case 'KEEP': return '[KEEP]';
    case 'PROTECTED': return '[PROT]';
    case 'KEEP_WITH_WARNING': return '[WARN]';
    case 'QUARANTINE': return '[QUAR]';
    case 'REMOVE': return '[REMV]';
    default: return '[????]';
  }
}

function severityColor(sev) {
  switch (sev) {
    case 'critical': return C.red;
    case 'high': return C.yellow;
    case 'warning': return C.yellow;
    case 'ok': return C.green;
    case 'info': return C.gray;
    default: return C.reset;
  }
}

function generateConsoleReport(decisions, opts) {
  const profile = opts.profile;
  const mode = opts.mode;
  const totalLibros = opts.totalLibros;

  console.log('');
  console.log('===========================================================================');
  console.log(C.bold + 'AUDITORIA EDITORIAL NIVEL DIOS - Profile: ' + profile.toUpperCase() + C.reset);
  console.log('   Mode: ' + mode + '   |   Total libros: ' + totalLibros);
  console.log('===========================================================================');
  console.log('');

  const counts = { KEEP: 0, PROTECTED: 0, KEEP_WITH_WARNING: 0, QUARANTINE: 0, REMOVE: 0 };
  decisions.forEach(d => { counts[d.decision] = (counts[d.decision] || 0) + 1; });

  console.log(C.bold + 'RESUMEN:' + C.reset);
  console.log('   [KEEP] KEEP:               ' + counts.KEEP);
  console.log('   [PROT] PROTECTED:          ' + counts.PROTECTED);
  console.log('   [WARN] KEEP_WITH_WARNING:  ' + counts.KEEP_WITH_WARNING);
  console.log('   [QUAR] QUARANTINE:         ' + counts.QUARANTINE);
  console.log('   [REMV] REMOVE:             ' + counts.REMOVE);
  console.log('');

  console.log('===========================================================================');
  console.log(C.bold + 'LIBRO POR LIBRO (ordenado por score asc):' + C.reset);
  console.log('===========================================================================');

  const sorted = decisions.slice().sort((a, b) => a.score - b.score);
  sorted.forEach(d => {
    const color = severityColor(d.severity);
    const tag = decisionTag(d.decision);
    const scoreStr = d.score.toFixed(3);
    const tituloShort = d.titulo && d.titulo.length > 45 ? d.titulo.substring(0, 43) + '..' : (d.titulo || '');
    const autorShort = d.autor && d.autor.length > 25 ? d.autor.substring(0, 23) + '..' : (d.autor || '');
    console.log(
      '  ' + tag + ' [' + String(d.idx).padStart(2) + '] ' +
      color + d.decision.padEnd(20) + C.reset + ' ' +
      'score=' + scoreStr + '  ' +
      tituloShort.padEnd(47) + ' ' + autorShort
    );
  });

  const problematic = decisions.filter(d =>
    d.decision === 'REMOVE' || d.decision === 'QUARANTINE'
  );

  if (problematic.length > 0) {
    console.log('');
    console.log('===========================================================================');
    console.log(C.bold + 'DETALLE DE ACCIONES (libros a remover/quarantine):' + C.reset);
    console.log('===========================================================================');

    problematic.forEach(d => {
      console.log('');
      console.log(decisionTag(d.decision) + ' [' + d.idx + '] "' + d.titulo + '" - ' + (d.autor || '?'));
      console.log('     Decision:  ' + severityColor(d.severity) + d.decision + C.reset);
      console.log('     Score:     ' + d.score.toFixed(3));
      console.log('     Razon:     ' + d.reason);
      console.log('     Accion:    ' + d.action_summary);
      if (d.warnings && d.warnings.length > 0) {
        console.log('     Flags:     ' + d.warnings.join(', '));
      }
      if (d.dimensions) {
        const dimStr = Object.entries(d.dimensions)
          .map(kv => kv[0] + '=' + (typeof kv[1] === 'number' ? kv[1].toFixed(2) : kv[1]))
          .join(' | ');
        console.log('     Breakdown: ' + dimStr);
      }
    });
  }

  console.log('');
  console.log('===========================================================================');
  console.log(C.bold + 'VEREDICTO:' + C.reset);
  if (counts.REMOVE === 0 && counts.QUARANTINE === 0) {
    console.log('   ' + C.green + 'NIVEL DIOS - Catalogo perfecto, listo para publicar' + C.reset);
  } else if (counts.REMOVE > 0) {
    console.log('   ' + C.red + counts.REMOVE + ' libros a REMOVER' + C.reset);
    if (counts.QUARANTINE > 0) {
      console.log('   ' + C.yellow + counts.QUARANTINE + ' libros a QUARANTINE' + C.reset);
    }
  } else if (counts.QUARANTINE > 0) {
    console.log('   ' + C.yellow + counts.QUARANTINE + ' libros a QUARANTINE (revision manual)' + C.reset);
  }
  console.log('===========================================================================');
  console.log('');
}

function generateMarkdownReport(decisions, opts) {
  const profile = opts.profile;
  const mode = opts.mode;
  const totalLibros = opts.totalLibros;
  const results = opts.results;

  let md = '# Audit Report - Triggui ' + profile.toUpperCase() + '\n\n';
  md += '**Date:** ' + new Date().toISOString() + '\n';
  md += '**Profile:** ' + profile + '\n';
  md += '**Mode:** ' + mode + '\n';
  md += '**Total books:** ' + totalLibros + '\n\n';

  const counts = { KEEP: 0, PROTECTED: 0, KEEP_WITH_WARNING: 0, QUARANTINE: 0, REMOVE: 0 };
  decisions.forEach(d => { counts[d.decision] = (counts[d.decision] || 0) + 1; });

  md += '## Summary\n\n';
  md += '| Decision | Count | % |\n|---|---|---|\n';
  Object.keys(counts).forEach(k => {
    const v = counts[k];
    const pct = ((v / totalLibros) * 100).toFixed(1);
    md += '| ' + decisionTag(k) + ' ' + k + ' | ' + v + ' | ' + pct + '% |\n';
  });
  md += '\n';

  const removed = decisions.filter(d => d.decision === 'REMOVE');
  if (removed.length > 0) {
    md += '## REMOVED (' + removed.length + ')\n\n';
    removed.forEach(d => {
      md += '### [' + d.idx + '] ' + d.titulo + '\n';
      md += '- **Author:** ' + (d.autor || '?') + '\n';
      md += '- **Score:** ' + d.score.toFixed(3) + '\n';
      md += '- **Reason:** ' + d.reason + '\n';
      md += '- **Action:** ' + d.action_summary + '\n\n';
    });
  }

  const quarantined = decisions.filter(d => d.decision === 'QUARANTINE');
  if (quarantined.length > 0) {
    md += '## QUARANTINED (' + quarantined.length + ')\n\n';
    quarantined.forEach(d => {
      md += '### [' + d.idx + '] ' + d.titulo + '\n';
      md += '- **Author:** ' + (d.autor || '?') + '\n';
      md += '- **Score:** ' + d.score.toFixed(3) + '\n';
      md += '- **Reason:** ' + d.reason + '\n\n';
    });
  }

  const warned = decisions.filter(d => d.decision === 'KEEP_WITH_WARNING');
  if (warned.length > 0) {
    md += '## WARNINGS (' + warned.length + ')\n\n';
    warned.forEach(d => {
      md += '### [' + d.idx + '] ' + d.titulo + '\n';
      md += '- **Score:** ' + d.score.toFixed(3) + '\n';
      md += '- **Warnings:** ' + (d.warnings || []).join(', ') + '\n\n';
    });
  }

  return md;
}

function generateJSONReport(decisions, opts) {
  const profile = opts.profile;
  const mode = opts.mode;
  const totalLibros = opts.totalLibros;
  const results = opts.results;
  return {
    audit_version: '1.0.0',
    profile: profile,
    mode: mode,
    timestamp: new Date().toISOString(),
    total_analyzed: totalLibros,
    summary: {
      keep: decisions.filter(d => d.decision === 'KEEP').length,
      protected: decisions.filter(d => d.decision === 'PROTECTED').length,
      keep_with_warning: decisions.filter(d => d.decision === 'KEEP_WITH_WARNING').length,
      quarantined: decisions.filter(d => d.decision === 'QUARANTINE').length,
      removed: decisions.filter(d => d.decision === 'REMOVE').length
    },
    results: results,
    decisions: decisions.map(d => ({
      idx: d.idx,
      titulo: d.titulo,
      autor: d.autor,
      score: d.score,
      decision: d.decision,
      severity: d.severity,
      reason: d.reason,
      action_summary: d.action_summary,
      dimensions: d.dimensions,
      vetos: d.vetos,
      flags: d.flags || d.warnings,
      veto_type: d.veto_type
    }))
  };
}

function generateGitHubSummary(decisions, opts) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;

  const counts = { KEEP: 0, PROTECTED: 0, KEEP_WITH_WARNING: 0, QUARANTINE: 0, REMOVE: 0 };
  decisions.forEach(d => { counts[d.decision] = (counts[d.decision] || 0) + 1; });

  let s = '## Auditoria Editorial - ' + opts.profile.toUpperCase() + ' (mode: ' + opts.mode + ')\n\n';
  s += '**Total libros:** ' + opts.totalLibros + '\n\n';
  s += '| Decision | Count |\n|---|---|\n';
  s += '| KEEP | ' + counts.KEEP + ' |\n';
  s += '| PROTECTED | ' + counts.PROTECTED + ' |\n';
  s += '| WITH_WARNING | ' + counts.KEEP_WITH_WARNING + ' |\n';
  s += '| QUARANTINE | ' + counts.QUARANTINE + ' |\n';
  s += '| REMOVE | ' + counts.REMOVE + ' |\n\n';

  const problematic = decisions.filter(d =>
    d.decision === 'REMOVE' || d.decision === 'QUARANTINE'
  );
  if (problematic.length > 0) {
    s += '### Acciones tomadas\n\n';
    problematic.forEach(d => {
      s += '- ' + decisionTag(d.decision) + ' **' + d.titulo + '** (score ' + d.score.toFixed(2) + ') - ' + d.reason + '\n';
    });
  }

  fs.appendFileSync(summaryPath, s + '\n');
}

module.exports = {
  generateConsoleReport,
  generateMarkdownReport,
  generateJSONReport,
  generateGitHubSummary
};
