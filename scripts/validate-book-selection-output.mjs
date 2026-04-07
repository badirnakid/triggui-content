#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const LENS_RULES = {
  'game-theory': {
    minSelectedScore: 4,
    minBodyHits: 2,
    strongerAlternativeMargin: 2,
    positiveTitleTerms: [
      'game theory',
      'game',
      'games',
      'strategy',
      'strategic',
      'conflict',
      'cooperation',
      'cooperate',
      'coordination',
      'negotiation',
      'bargaining',
      'signal',
      'signals',
      'signaling',
      'reputation',
      'commitment',
      'equilibrium',
      'payoff',
      'repeated',
      'incentive',
      'incentives',
    ],
    positiveBodyTerms: [
      'teoria de juegos',
      'teoría de juegos',
      'juegos repetidos',
      'incentivos',
      'incentivo',
      'senales',
      'señales',
      'signal',
      'signals',
      'signaling',
      'reputacion',
      'reputación',
      'cooperacion',
      'cooperación',
      'cooperacion rota',
      'cooperación rota',
      'conflicto',
      'coordinacion',
      'coordinación',
      'compromiso',
      'equilibrio',
      'payoff',
      'estrategia',
      'estrategico',
      'estratégico',
      'repetidas',
      'repetidos',
      'negociacion',
      'negociación',
      'credibilidad',
    ],
    negativeTitleTerms: [
      'team',
      'teams',
      'conversation',
      'conversations',
      'habit',
      'habits',
      'leadership',
      'leader',
      'leaders',
      'management',
      'manager',
      'managers',
      'motivates',
      'motivation',
      'drive',
      'effective',
      'effectiveness',
      'dysfunction',
      'dysfunctions',
      'communication',
      'people',
      'workplace',
    ],
    genericBodyTerms: [
      'teamwork',
      'trabajo en equipo',
      'comunicacion',
      'comunicación',
      'liderazgo',
      'leadership',
      'motivacion',
      'motivación',
      'management',
      'manager',
      'workplace',
      'equipo',
      'disfunciones',
      'dysfunctions',
    ],
    canonicalAuthors: [
      'schelling',
      'binmore',
      'nash',
      'axelrod',
      'aumann',
      'myerson',
      'osborne',
      'shoham',
      'leyton brown',
      'hardin',
    ],
  },
};

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [rawKey, ...rest] = arg.slice(2).split('=');
    const key = rawKey.trim();
    const value = rest.join('=').trim();
    if (!key) continue;
    out[key] = value === '' ? true : value;
  }
  return out;
}

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (value === true) return true;

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'si', 'sí', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;

  return defaultValue;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uniqBooks(items) {
  const seen = new Set();
  const out = [];

  for (const item of items) {
    const title = String(item?.title || '').trim();
    const author = String(item?.author || '').trim();
    const key = `${title}__${author}`.toLowerCase();
    if (!title || seen.has(key)) continue;
    seen.add(key);
    out.push({ title, author });
  }

  return out;
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenSet(value) {
  return new Set(normalize(value).split(' ').filter(Boolean));
}

function overlapScore(a, b) {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (!left.size || !right.size) return 0;

  let hits = 0;
  for (const token of left) {
    if (right.has(token)) hits += 1;
  }

  return hits / Math.max(left.size, right.size);
}

function titleEquivalent(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na) || overlapScore(a, b) >= 0.7;
}

function splitAuthorPeople(value) {
  return String(value || '')
    .split(/\s*,\s*|\s+\|\s+|\s+&\s+|\s+\by\b\s+|\s+\band\b\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function personNameParts(value) {
  const tokens = normalize(value).split(' ').filter(Boolean);
  if (!tokens.length) {
    return {
      tokens: [],
      surname: '',
      given: [],
      initials: [],
    };
  }

  const surname = tokens[tokens.length - 1] || '';
  const given = tokens.slice(0, -1);
  const initials = given.map((token) => token[0]).filter(Boolean);

  return { tokens, surname, given, initials };
}

function singlePersonEquivalent(a, b) {
  const pa = personNameParts(a);
  const pb = personNameParts(b);

  if (!pa.surname || !pb.surname) return false;
  if (pa.surname !== pb.surname) return false;

  if (normalize(a) === normalize(b)) return true;
  if (overlapScore(a, b) >= 0.45) return true;

  if (pa.given.length === 0 || pb.given.length === 0) return true;

  const firstA = pa.given[0] || '';
  const firstB = pb.given[0] || '';
  if (firstA && firstB && (firstA.startsWith(firstB) || firstB.startsWith(firstA))) {
    return true;
  }

  const minLen = Math.min(pa.initials.length, pb.initials.length);
  if (minLen > 0) {
    let compatible = true;
    for (let i = 0; i < minLen; i += 1) {
      if (pa.initials[i] !== pb.initials[i]) {
        compatible = false;
        break;
      }
    }
    if (compatible) return true;
  }

  return false;
}

function authorEquivalent(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na) || overlapScore(a, b) >= 0.45) return true;

  const peopleA = splitAuthorPeople(a);
  const peopleB = splitAuthorPeople(b);

  for (const left of peopleA) {
    for (const right of peopleB) {
      if (singlePersonEquivalent(left, right)) {
        return true;
      }
    }
  }

  return false;
}

function authorVariants(author) {
  const base = String(author || '').trim();
  const variants = new Set();

  if (!base) return [''];

  variants.add(base);
  variants.add(base.replace(/\sy\s/gi, ' and '));
  variants.add(base.replace(/\sand\s/gi, ' y '));
  variants.add(base.replace(/\sy\s/gi, ' & '));
  variants.add(base.replace(/\s&\s/gi, ' and '));
  variants.add(base.replace(/\s&\s/gi, ' y '));

  const firstByComma = base.split(',')[0].trim();
  if (firstByComma) variants.add(firstByComma);

  const firstByAnd = base.split(/\sy\s|\sand\s|\s&\s/i)[0].trim();
  if (firstByAnd) variants.add(firstByAnd);

  return [...variants].filter(Boolean);
}

function detectDiscoverMode(fixture) {
  const selectionMode = fixture?.selection_mode;
  const candidates = Array.isArray(fixture?.catalog_candidates) ? fixture.catalog_candidates : [];
  return selectionMode === 'discover_allowed' && candidates.length === 0;
}

function getPrimaryLens(fixture) {
  return String(fixture?.lens?.primary || '').trim();
}

function countTermHits(text, terms) {
  const haystack = normalize(text);
  if (!haystack) return 0;

  let hits = 0;
  for (const term of terms) {
    const needle = normalize(term);
    if (!needle) continue;
    if (haystack.includes(needle)) hits += 1;
  }

  return hits;
}

function gatherEntryTexts(entry, kind = 'selected') {
  if (!entry) {
    return {
      titleAuthorText: '',
      bodyText: '',
      fullText: '',
    };
  }

  const title = String(entry.title || '').trim();
  const author = String(entry.author || '').trim();

  let bodyParts = [];
  if (kind === 'selected') {
    bodyParts = [
      String(entry.why_this_book || ''),
      String(entry?.fit?.trigger_fit || ''),
      String(entry?.fit?.lens_fit || ''),
      String(entry?.fit?.timing_fit || ''),
    ];
  } else {
    bodyParts = [String(entry.reason || '')];
  }

  const titleAuthorText = [title, author].filter(Boolean).join(' ');
  const bodyText = bodyParts.filter(Boolean).join(' ');
  const fullText = [titleAuthorText, bodyText].filter(Boolean).join(' ');

  return { titleAuthorText, bodyText, fullText };
}

function scoreLensNative(entry, lensRule, kind = 'selected') {
  const { titleAuthorText, bodyText, fullText } = gatherEntryTexts(entry, kind);

  const positiveTitleHits = countTermHits(titleAuthorText, lensRule.positiveTitleTerms);
  const positiveBodyHits = countTermHits(bodyText, lensRule.positiveBodyTerms);
  const negativeTitleHits = countTermHits(titleAuthorText, lensRule.negativeTitleTerms);
  const genericBodyHits = countTermHits(bodyText, lensRule.genericBodyTerms);
  const canonicalAuthorHits = countTermHits(titleAuthorText, lensRule.canonicalAuthors);

  const score =
    positiveTitleHits * 3 +
    canonicalAuthorHits * 4 +
    positiveBodyHits * 1 -
    negativeTitleHits * 3 -
    genericBodyHits * 1;

  return {
    score,
    positive_title_hits: positiveTitleHits,
    positive_body_hits: positiveBodyHits,
    negative_title_hits: negativeTitleHits,
    generic_body_hits: genericBodyHits,
    canonical_author_hits: canonicalAuthorHits,
    title_author_text: titleAuthorText,
    body_text: bodyText,
    full_text: fullText,
  };
}

function validateDiscoverSemantics(outputJson, fixture) {
  const primaryLens = getPrimaryLens(fixture);
  const lensRule = LENS_RULES[primaryLens];

  if (!primaryLens || !lensRule) {
    return {
      enabled: false,
      primary_lens: primaryLens || null,
      issues: [],
      selected_score: null,
      alternative_scores: [],
      rejection_scores: [],
      rationale: 'No semantic discover rules configured for this lens.',
    };
  }

  const issues = [];
  const selectedEntry = outputJson?.selected_book || {};
  const selectedAnalysis = scoreLensNative(selectedEntry, lensRule, 'selected');

  const alternatives = Array.isArray(outputJson?.alternatives) ? outputJson.alternatives : [];
  const rejections = Array.isArray(outputJson?.rejections) ? outputJson.rejections : [];

  const alternativeScores = alternatives.map((entry, index) => ({
    index,
    title: String(entry?.title || '').trim(),
    author: String(entry?.author || '').trim(),
    ...scoreLensNative(entry, lensRule, 'alternative'),
  }));

  const rejectionScores = rejections.map((entry, index) => ({
    index,
    title: String(entry?.title || '').trim(),
    author: String(entry?.author || '').trim(),
    ...scoreLensNative(entry, lensRule, 'rejection'),
  }));

  const strongestAlternative = [...alternativeScores].sort((a, b) => b.score - a.score)[0] || null;

  if (selectedAnalysis.score < lensRule.minSelectedScore) {
    issues.push(
      `Selected book is not lens-native enough for discover. selected_score=${selectedAnalysis.score}, required_min=${lensRule.minSelectedScore}.`
    );
  }

  if (selectedAnalysis.positive_body_hits < lensRule.minBodyHits) {
    issues.push(
      `Selected explanation does not anchor strongly enough in the active lens. body_hits=${selectedAnalysis.positive_body_hits}, required_min=${lensRule.minBodyHits}.`
    );
  }

  if (
    selectedAnalysis.positive_title_hits === 0 &&
    selectedAnalysis.canonical_author_hits === 0 &&
    selectedAnalysis.negative_title_hits > 0
  ) {
    issues.push(
      'Selected title/author reads as generic workplace-management material instead of a lens-native discover choice.'
    );
  }

  if (
    strongestAlternative &&
    strongestAlternative.score >= selectedAnalysis.score + lensRule.strongerAlternativeMargin
  ) {
    issues.push(
      `At least one alternative is materially more lens-native than the selected book. selected_score=${selectedAnalysis.score}, strongest_alternative_score=${strongestAlternative.score}, strongest_alternative="${strongestAlternative.title}".`
    );
  }

  return {
    enabled: true,
    primary_lens: primaryLens,
    issues,
    selected_score: {
      title: String(selectedEntry?.title || '').trim(),
      author: String(selectedEntry?.author || '').trim(),
      ...selectedAnalysis,
    },
    alternative_scores: alternativeScores,
    rejection_scores: rejectionScores,
    rationale:
      issues.length === 0
        ? 'Selected discover output looks lens-native enough for the active lens.'
        : 'Discover output has semantic quality issues for the active lens.',
  };
}

async function fetchJsonWithRetry(url, label, options = {}) {
  const retries = Number.isFinite(options.retries) ? options.retries : 4;
  const baseDelayMs = Number.isFinite(options.baseDelayMs) ? options.baseDelayMs : 1200;

  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'triggui-content-validator/1.0',
          Accept: 'application/json',
        },
      });

      if (res.status === 429) {
        lastError = new Error(`${label} 429`);
        if (attempt < retries) {
          await sleep(baseDelayMs * attempt);
          continue;
        }
        throw lastError;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`${label} ${res.status}${text ? `: ${text.slice(0, 180)}` : ''}`);
      }

      return await res.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < retries) {
        await sleep(baseDelayMs * attempt);
        continue;
      }
    }
  }

  throw lastError || new Error(`${label} fetch failed`);
}

async function searchAppleBooks(queryTitle, queryAuthor) {
  const term = encodeURIComponent([queryTitle, queryAuthor].filter(Boolean).join(' ').trim());
  const url = `https://itunes.apple.com/search?term=${term}&media=ebook&country=US&limit=5`;
  const data = await fetchJsonWithRetry(url, 'Apple Books', {
    retries: 4,
    baseDelayMs: 1200,
  });

  return Array.isArray(data.results) ? data.results : [];
}

async function searchGoogleBooks(queryTitle, queryAuthor) {
  const q = queryAuthor
    ? encodeURIComponent(`intitle:${queryTitle} inauthor:${queryAuthor}`)
    : encodeURIComponent(`intitle:${queryTitle}`);
  const url = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=5&printType=books`;
  const data = await fetchJsonWithRetry(url, 'Google Books', {
    retries: 4,
    baseDelayMs: 1400,
  });

  return Array.isArray(data.items) ? data.items : [];
}

async function searchOpenLibrary(queryTitle, queryAuthor) {
  const url = queryAuthor
    ? `https://openlibrary.org/search.json?title=${encodeURIComponent(queryTitle)}&author=${encodeURIComponent(queryAuthor)}&limit=5`
    : `https://openlibrary.org/search.json?title=${encodeURIComponent(queryTitle)}&limit=5`;

  const data = await fetchJsonWithRetry(url, 'Open Library', {
    retries: 3,
    baseDelayMs: 900,
  });

  return Array.isArray(data.docs) ? data.docs : [];
}

function scoreCandidate(
  { source, title, authors, publishedDate = '', categories = '', infoLink = '' },
  wantedTitle,
  wantedAuthor,
  queryLabel
) {
  let score = 0;

  const titleNorm = normalize(title);
  const wantedTitleNorm = normalize(wantedTitle);
  const authorNorm = normalize(authors);
  const wantedAuthorNorm = normalize(wantedAuthor);

  if (titleNorm === wantedTitleNorm) score += 6;
  else if (titleNorm.includes(wantedTitleNorm) || wantedTitleNorm.includes(titleNorm)) score += 4;
  else score += Math.round(overlapScore(title, wantedTitle) * 3);

  if (wantedAuthorNorm) {
    if (authorNorm === wantedAuthorNorm) score += 5;
    else if (authorNorm.includes(wantedAuthorNorm) || wantedAuthorNorm.includes(authorNorm)) score += 4;
    else if (authorEquivalent(authors, wantedAuthor)) score += 4;
    else score += Math.round(overlapScore(authors, wantedAuthor) * 2);
  }

  return {
    source,
    query_label: queryLabel,
    score,
    title,
    authors,
    publishedDate,
    categories,
    infoLink,
  };
}

async function gatherCandidates(book) {
  const candidates = [];
  const providerErrors = [];

  const authorVars = authorVariants(book.author);
  const queries = [];

  for (const author of authorVars) {
    queries.push({
      title: book.title,
      author,
      label: author ? `title+author:${author}` : 'title-only',
    });
  }

  queries.push({ title: book.title, author: '', label: 'title-only' });

  const seenQueries = new Set();
  const dedupQueries = queries.filter((query) => {
    const key = `${query.title}__${query.author}`.toLowerCase();
    if (seenQueries.has(key)) return false;
    seenQueries.add(key);
    return true;
  });

  for (const query of dedupQueries) {
    try {
      const apple = await searchAppleBooks(query.title, query.author);
      for (const item of apple) {
        candidates.push(
          scoreCandidate(
            {
              source: 'apple_books',
              title: item?.trackName || item?.collectionName || '',
              authors: item?.artistName || '',
              publishedDate: item?.releaseDate || '',
              categories: Array.isArray(item?.genres) ? item.genres.join(' | ') : '',
              infoLink: item?.trackViewUrl || item?.artistViewUrl || '',
            },
            book.title,
            book.author,
            query.label
          )
        );
      }
    } catch (error) {
      providerErrors.push(error instanceof Error ? error.message : String(error));
    }

    await sleep(350);

    try {
      const google = await searchGoogleBooks(query.title, query.author);
      for (const item of google) {
        const info = item?.volumeInfo || {};
        candidates.push(
          scoreCandidate(
            {
              source: 'google_books',
              title: info.title || '',
              authors: Array.isArray(info.authors) ? info.authors.join(' | ') : '',
              publishedDate: info.publishedDate || '',
              categories: Array.isArray(info.categories) ? info.categories.join(' | ') : '',
              infoLink: info.infoLink || '',
            },
            book.title,
            book.author,
            query.label
          )
        );
      }
    } catch (error) {
      providerErrors.push(error instanceof Error ? error.message : String(error));
    }

    await sleep(350);

    try {
      const open = await searchOpenLibrary(query.title, query.author);
      for (const item of open) {
        candidates.push(
          scoreCandidate(
            {
              source: 'open_library',
              title: item?.title || '',
              authors: Array.isArray(item?.author_name) ? item.author_name.join(' | ') : '',
              publishedDate: item?.first_publish_year ? String(item.first_publish_year) : '',
              categories: Array.isArray(item?.subject) ? item.subject.slice(0, 5).join(' | ') : '',
              infoLink: item?.key ? `https://openlibrary.org${item.key}` : '',
            },
            book.title,
            book.author,
            query.label
          )
        );
      }
    } catch (error) {
      providerErrors.push(error instanceof Error ? error.message : String(error));
    }

    await sleep(550);
  }

  const dedup = new Map();
  for (const candidate of candidates) {
    const key = `${normalize(candidate.title)}__${normalize(candidate.authors)}__${candidate.source}`;
    const prev = dedup.get(key);
    if (!prev || candidate.score > prev.score) {
      dedup.set(key, candidate);
    }
  }

  return {
    providerErrors,
    candidates: [...dedup.values()].sort((a, b) => b.score - a.score),
  };
}

function titleConsensusCount(candidates, inputTitle) {
  const agreeingSources = new Set();
  for (const candidate of candidates) {
    if (titleEquivalent(candidate.title, inputTitle)) {
      agreeingSources.add(candidate.source);
    }
  }
  return agreeingSources.size;
}

function classifyMetadataValidation(book, candidates) {
  const best = candidates[0] || null;
  const second = candidates[1] || null;

  if (!best) {
    return {
      status: 'suspicious',
      rationale: 'No provider returned a plausible candidate.',
    };
  }

  const titleMatches = titleEquivalent(best.title, book.title);
  const authorMatches = authorEquivalent(best.authors, book.author);
  const consensus = titleConsensusCount(candidates, book.title);
  const clearMargin = !second || best.score - second.score >= 2;

  if (titleMatches && authorMatches && best.score >= 9) {
    return {
      status: 'confirmed',
      rationale: 'Strong title + author match.',
    };
  }

  if (titleMatches && best.score >= 8 && consensus >= 2) {
    return {
      status: 'confirmed',
      rationale: 'Strong multi-source title consensus.',
    };
  }

  if (titleMatches && best.score >= 6 && (authorMatches || consensus >= 2 || clearMargin)) {
    return {
      status: 'normalized',
      rationale: 'Title is stable; bibliographic variants look acceptable.',
    };
  }

  if (titleMatches && authorMatches && clearMargin) {
    return {
      status: 'normalized',
      rationale: 'Title matches and author variant is compatible after abbreviation/expansion normalization.',
    };
  }

  if (titleMatches && !authorMatches && best.score >= 6) {
    return {
      status: 'normalized',
      rationale: 'Title matches; author variant looks acceptable after normalization.',
    };
  }

  return {
    status: 'suspicious',
    rationale: 'No reliable title+author match with enough confidence.',
  };
}

async function validateBook(book) {
  const { providerErrors, candidates } = await gatherCandidates(book);
  const best = candidates[0] || null;
  const classification = classifyMetadataValidation(book, candidates);

  return {
    input_title: book.title,
    input_author: book.author,
    matched: classification.status !== 'suspicious',
    metadata_status: classification.status,
    metadata_rationale: classification.rationale,
    best_match_score: best?.score ?? 0,
    best_match_source: best?.source ?? null,
    best_match_title: best?.title ?? null,
    best_match_authors: best?.authors ?? null,
    published_date: best?.publishedDate ?? null,
    categories: best?.categories ?? null,
    info_link: best?.infoLink ?? null,
    provider_errors: providerErrors,
    provider_candidates: candidates.slice(0, 5),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputPath = args.output ? path.resolve(String(args.output)) : null;
  const fixturePath = args.fixture ? path.resolve(String(args.fixture)) : null;
  const strict = parseBoolean(args.strict, false);

  if (!outputPath) {
    throw new Error('Falta --output=/ruta/al/output.json');
  }

  const outputJson = await readJson(outputPath);
  const fixture = fixturePath ? await readJson(fixturePath) : null;

  const books = uniqBooks([
    outputJson?.selected_book,
    ...(Array.isArray(outputJson?.alternatives) ? outputJson.alternatives : []),
    ...(Array.isArray(outputJson?.rejections) ? outputJson.rejections : []),
  ]);

  const validations = [];
  for (const book of books) {
    const result = await validateBook(book);
    validations.push(result);
    await sleep(500);
  }

  const metadataSuspicious = validations.filter((validation) => !validation.matched);

  let discoverSemantic = {
    enabled: false,
    primary_lens: null,
    issues: [],
    selected_score: null,
    alternative_scores: [],
    rejection_scores: [],
    rationale: fixturePath
      ? 'Fixture present, but semantic discover validation was not activated.'
      : 'No fixture provided; semantic discover validation skipped.',
  };

  if (fixture && detectDiscoverMode(fixture)) {
    discoverSemantic = validateDiscoverSemantics(outputJson, fixture);
  }

  const semanticIssueCount = Array.isArray(discoverSemantic.issues)
    ? discoverSemantic.issues.length
    : 0;

  const passed = metadataSuspicious.length === 0 && semanticIssueCount === 0;

  const report = {
    output: outputPath,
    fixture: fixturePath || null,
    total_books_checked: validations.length,
    metadata_suspicious_count: metadataSuspicious.length,
    semantic_issue_count: semanticIssueCount,
    passed,
    discover_semantic: discoverSemantic,
    validations,
  };

  console.log(JSON.stringify(report, null, 2));

  if (strict && !passed) {
    const reasons = [];
    if (metadataSuspicious.length > 0) {
      reasons.push(`metadata_suspicious_count=${metadataSuspicious.length}`);
    }
    if (semanticIssueCount > 0) {
      reasons.push(`semantic_issue_count=${semanticIssueCount}`);
    }

    throw new Error(`Validation failed: ${reasons.join(', ')}`);
  }
}

main().catch((error) => {
  console.error('❌ Error validating books');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});