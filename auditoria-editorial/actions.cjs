'use strict';
/**
 * actions.cjs — Ejecuta acciones reales sobre los archivos.
 * v1.0.1: FIX - Solo remueve del CSV los libros marcados como REMOVE
 *               (sin dedupe automático, sin match por solo-titulo).
 */
const fs = require('fs');
const path = require('path');
const { normalizeTitle, normalizeAuthor } = require('./normalizer.cjs');

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
}

function backup(filePath, suffix) {
  if (!fs.existsSync(filePath)) return null;
  suffix = suffix || 'audit';
  const backupPath = filePath + '.bak-' + suffix + '-' + ts();
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function atomicWriteJSON(filePath, data) {
  const tmp = filePath + '.tmp-' + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

function applyToContenido(catalogPath, decisions, mode) {
  const data = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const libros = data.libros || [];

  if (mode === 'report') {
    return {
      kept: decisions.filter(d => d.decision === 'KEEP' || d.decision === 'PROTECTED').length,
      warned: decisions.filter(d => d.decision === 'KEEP_WITH_WARNING').length,
      quarantined: decisions.filter(d => d.decision === 'QUARANTINE').length,
      removed: decisions.filter(d => d.decision === 'REMOVE').length,
      modifications: [],
      backup: null
    };
  }

  const backupPath = backup(catalogPath);
  const newLibros = [];
  const quarantineLibros = [];
  const modifications = [];

  decisions.forEach((dec, i) => {
    const libro = libros[dec.idx - 1];
    if (!libro) {
      modifications.push({ type: 'error', message: 'Libro idx ' + dec.idx + ' not found' });
      return;
    }

    switch (dec.decision) {
      case 'KEEP':
      case 'PROTECTED':
        newLibros.push(libro);
        break;

      case 'KEEP_WITH_WARNING':
        const libroConWarning = Object.assign({}, libro, {
          _audit_warnings: dec.warnings || [],
          _audit_score: dec.score,
          _audit_decision: dec.decision,
          _audit_timestamp: new Date().toISOString()
        });
        newLibros.push(libroConWarning);
        modifications.push({
          type: 'mark_warning',
          idx: dec.idx,
          titulo: libro.titulo,
          warnings: dec.warnings
        });
        break;

      case 'QUARANTINE':
      case 'REMOVE':
        const libroQuar = Object.assign({}, libro, {
          _audit_decision: dec.decision,
          _audit_reason: dec.reason,
          _audit_score: dec.score,
          _audit_severity: dec.severity,
          _audit_timestamp: new Date().toISOString(),
          _audit_veto_type: dec.veto_type
        });

        if (mode === 'quarantine' || mode === 'auto-fix') {
          quarantineLibros.push(libroQuar);
          modifications.push({
            type: dec.decision === 'REMOVE' ? 'remove_to_quarantine' : 'quarantine',
            idx: dec.idx,
            titulo: libro.titulo,
            reason: dec.reason
          });
        }
        break;
    }
  });

  data.libros = newLibros;
  if (data.meta) {
    data.meta.total = newLibros.length;
    data.meta.last_audit = new Date().toISOString();
  }
  atomicWriteJSON(catalogPath, data);

  if (quarantineLibros.length > 0) {
    const quarPath = catalogPath.replace(/\.json$/, '.quarantine.json');
    let quarData = { libros: [], meta: { version: '1.0' } };
    if (fs.existsSync(quarPath)) {
      try {
        quarData = JSON.parse(fs.readFileSync(quarPath, 'utf8'));
        if (!Array.isArray(quarData.libros)) quarData.libros = [];
      } catch (_) {}
    }
    quarData.libros = quarData.libros.concat(quarantineLibros);
    quarData.meta = quarData.meta || {};
    quarData.meta.last_updated = new Date().toISOString();
    quarData.meta.total = quarData.libros.length;
    atomicWriteJSON(quarPath, quarData);

    modifications.push({
      type: 'quarantine_file_updated',
      path: quarPath,
      added_count: quarantineLibros.length
    });
  }

  return {
    kept: newLibros.filter(l => !l._audit_warnings).length,
    warned: newLibros.filter(l => l._audit_warnings).length,
    quarantined: quarantineLibros.filter(l => l._audit_decision === 'QUARANTINE').length,
    removed: quarantineLibros.filter(l => l._audit_decision === 'REMOVE').length,
    modifications,
    backup: backupPath
  };
}

function applyToCSV(csvPath, decisions, mode) {
  if (!fs.existsSync(csvPath)) {
    return { modifications: [], backup: null, removed: 0 };
  }

  if (mode !== 'auto-fix') {
    return { modifications: [], backup: null, removed: 0, skipped: true };
  }

  // FIX v1.0.1: solo remover lineas que EXACTAMENTE matchen
  // titulo+autor normalizado de un REMOVE decision.
  // SIN dedupe automatico (evita borrar libros unicos con
  // variantes ortograficas que normalizan iguales).
  // SIN match por solo titulo (evita borrar libros legitimos
  // con titulo igual pero autor diferente).

  const toRemoveKeys = new Set();
  decisions.forEach(dec => {
    if (dec.decision === 'REMOVE') {
      const key = normalizeTitle(dec.titulo) + '|' + normalizeAuthor(dec.autor);
      toRemoveKeys.add(key);
    }
  });

  if (toRemoveKeys.size === 0) {
    return { modifications: [], backup: null, removed: 0 };
  }

  const backupPath = backup(csvPath, 'audit-csv');
  const csv = fs.readFileSync(csvPath, 'utf8');
  const lines = csv.split('\n');
  if (lines.length === 0) return { modifications: [], backup: backupPath, removed: 0 };

  const header = lines[0];
  const dataLines = lines.slice(1).filter(l => l.trim());

  const newDataLines = [];
  const removedLines = [];

  dataLines.forEach((line, i) => {
    const parts = line.split(',');
    if (parts.length < 2) {
      newDataLines.push(line);
      return;
    }
    const titulo = parts[0].trim();
    const autor = parts.slice(1).join(',').trim();

    const key = normalizeTitle(titulo) + '|' + normalizeAuthor(autor);

    if (toRemoveKeys.has(key)) {
      removedLines.push({ lineNum: i + 2, line, titulo, autor });
    } else {
      newDataLines.push(line);
    }
  });

  const newCSV = [header].concat(newDataLines).join('\n') + '\n';
  fs.writeFileSync(csvPath + '.tmp', newCSV, 'utf8');
  fs.renameSync(csvPath + '.tmp', csvPath);

  return {
    backup: backupPath,
    removed: removedLines.length,
    deduped: 0,
    modifications: removedLines.map(r => ({
      type: 'csv_line_removed',
      line: r.line.substring(0, 80)
    }))
  };
}

module.exports = { applyToContenido, applyToCSV };
