'use strict';
/**
 * normalizer.cjs — Funciones puras de normalización
 */

function normalizeTitle(t) {
  if (!t || typeof t !== 'string') return '';
  let s = t.toLowerCase();
  s = s
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/[ñ]/g, 'n');
  s = s.replace(/[^a-z0-9]+/g, ' ').trim();
  return s;
}

function normalizeAuthor(a) {
  if (!a || typeof a !== 'string') return '';
  let s = a.toLowerCase();
  s = s
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[\.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

function isSVGFallback(portada) {
  if (!portada || typeof portada !== 'string') return true;
  if (portada.startsWith('data:image/svg')) return true;
  if (portada.startsWith('data:') && portada.substring(0, 50).includes('svg')) return true;
  return false;
}

function hasKeywordMatch(text, keywords) {
  if (!text || !Array.isArray(keywords)) return null;
  const norm = normalizeTitle(text);
  for (const kw of keywords) {
    if (norm.includes(kw.toLowerCase())) return kw;
  }
  return null;
}

function inAllowlist(text, allowlist) {
  if (!text || !Array.isArray(allowlist)) return false;
  const norm = normalizeTitle(text);
  for (const allowed of allowlist) {
    if (norm === normalizeTitle(allowed)) return true;
    if (norm.includes(normalizeTitle(allowed))) return true;
  }
  return false;
}

module.exports = {
  normalizeTitle, normalizeAuthor, isSVGFallback, hasKeywordMatch, inAllowlist
};
