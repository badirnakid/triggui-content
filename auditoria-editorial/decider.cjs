'use strict';
/**
 * decider.cjs — Decisiones basadas en score + vetos.
 */

function decide(scoring, rules) {
  const { score, vetos, flags, is_manual, titulo, autor } = scoring;

  if (is_manual) {
    return {
      decision: 'PROTECTED',
      reason: 'manual_curated_book_never_auto_modify',
      score,
      severity: 'info',
      action_summary: 'No action — book is human-curated'
    };
  }

  if (vetos.length > 0) {
    const dupVeto = vetos.find(v => v.startsWith('duplicate_of'));
    if (dupVeto) {
      return {
        decision: 'REMOVE',
        reason: 'Duplicate: ' + dupVeto,
        score,
        severity: 'critical',
        action_summary: 'Remove duplicate (lower quality version)',
        veto_type: 'duplicate'
      };
    }

    const criticalKwVeto = vetos.find(v => v.startsWith('critical_keyword_in_title'));
    if (criticalKwVeto) {
      return {
        decision: 'REMOVE',
        reason: 'Critical keyword in title: ' + criticalKwVeto,
        score,
        severity: 'critical',
        action_summary: 'Remove from catalog + CSV master',
        veto_type: 'critical_keyword'
      };
    }

    const audienceVeto = vetos.find(v => v.startsWith('non_infantile'));
    if (audienceVeto) {
      return {
        decision: 'REMOVE',
        reason: 'Book does not match kids audience target',
        score,
        severity: 'critical',
        action_summary: 'Remove from kids catalog + kids CSV',
        veto_type: 'audience_mismatch'
      };
    }

    // v1.2.0: SVG fallback (sin portada real) -> QUARANTINE
    // (no REMOVE porque se puede regenerar cuando la portada exista)
    const svgVeto = vetos.find(v => v.startsWith('svg_fallback'));
    if (svgVeto) {
      return {
        decision: 'QUARANTINE',
        reason: 'No real cover obtained (SVG fallback) - book waits for next batch to retry grounding',
        score,
        severity: 'high',
        action_summary: 'Move to quarantine until cover is obtained',
        veto_type: 'svg_fallback'
      };
    }

    return {
      decision: 'REMOVE',
      reason: 'Multiple vetos: ' + vetos.join(', '),
      score,
      severity: 'critical',
      action_summary: 'Remove from catalog + CSV',
      veto_type: 'multiple'
    };
  }

  const t = rules.thresholds;
  if (score >= t.keep) {
    return {
      decision: 'KEEP',
      reason: 'Score ' + score + ' >= ' + t.keep,
      score,
      severity: 'ok',
      action_summary: 'Publish normally'
    };
  }

  if (score >= t.keep_with_warning) {
    return {
      decision: 'KEEP_WITH_WARNING',
      reason: 'Score ' + score + ' (between ' + t.keep_with_warning + ' and ' + t.keep + ')',
      score,
      severity: 'warning',
      action_summary: 'Publish with _audit_warnings flag',
      warnings: flags
    };
  }

  if (score >= t.quarantine) {
    return {
      decision: 'QUARANTINE',
      reason: 'Score ' + score + ' (between ' + t.quarantine + ' and ' + t.keep_with_warning + ')',
      score,
      severity: 'high',
      action_summary: 'Move to quarantine.json for manual review',
      warnings: flags
    };
  }

  return {
    decision: 'REMOVE',
    reason: 'Score ' + score + ' < ' + t.quarantine + ' (too low)',
    score,
    severity: 'critical',
    action_summary: 'Remove from catalog (low quality)',
    veto_type: 'low_score',
    warnings: flags
  };
}

module.exports = { decide };
