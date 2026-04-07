#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const ROOT = process.cwd();
const OUTPUTS_DIR = path.join(ROOT, 'tests', 'outputs');

const DEFAULTS = {
  model: 'gpt-4o-mini',
  temperature: 0.4,
  constitutionPath: path.join(ROOT, 'prompts', 'constitution', 'triggui-core.md'),
  constrainedTaskPath: path.join(ROOT, 'prompts', 'tasks', 'select-book.md'),
  discoverTaskPath: path.join(ROOT, 'prompts', 'tasks', 'select-book-discover.md'),
  schemaPath: path.join(ROOT, 'prompts', 'schemas', 'book-selection-request.json'),
  repairScriptPath: path.join(ROOT, 'scripts', 'repair-book-selection-metadata.mjs'),
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

function stripCodeFences(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
  }
  return trimmed;
}

function toKebabCase(value) {
  return String(value || '')
    .replace(/\.json$/i, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function detectDiscoverMode(fixture) {
  const selectionMode = fixture?.selection_mode;
  const candidates = Array.isArray(fixture?.catalog_candidates) ? fixture.catalog_candidates : [];
  return selectionMode === 'discover_allowed' && candidates.length === 0;
}

function inferLensPaths(fixture) {
  const names = [];

  if (fixture?.lens?.primary) {
    names.push(String(fixture.lens.primary));
  }

  if (Array.isArray(fixture?.lens?.secondary)) {
    for (const item of fixture.lens.secondary) {
      if (item) names.push(String(item));
    }
  }

  const dedup = [...new Set(names)];

  return dedup.map((name) => ({
    name,
    path: path.join(ROOT, 'prompts', 'lenses', `${name}.md`),
  }));
}

function buildOutputPrefix(fixturePath) {
  const base = path.basename(fixturePath, '.json');
  return `book-selection__${toKebabCase(base)}__new-system`;
}

async function readText(filePath) {
  return readFile(filePath, 'utf8');
}

async function readJson(filePath) {
  return JSON.parse(await readText(filePath));
}

async function getNextRunNumber(prefix) {
  await mkdir(OUTPUTS_DIR, { recursive: true });
  const files = await readdir(OUTPUTS_DIR).catch(() => []);

  const candidates = files
    .filter(
      (file) =>
        file.startsWith(`${prefix}__model-`) &&
        file.endsWith('.json') &&
        file.includes('__run-')
    )
    .map((file) => {
      const match = file.match(/__run-(\d+)\.json$/);
      return match ? Number.parseInt(match[1], 10) : null;
    })
    .filter((n) => Number.isFinite(n));

  const maxRun = candidates.length ? Math.max(...candidates) : 0;
  return maxRun + 1;
}

async function assertFilesExist(paths) {
  for (const filePath of paths) {
    try {
      await readFile(filePath, 'utf8');
    } catch {
      throw new Error(`No encontré el archivo requerido: ${filePath}`);
    }
  }
}

async function callOpenAI({ apiKey, model, temperature, systemPrompt, userPrompt }) {
  if (!apiKey) {
    throw new Error('Falta OPENAI_KEY u OPENAI_API_KEY en el entorno.');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('La respuesta de OpenAI llegó vacía o sin content.');
  }

  return JSON.parse(stripCodeFences(content));
}

async function runMetadataRepair({ scriptPath, outputPath }) {
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [scriptPath, `--output=${outputPath}`],
      {
        cwd: ROOT,
        env: process.env,
        maxBuffer: 10 * 1024 * 1024,
      }
    );

    const raw = String(stdout || '').trim();
    if (!raw) {
      throw new Error('El script de repair no devolvió salida.');
    }

    let parsed;
    try {
      parsed = JSON.parse(stripCodeFences(raw));
    } catch (error) {
      throw new Error(
        `No pude parsear la salida JSON del repair.\nSalida recibida:\n${raw.slice(0, 2000)}`
      );
    }

    if (Number(parsed?.suspicious_count || 0) > 0) {
      throw new Error(
        `Metadata repair dejó ${parsed.suspicious_count} caso(s) suspicious. Se detiene el runner para no aceptar metadata dudosa.`
      );
    }

    return parsed;
  } catch (error) {
    const stdout = typeof error?.stdout === 'string' ? error.stdout.trim() : '';
    const stderr = typeof error?.stderr === 'string' ? error.stderr.trim() : '';
    const message =
      error instanceof Error ? error.message : 'Falló la ejecución del metadata repair.';

    const details = [message];
    if (stderr) details.push(`STDERR:\n${stderr}`);
    if (stdout) details.push(`STDOUT:\n${stdout}`);

    throw new Error(details.join('\n\n'));
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const fixturePath = args.fixture
    ? path.resolve(String(args.fixture))
    : null;

  if (!fixturePath) {
    throw new Error(
      'Falta --fixture=/ruta/al/fixture.json'
    );
  }

  const model = String(args.model || DEFAULTS.model);
  const temperature = Number.parseFloat(String(args.temperature || DEFAULTS.temperature));
  const constitutionPath = path.resolve(String(args.constitution || DEFAULTS.constitutionPath));
  const constrainedTaskPath = path.resolve(
    String(args.constrainedTask || DEFAULTS.constrainedTaskPath)
  );
  const discoverTaskPath = path.resolve(
    String(args.discoverTask || DEFAULTS.discoverTaskPath)
  );
  const schemaPath = path.resolve(String(args.schema || DEFAULTS.schemaPath));
  const repairScriptPath = path.resolve(String(args.repairScript || DEFAULTS.repairScriptPath));

  const fixture = await readJson(fixturePath);
  const isDiscoverMode = detectDiscoverMode(fixture);
  const taskPath = isDiscoverMode ? discoverTaskPath : constrainedTaskPath;

  const lensInfo = inferLensPaths(fixture);
  if (!lensInfo.length) {
    throw new Error('No pude inferir lentes desde el fixture.');
  }

  await assertFilesExist([
    constitutionPath,
    taskPath,
    schemaPath,
    ...(isDiscoverMode ? [repairScriptPath] : []),
    ...lensInfo.map((item) => item.path),
  ]);

  const [constitution, task, schema, ...lensContents] = await Promise.all([
    readText(constitutionPath),
    readText(taskPath),
    readText(schemaPath),
    ...lensInfo.map((item) => readText(item.path)),
  ]);

  const systemPrompt = [
    constitution.trim(),
    task.trim(),
    ...lensContents.map((s) => s.trim()),
    `Output schema reference:\n${schema.trim()}`,
    `
Hard response rules:
- Return only valid JSON.
- Do not use markdown fences.
- Obey the fixture exactly.
- Match the fixture language.
- If discover mode is active, do not collapse into generic workplace books unless they clearly beat lens-native candidates.
- If constrained mode is active and catalog candidates exist, obey the catalog.
`.trim(),
  ].join('\n\n---\n\n');

  const caseId = path.basename(fixturePath, '.json');
  const userPrompt = `Test fixture for ${caseId}:
${JSON.stringify(fixture, null, 2)}

Return only the final JSON response for this case.`;

  const outputPrefix = String(args.outputPrefix || buildOutputPrefix(fixturePath));
  const runNumber = await getNextRunNumber(outputPrefix);
  const runLabel = String(runNumber).padStart(2, '0');
  const outputFileName = `${outputPrefix}__model-${model}__run-${runLabel}.json`;
  const outputPath = path.join(OUTPUTS_DIR, outputFileName);

  console.log('🧠 Piezas leídas');
  console.log(`🧭 Mode: ${isDiscoverMode ? 'discover' : 'constrained'}`);
  console.log(`🪞 Lenses: ${lensInfo.map((item) => item.name).join(', ')}`);
  console.log('🚀 Enviando a OpenAI...');

  const json = await callOpenAI({
    apiKey: process.env.OPENAI_KEY || process.env.OPENAI_API_KEY,
    model,
    temperature,
    systemPrompt,
    userPrompt,
  });

  await writeFile(outputPath, JSON.stringify(json, null, 2) + '\n', 'utf8');

  if (isDiscoverMode) {
    console.log('🩹 Reparando metadata discover...');
    const repairResult = await runMetadataRepair({
      scriptPath: repairScriptPath,
      outputPath,
    });

    console.log(
      `🧾 Metadata repair: confirmed=${repairResult.confirmed_count} normalized=${repairResult.normalized_count} suspicious=${repairResult.suspicious_count} applied=${repairResult.applied_changes_count ?? 0}`
    );
  }

  console.log('✅ Output guardado');
  console.log(`📁 tests/outputs/${outputFileName}`);
}

main().catch((error) => {
  console.error('❌ Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});