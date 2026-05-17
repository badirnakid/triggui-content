'use strict';
/**
 * scorer.cjs — Calcula score multidimensional para un libro.
 */
const {
  normalizeTitle, normalizeAuthor, isSVGFallback,
  hasKeywordMatch, inAllowlist
} = require('./normalizer.cjs');

function extractAllPhrases(libro) {
  const phrases = [];

  const edition = libro.edition_blocks_es || (libro._nucleus && libro._nucleus.edition_blocks_es) || [];
  if (Array.isArray(edition)) {
    edition.forEach(b => {
      if (b && typeof b === 'object') {
        if (b.phrase) phrases.push(String(b.phrase));
        if (b.anchor) phrases.push(String(b.anchor));
      }
    });
  }

  const frases = libro.frases || (libro._nucleus && libro._nucleus.frases) || [];
  if (Array.isArray(frases)) {
    frases.forEach(f => f && phrases.push(String(f)));
  }

  const ogEs = libro.og_phrases_es || [];
  if (Array.isArray(ogEs)) ogEs.forEach(f => f && phrases.push(String(f)));

  const ogEn = libro.og_phrases_en || [];
  if (Array.isArray(ogEn)) ogEn.forEach(f => f && phrases.push(String(f)));

  return phrases;
}

function detectDuplicate(libro, idx1based, allLibros) {
  const myIdx0 = idx1based - 1;
  const titNorm = normalizeTitle(libro.titulo);

  const matches = [];
  allLibros.forEach((other, otherIdx0) => {
    if (otherIdx0 === myIdx0) return;
    const otherTitNorm = normalizeTitle(other.titulo);
    if (otherTitNorm === titNorm && titNorm !== '') {
      matches.push({ idx0: otherIdx0, libro: other });
    }
  });

  if (matches.length === 0) return { isDup: false };

  const myPortadaOk = !isSVGFallback(libro.portada);
  const candidates = [{ idx0: myIdx0, libro, portadaOk: myPortadaOk }];
  matches.forEach(m => {
    candidates.push({
      idx0: m.idx0,
      libro: m.libro,
      portadaOk: !isSVGFallback(m.libro.portada)
    });
  });

  candidates.sort((a, b) => {
    if (a.portadaOk && !b.portadaOk) return -1;
    if (!a.portadaOk && b.portadaOk) return 1;
    return a.idx0 - b.idx0;
  });

  const best = candidates[0];
  return {
    isDup: true,
    dupOf: matches[0].idx0 + 1,
    isBest: best.idx0 === myIdx0,
    bestIdx: best.idx0 + 1
  };
}

function scoreAudienciaMatch(libro, rules) {
  const titNorm = normalizeTitle(libro.titulo);
  const autNorm = normalizeAuthor(libro.autor);

  if (inAllowlist(libro.titulo, rules.allowlist_titles)) return 1.0;
  if (rules.allowlist_authors && rules.allowlist_authors.some(a => autNorm.includes(a))) return 1.0;

  for (const pattern of rules.non_infantile_patterns) {
    if (titNorm.includes(normalizeTitle(pattern))) return 0.2;
  }

  return 0.85;
}

function scoreConfidenceGrounding(libro) {
  const conf = libro._confidence || libro.confidence ||
    (libro._nucleus && libro._nucleus.confidence) || null;
  if (conf === null || typeof conf !== 'number') return 0.5;
  if (conf >= 0.85) return 1.0;
  if (conf >= 0.70) return 0.85;
  if (conf >= 0.55) return 0.65;
  if (conf >= 0.40) return 0.40;
  return 0.20;
}

function scoreJudgesQuality(libro) {
  const judgeEs = libro._judge_es || (libro._nucleus && libro._nucleus.judge_es);
  const judgeEn = libro._judge_en || (libro._nucleus && libro._nucleus.judge_en);

  if (judgeEs === undefined && judgeEn === undefined) return 0.7;

  const es = (typeof judgeEs === 'number') ? judgeEs : 0.7;
  const en = (typeof judgeEn === 'number') ? judgeEn : 0.7;
  return (es + en) / 2;
}

function scoreWarnings(libro) {
  const warnings = libro._warnings || libro.warnings ||
    (libro._nucleus && libro._nucleus.warnings) || [];
  if (!Array.isArray(warnings) || warnings.length === 0) return 1.0;

  const criticalPatterns = [
    'uncorrectable', 'evidence_exhausted', 'voice_judge_extended_degraded',
    'fallback_svg', 'inferencia'
  ];

  let critical = 0;
  let normal = 0;
  warnings.forEach(w => {
    const str = typeof w === 'string' ? w : (w.code || JSON.stringify(w));
    const lower = str.toLowerCase();
    if (criticalPatterns.some(p => lower.includes(p))) critical++;
    else normal++;
  });

  if (critical >= 2) return 0.3;
  if (critical === 1) return 0.6;
  if (normal >= 3) return 0.7;
  return 0.85;
}

function scoreBook(libro, idx, allLibros, rules) {
  const dimensions = {};
  const vetos = [];
  const flags = [];

  const isSvg = isSVGFallback(libro.portada);
  dimensions.portada_real = isSvg ? 0 : 1;
  if (isSvg) {
    flags.push('SVG_FALLBACK');
    // v1.2.0: veto svg_fallback si esta activo en rules
    if (rules.veto_rules && rules.veto_rules.svg_fallback) {
      vetos.push('svg_fallback_no_real_cover');
    }
  }

  const critKw = hasKeywordMatch(libro.titulo, rules.critical_keywords_title);
  if (critKw) {
    if (inAllowlist(libro.titulo, rules.allowlist_titles)) {
      dimensions.sin_palabra_critica_titulo = 1;
      flags.push('ALLOWLISTED_CRITICAL_KW:' + critKw);
    } else {
      dimensions.sin_palabra_critica_titulo = 0;
      vetos.push('critical_keyword_in_title:' + critKw);
    }
  } else {
    dimensions.sin_palabra_critica_titulo = 1;
  }

  const sensKw = hasKeywordMatch(libro.titulo, rules.sensitive_keywords_title);
  if (sensKw && !inAllowlist(libro.titulo, rules.allowlist_titles)) {
    flags.push('SENSITIVE_KW:' + sensKw);
    dimensions.sin_palabra_critica_titulo = Math.min(dimensions.sin_palabra_critica_titulo, 0.6);
  }

  const phrases = extractAllPhrases(libro);
  let phraseCritFound = null;
  for (const phrase of phrases) {
    const m = hasKeywordMatch(phrase, rules.critical_keywords_phrases);
    if (m) {
      phraseCritFound = { phrase: phrase.substring(0, 60), keyword: m };
      break;
    }
  }
  if (phraseCritFound) {
    dimensions.sin_palabra_critica_phrases = 0;
    flags.push('CRITICAL_KW_IN_PHRASE:' + phraseCritFound.keyword);
  } else {
    dimensions.sin_palabra_critica_phrases = 1;
  }

  const dup = detectDuplicate(libro, idx, allLibros);
  if (dup.isDup) {
    if (dup.isBest) {
      dimensions.no_duplicado = 1;
      flags.push('DUPLICATE_BEST_VERSION');
    } else {
      dimensions.no_duplicado = 0;
      vetos.push('duplicate_of_idx_' + dup.bestIdx);
    }
  } else {
    dimensions.no_duplicado = 1;
  }

  dimensions.audiencia_match = scoreAudienciaMatch(libro, rules);
  if (dimensions.audiencia_match < 0.4) {
    flags.push('NON_TARGET_AUDIENCE');
    if (rules.profile === 'kids' && !inAllowlist(libro.titulo, rules.allowlist_titles)) {
      vetos.push('non_infantile_audience');
    }
  }

  dimensions.confidence_grounding = scoreConfidenceGrounding(libro);
  dimensions.judges_quality = scoreJudgesQuality(libro);
  dimensions.sin_warnings_pipeline = scoreWarnings(libro);

  let score = 0;
  for (const [dim, value] of Object.entries(dimensions)) {
    const weight = rules.weights[dim] || 0;
    score += value * weight;
  }

  return {
    idx,
    titulo: libro.titulo,
    autor: libro.autor,
    score: Math.round(score * 1000) / 1000,
    dimensions,
    vetos,
    flags,
    is_manual: libro._manual === true
  };
}

module.exports = { scoreBook, extractAllPhrases, detectDuplicate };
