#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const OUTPUTS_DIR = path.join(ROOT, 'tests', 'outputs');

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

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toKebabCase(value) {
  return String(value || '')
    .replace(/\.json$/i, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function buildNewPrefix(fixturePath) {
  return `book-selection__${toKebabCase(path.basename(fixturePath, '.json'))}__new-system`;
}

function buildLegacyPrefix(fixturePath) {
  return `book-selection__${toKebabCase(path.basename(fixturePath, '.json'))}__legacy-baseline`;
}

function buildComparisonPrefix(fixturePath) {
  return `book-selection__${toKebabCase(path.basename(fixturePath, '.json'))}__comparison__new-vs-legacy`;
}

async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function findLatestOutput(prefix, extension = '.json') {
  const files = await readdir(OUTPUTS_DIR).catch(() => []);
  const regex = new RegExp(
    `^${escapeRegex(prefix)}__model-[^_]+(?:-[^_]+)*__run-(\\d+)${escapeRegex(extension)}$`
  );

  let best = null;

  for (const file of files) {
    const match = file.match(regex);
    if (!match) continue;
    const run = Number.parseInt(match[1], 10);
    if (!Number.isFinite(run)) continue;
    if (!best || run > best.run) {
      best = { file, run };
    }
  }

  if (!best) {
    throw new Error(`No encontré outputs para el prefijo: ${prefix}`);
  }

  return path.join(OUTPUTS_DIR, best.file);
}

async function getNextComparisonPath(prefix) {
  await mkdir(OUTPUTS_DIR, { recursive: true });
  const files = await readdir(OUTPUTS_DIR).catch(() => []);
  const regex = new RegExp(`^${escapeRegex(prefix)}__run-(\\d+)\\.md$`);

  let maxRun = 0;
  for (const file of files) {
    const match = file.match(regex);
    if (!match) continue;
    const run = Number.parseInt(match[1], 10);
    if (Number.isFinite(run) && run > maxRun) {
      maxRun = run;
    }
  }

  const next = String(maxRun + 1).padStart(2, '0');
  return path.join(OUTPUTS_DIR, `${prefix}__run-${next}.md`);
}

function normalizeTitle(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function safe(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function yesNo(value) {
  return value ? 'Sí' : 'No';
}

function sectionSideBySide(label, left, right) {
  return `### ${label}

**New system**  
${safe(left)}

**Legacy baseline**  
${safe(right)}
`;
}

function pickTitle(item) {
  if (!item) return null;
  if (typeof item === 'string') return item;
  if (typeof item === 'object') {
    return item.title || item.titulo || item.book_title || item.nombre || item.name || null;
  }
  return null;
}

function pickAuthor(item) {
  if (!item || typeof item !== 'object') return null;
  return item.author || item.autor || null;
}

function pickReason(item) {
  if (!item || typeof item !== 'object') return null;
  return (
    item.reason ||
    item.notes ||
    item.note ||
    item.why ||
    item.justification ||
    item.rationale ||
    item.description ||
    null
  );
}

function detectRunSchema(run) {
  if (run?.selected_book) return 'new_system_like';
  if (Array.isArray(run?.recommended_books)) return 'legacy_recommended_books';
  if (Array.isArray(run?.recommendations)) return 'legacy_recommendations';
  return 'unknown';
}

function extractSelectedBook(run) {
  if (run?.selected_book && typeof run.selected_book === 'object') {
    return {
      title: run.selected_book.title ?? null,
      author: run.selected_book.author ?? null,
      why_this_book: run.selected_book.why_this_book ?? null,
      trigger_fit: run.selected_book.fit?.trigger_fit ?? null,
      lens_fit: run.selected_book.fit?.lens_fit ?? null,
      timing_fit: run.selected_book.fit?.timing_fit ?? null,
      selection_source: run.selected_book.selection_source ?? null,
    };
  }

  const legacyList = Array.isArray(run?.recommended_books)
    ? run.recommended_books
    : Array.isArray(run?.recommendations)
      ? run.recommendations
      : [];

  if (legacyList.length > 0) {
    const first = legacyList[0];
    return {
      title: pickTitle(first),
      author: pickAuthor(first),
      why_this_book: pickReason(first),
      trigger_fit: null,
      lens_fit: null,
      timing_fit: null,
      selection_source: null,
    };
  }

  return {
    title: null,
    author: null,
    why_this_book: null,
    trigger_fit: null,
    lens_fit: null,
    timing_fit: null,
    selection_source: null,
  };
}

function extractAlternatives(run) {
  if (Array.isArray(run?.alternatives)) {
    return run.alternatives.map((item) => ({
      title: pickTitle(item),
      author: pickAuthor(item),
      reason: pickReason(item),
    }));
  }

  const legacyList = Array.isArray(run?.recommended_books)
    ? run.recommended_books
    : Array.isArray(run?.recommendations)
      ? run.recommendations
      : [];

  if (legacyList.length > 1) {
    return legacyList.slice(1).map((item) => ({
      title: pickTitle(item),
      author: pickAuthor(item),
      reason: pickReason(item),
    }));
  }

  return [];
}

function extractRejections(run) {
  if (Array.isArray(run?.rejections)) {
    return run.rejections.map((item) => ({
      title: pickTitle(item),
      author: pickAuthor(item),
      reason: pickReason(item),
    }));
  }

  return [];
}

function formatBookList(items) {
  if (!Array.isArray(items) || items.length === 0) return '—';

  return items
    .map((item) => {
      const title = item?.title || '—';
      const author = item?.author ? ` — ${item.author}` : '';
      const reason = item?.reason ? ` :: ${item.reason}` : '';
      return `${title}${author}${reason}`;
    })
    .join('\n');
}

function collectCatalogArrays(node, pathLabel = 'fixture', found = []) {
  if (Array.isArray(node)) {
    const looksLikeBookArray = node.some((item) => {
      if (typeof item === 'string') return true;
      if (item && typeof item === 'object') {
        return Boolean(item.title || item.titulo || item.book_title || item.nombre || item.name);
      }
      return false;
    });

    if (looksLikeBookArray) {
      found.push({ path: pathLabel, items: node });
    }

    node.forEach((item, index) => {
      if (item && typeof item === 'object') {
        collectCatalogArrays(item, `${pathLabel}[${index}]`, found);
      }
    });

    return found;
  }

  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      collectCatalogArrays(value, `${pathLabel}.${key}`, found);
    }
  }

  return found;
}

function extractCatalogEntries(fixture) {
  const arrays = collectCatalogArrays(fixture);
  const entries = [];

  for (const group of arrays) {
    for (const item of group.items) {
      const title = pickTitle(item);
      if (!title) continue;
      entries.push({ path: group.path, title });
    }
  }

  const dedup = new Map();
  for (const entry of entries) {
    const key = `${normalizeTitle(entry.title)}@@${entry.path}`;
    if (!dedup.has(key)) dedup.set(key, entry);
  }

  return [...dedup.values()];
}

function evaluateCatalogMembership(selectedTitle, catalogEntries) {
  if (!selectedTitle) {
    return { detected: catalogEntries.length > 0, exists: false, matches: [] };
  }

  if (!catalogEntries.length) {
    return { detected: false, exists: false, matches: [] };
  }

  const normalized = normalizeTitle(selectedTitle);
  const matches = catalogEntries.filter(
    (entry) => normalizeTitle(entry.title) === normalized
  );

  return {
    detected: true,
    exists: matches.length > 0,
    matches,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fixturePath = args.fixture ? path.resolve(String(args.fixture)) : null;

  if (!fixturePath) {
    throw new Error('Falta --fixture=/ruta/al/fixture.json');
  }

  const newPath = args.new
    ? path.resolve(String(args.new))
    : await findLatestOutput(buildNewPrefix(fixturePath));

  const legacyPath = args.legacy
    ? path.resolve(String(args.legacy))
    : await findLatestOutput(buildLegacyPrefix(fixturePath));

  const comparisonPath = await getNextComparisonPath(buildComparisonPrefix(fixturePath));

  const fixture = await readJson(fixturePath);
  const newRun = await readJson(newPath);
  const legacyRun = await readJson(legacyPath);

  const newSchema = detectRunSchema(newRun);
  const legacySchema = detectRunSchema(legacyRun);

  const newSelected = extractSelectedBook(newRun);
  const legacySelected = extractSelectedBook(legacyRun);

  const newAlternatives = extractAlternatives(newRun);
  const legacyAlternatives = extractAlternatives(legacyRun);

  const newRejections = extractRejections(newRun);
  const legacyRejections = extractRejections(legacyRun);

  const catalogEntries = extractCatalogEntries(fixture);
  const newCatalogCheck = evaluateCatalogMembership(newSelected.title, catalogEntries);
  const legacyCatalogCheck = evaluateCatalogMembership(legacySelected.title, catalogEntries);

  const catalogCheckLine = (check) => {
    if (!check.detected) return 'No determinable (fixture catalog not detected)';
    return check.exists ? 'Sí' : 'No';
  };

  const catalogMatchDetails = (matches) => {
    if (!matches.length) return '—';
    return matches.map((m) => `[${m.path}] ${m.title}`).join('\n');
  };

  const report = `# Comparación formal — ${path.basename(fixturePath, '.json')} — new-system vs legacy-baseline

## Archivos usados
- Fixture: \`${rel(fixturePath)}\`
- New system: \`${rel(newPath)}\`
- Legacy baseline: \`${rel(legacyPath)}\`

## Schema detectado
- New system: ${newSchema}
- Legacy baseline: ${legacySchema}

## Checks automáticos
- JSON válido:
  - New system: Sí
  - Legacy baseline: Sí
- \`selection_source === "catalog"\`:
  - New system: ${yesNo(newSelected.selection_source === 'catalog')}
  - Legacy baseline: ${
    legacySelected.selection_source === null
      ? 'No determinable (schema legacy)'
      : yesNo(legacySelected.selection_source === 'catalog')
  }
- Libro seleccionado existe en catálogo del fixture:
  - New system: ${catalogCheckLine(newCatalogCheck)}
  - Legacy baseline: ${catalogCheckLine(legacyCatalogCheck)}
- Alternatives count:
  - New system: ${newAlternatives.length}
  - Legacy baseline: ${legacyAlternatives.length}
- Rejections count:
  - New system: ${newRejections.length}
  - Legacy baseline: ${legacyRejections.length}

## Coincidencias de catálogo detectadas
### New system selected title matches
${catalogMatchDetails(newCatalogCheck.matches)}

### Legacy baseline selected title matches
${catalogMatchDetails(legacyCatalogCheck.matches)}

## Primeros títulos detectados en fixture
${
  catalogEntries.length
    ? catalogEntries
        .slice(0, 20)
        .map((entry) => `- [${entry.path}] ${entry.title}`)
        .join('\n')
    : '- No se detectó ningún catálogo legible en el fixture'
}

## Comparación lado a lado

${sectionSideBySide('detected_theme.core', newRun?.detected_theme?.core, legacyRun?.detected_theme?.core)}
${sectionSideBySide('detected_theme.subtheme', newRun?.detected_theme?.subtheme, legacyRun?.detected_theme?.subtheme)}
${sectionSideBySide(
  'detected_theme.why_it_matters_now',
  newRun?.detected_theme?.why_it_matters_now,
  legacyRun?.detected_theme?.why_it_matters_now
)}
${sectionSideBySide('selected_book.title', newSelected.title, legacySelected.title)}
${sectionSideBySide('selected_book.author', newSelected.author, legacySelected.author)}
${sectionSideBySide('selected_book.why_this_book', newSelected.why_this_book, legacySelected.why_this_book)}
${sectionSideBySide('selected_book.fit.trigger_fit', newSelected.trigger_fit, legacySelected.trigger_fit)}
${sectionSideBySide('selected_book.fit.lens_fit', newSelected.lens_fit, legacySelected.lens_fit)}
${sectionSideBySide('selected_book.fit.timing_fit', newSelected.timing_fit, legacySelected.timing_fit)}
${sectionSideBySide('alternatives', formatBookList(newAlternatives), formatBookList(legacyAlternatives))}
${sectionSideBySide('rejections', formatBookList(newRejections), formatBookList(legacyRejections))}
`;

  await writeFile(comparisonPath, report, 'utf8');

  console.log('✅ Comparación guardada');
  console.log(`📁 ${rel(comparisonPath)}`);
}

main().catch((error) => {
  console.error('❌ Error generando comparación');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});