#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const OUTPUTS_DIR = path.join(ROOT, 'tests', 'outputs');

const DEFAULTS = {
  model: 'gpt-4o-mini',
  temperature: 0.4,
  constitutionPath: path.join(ROOT, 'prompts', 'constitution', 'triggui-core.md'),
  taskPath: path.join(ROOT, 'prompts', 'tasks', 'select-book.md'),
  lensPaths: [
    path.join(ROOT, 'prompts', 'lenses', 'self-knowledge.md'),
    path.join(ROOT, 'prompts', 'lenses', 'chronobiology.md'),
  ],
  schemaPath: path.join(ROOT, 'prompts', 'schemas', 'book-selection-request.json'),
  fixturePath: path.join(
    ROOT,
    'tests',
    'fixtures',
    'case-003-catalog-only-atencion-friccion.json'
  ),
  outputPrefix: 'book-selection__case-003__new-system',
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

async function callOpenAI({ apiKey, model, temperature, systemPrompt, userPrompt }) {
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

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const model = String(args.model || DEFAULTS.model);
  const temperature = Number.parseFloat(String(args.temperature || DEFAULTS.temperature));
  const constitutionPath = path.resolve(String(args.constitution || DEFAULTS.constitutionPath));
  const taskPath = path.resolve(String(args.task || DEFAULTS.taskPath));
  const schemaPath = path.resolve(String(args.schema || DEFAULTS.schemaPath));
  const fixturePath = path.resolve(String(args.fixture || DEFAULTS.fixturePath));
  const outputPrefix = String(args.outputPrefix || DEFAULTS.outputPrefix);

  const lensPaths = args.lenses
    ? String(args.lenses)
        .split(',')
        .map((s) => path.resolve(s.trim()))
        .filter(Boolean)
    : DEFAULTS.lensPaths;

  const apiKey = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Falta OPENAI_KEY (o OPENAI_API_KEY) en variables de entorno.');
  }

  const [constitution, task, schema, fixture, ...lensContents] = await Promise.all([
    readText(constitutionPath),
    readText(taskPath),
    readText(schemaPath),
    readJson(fixturePath),
    ...lensPaths.map(readText),
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
- If catalog_only is true, the selected book must come from the provided catalog.
`.trim(),
  ].join('\n\n---\n\n');

  const userPrompt = `Test fixture for case-003:
${JSON.stringify(fixture, null, 2)}

Return only the final JSON response for this case.`;

  const runNumber = await getNextRunNumber(outputPrefix);
  const runLabel = String(runNumber).padStart(2, '0');
  const outputFileName = `${outputPrefix}__model-${model}__run-${runLabel}.json`;
  const outputPath = path.join(OUTPUTS_DIR, outputFileName);

  console.log('🧠 Piezas leídas');
  console.log('🚀 Enviando a OpenAI...');

  const json = await callOpenAI({
    apiKey,
    model,
    temperature,
    systemPrompt,
    userPrompt,
  });

  await writeFile(outputPath, JSON.stringify(json, null, 2) + '\n', 'utf8');

  console.log('✅ Output guardado');
  console.log(`📁 tests/outputs/${outputFileName}`);
}

main().catch((error) => {
  console.error('❌ Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});