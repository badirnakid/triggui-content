#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

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

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function authorEquivalent(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na) || overlapScore(a, b) >= 0.45;
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

async function fetchJsonWithRetry(url, label, options = {}) {
  const retries = Number.isFinite(options.retries) ? options.retries : 4;
  const baseDelayMs = Number.isFinite(options.baseDelayMs) ? options.baseDelayMs : 1000;

  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'triggui-discover-normalizer/1.0',
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
  const data = await fetchJsonWithRetry(url, 'Apple Books', { retries: 4, baseDelayMs: 1200 });
  return Array.isArray(data.results) ? data.results : [];
}

async function searchGoogleBooks(queryTitle, queryAuthor) {
  const q = queryAuthor
    ? encodeURIComponent(`intitle:${queryTitle} inauthor:${queryAuthor}`)
    : encodeURIComponent(`intitle:${queryTitle}`);
  const url = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=5&printType=books`;
  const data = await fetchJsonWithRetry(url, 'Google Books', { retries: 4, baseDelayMs: 1400 });
  return Array.isArray(data.items) ? data.items : [];
}

async function searchOpenLibrary(queryTitle, queryAuthor) {
  const url = queryAuthor
    ? `https://openlibrary.org/search.json?title=${encodeURIComponent(queryTitle)}&author=${encodeURIComponent(queryAuthor)}&limit=5`
    : `https://openlibrary.org/search.json?title=${encodeURIComponent(queryTitle)}&limit=5`;

  const data = await fetchJsonWithRetry(url, 'Open Library', { retries: 3, baseDelayMs: 900 });
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
  const dedupQueries = queries.filter((q) => {
    const key = `${q.title}__${q.author}`.toLowerCase();
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

    await sleep(300);

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

    await sleep(300);

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

    await sleep(500);
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
  for (const c of candidates) {
    if (titleEquivalent(c.title, inputTitle)) {
      agreeingSources.add(c.source);
    }
  }
  return agreeingSources.size;
}

function classifyRepair(book, candidates) {
  const best = candidates[0] || null;
  const second = candidates[1] || null;

  if (!best) {
    return {
      status: 'suspicious',
      suggested_title: null,
      suggested_author: null,
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
      suggested_title: best.title,
      suggested_author: best.authors,
      rationale: 'Strong title + author match.',
    };
  }

  if (titleMatches && best.score >= 8 && consensus >= 2) {
    return {
      status: 'confirmed',
      suggested_title: best.title,
      suggested_author: best.authors || book.author,
      rationale: 'Strong multi-source title consensus.',
    };
  }

  if (titleMatches && best.score >= 6 && (authorMatches || consensus >= 2 || clearMargin)) {
    return {
      status: 'normalized',
      suggested_title: best.title,
      suggested_author: best.authors || book.author,
      rationale: 'Title is stable; metadata should be normalized.',
    };
  }

  if (titleMatches && !authorMatches && best.score >= 6) {
    return {
      status: 'normalized',
      suggested_title: best.title,
      suggested_author: best.authors || null,
      rationale: 'Title matches but author appears corrupted or incomplete.',
    };
  }

  return {
    status: 'suspicious',
    suggested_title: null,
    suggested_author: null,
    rationale: 'No reliable title+author repair with enough confidence.',
  };
}

async function repairBook(book) {
  const { providerErrors, candidates } = await gatherCandidates(book);
  const best = candidates[0] || null;
  const classification = classifyRepair(book, candidates);

  return {
    input_title: book.title,
    input_author: book.author,
    status: classification.status,
    rationale: classification.rationale,
    suggested_title: classification.suggested_title,
    suggested_author: classification.suggested_author,
    best_match_score: best?.score ?? 0,
    best_match_source: best?.source ?? null,
    best_match_title: best?.title ?? null,
    best_match_authors: best?.authors ?? null,
    provider_errors: providerErrors,
    top_candidates: candidates.slice(0, 5),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputPath = args.output ? path.resolve(String(args.output)) : null;

  if (!outputPath) {
    throw new Error('Falta --output=/ruta/al/output.json');
  }

  const json = await readJson(outputPath);

  const buckets = [
    { label: 'selected_book', items: json?.selected_book ? [json.selected_book] : [] },
    { label: 'alternatives', items: Array.isArray(json?.alternatives) ? json.alternatives : [] },
    { label: 'rejections', items: Array.isArray(json?.rejections) ? json.rejections : [] },
  ];

  const repairs = [];
  for (const bucket of buckets) {
    for (const item of bucket.items) {
      const result = await repairBook({
        title: item?.title || '',
        author: item?.author || '',
      });

      repairs.push({
        bucket: bucket.label,
        ...result,
      });

      await sleep(500);
    }
  }

  const suspicious = repairs.filter((r) => r.status === 'suspicious');
  const normalized = repairs.filter((r) => r.status === 'normalized');
  const confirmed = repairs.filter((r) => r.status === 'confirmed');

  console.log(
    JSON.stringify(
      {
        output: outputPath,
        total_books_checked: repairs.length,
        confirmed_count: confirmed.length,
        normalized_count: normalized.length,
        suspicious_count: suspicious.length,
        repairs,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error('❌ Error repairing book metadata');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});