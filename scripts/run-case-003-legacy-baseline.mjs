#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const OUTPUTS_DIR = path.join(ROOT, 'tests', 'outputs');

const DEFAULTS = {
  model: 'gpt-4o-mini',
  temperature: 0.4,
  fixturePath: path.join(
    ROOT,
    'tests',
    'fixtures',
    'case-003-catalog-only-atencion-friccion.json'
  ),
  legacyBaselinePath: path.join(
    ROOT,
    'tests',
    'baselines',
    'book-selection-legacy-baseline.md'
  ),
  outputPrefix: 'book-selection__case-003__legacy-baseline',
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

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function interpolateLegacyTemplate(template, fixtureJson) {
  const placeholders = [
    '{{FIXTURE_JSON}}',
    '{{CASE_INPUT_JSON}}',
    '{{INPUT_JSON}}',
    '{{TEST_FIXTURE}}',
    '[[FIXTURE_JSON]]',
    '[[CASE_INPUT_JSON]]',
    '[[INPUT_JSON]]',
    '[[TEST_FIXTURE]]',
  ];

  let rendered = template;
  let didInterpolate = false;

  for (const token of placeholders) {
    if (rendered.includes(token)) {
      rendered = rendered.split(token).join(fixtureJson);
      didInterpolate = true;
    }
  }

  return { rendered, didInterpolate };
}

async function readText(filePath) {
  return readFile(filePath, 'utf8');
}

async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function getNextRunNumber(prefix) {
  await mkdir(OUTPUTS_DIR, { recursive: true });
  const files = await readdir(OUTPUTS_DIR).catch(() => []);
  const regex = new RegExp(`^${escapeRegex(prefix)}__model-[^_]+(?:-[^_]+)*__run-(\\d+)\\.json$`);

  let maxRun = 0;
  for (const file of files) {
    const match = file.match(regex);
    if (!match) continue;
    const run = Number.parseInt(match[1], 10);
    if (Number.isFinite(run) && run > maxRun) {
      maxRun = run;
    }
  }

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
  const fixturePath = path.resolve(String(args.fixture || DEFAULTS.fixturePath));
  const legacyBaselinePath = path.resolve(
    String(args.legacy || DEFAULTS.legacyBaselinePath)
  );
  const outputPrefix = String(args.outputPrefix || DEFAULTS.outputPrefix);

  const apiKey = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Falta OPENAI_KEY (o OPENAI_API_KEY) en variables de entorno.'
    );
  }

  const fixture = await readJson(fixturePath);
  const fixtureJson = JSON.stringify(fixture, null, 2);
  const legacyBaseline = await readText(legacyBaselinePath);

  const { rendered, didInterpolate } = interpolateLegacyTemplate(
    legacyBaseline,
    fixtureJson
  );

  const systemPrompt = `${rendered.trim()}

REGLA ABSOLUTA:
- Responde únicamente con JSON válido.
- No envuelvas la respuesta en markdown.
- No agregues explicación fuera del JSON.`;

  const userPrompt = didInterpolate
    ? `Ejecuta el baseline legacy ya interpolado y devuelve únicamente el JSON final.`
    : `CASO DE PRUEBA REAL (fixture JSON):
${fixtureJson}

Instrucción:
- Usa exclusivamente este fixture como entrada del case-003.
- Ejecuta el baseline legacy sin reinterpretarlo.
- Devuelve únicamente JSON válido.`;

  const runNumber = await getNextRunNumber(outputPrefix);
  const runLabel = String(runNumber).padStart(2, '0');
  const outputFileName = `${outputPrefix}__model-${model}__run-${runLabel}.json`;
  const outputPath = path.join(OUTPUTS_DIR, outputFileName);

  console.log('🧠 Baseline legacy leído');
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
  console.error('❌ Error ejecutando legacy baseline');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});