#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const OUTPUTS_DIR = path.join(ROOT, 'tests', 'outputs');

const DEFAULTS = {
  model: 'gpt-4o-mini',
  temperature: 0.1,
  fixturePath: path.join(
    ROOT,
    'tests',
    'fixtures',
    'case-003-catalog-only-atencion-friccion.json'
  ),
  rubricPath: path.join(
    ROOT,
    'tests',
    'rubrics',
    'book-selection-rubric.md'
  ),
  protocolPath: path.join(
    ROOT,
    'tests',
    'rubrics',
    'output-comparison-protocol.md'
  ),
  newPrefix: 'book-selection__case-003__new-system',
  legacyPrefix: 'book-selection__case-003__legacy-baseline',
  outputPrefix: 'book-selection__case-003__judge-eval__new-vs-legacy',
  maxAttempts: 2,
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

async function readText(filePath) {
  return readFile(filePath, 'utf8');
}

async function readJson(filePath) {
  return JSON.parse(await readText(filePath));
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
    if (!best || run > best.run) best = { file, run };
  }

  if (!best) {
    throw new Error(`No encontré outputs para el prefijo: ${prefix}`);
  }

  return path.join(OUTPUTS_DIR, best.file);
}

async function getNextRunNumber(prefix, extension = '.json') {
  await mkdir(OUTPUTS_DIR, { recursive: true });
  const files = await readdir(OUTPUTS_DIR).catch(() => []);
  const regex = new RegExp(
    `^${escapeRegex(prefix)}__model-[^_]+(?:-[^_]+)*__run-(\\d+)${escapeRegex(extension)}$`
  );

  let maxRun = 0;
  for (const file of files) {
    const match = file.match(regex);
    if (!match) continue;
    const run = Number.parseInt(match[1], 10);
    if (Number.isFinite(run) && run > maxRun) maxRun = run;
  }

  return maxRun + 1;
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function hasSubstance(run) {
  const title = run?.selected_book?.title;
  const why = run?.selected_book?.why_this_book;
  const triggerFit = run?.selected_book?.fit?.trigger_fit;
  const lensFit = run?.selected_book?.fit?.lens_fit;
  const timingFit = run?.selected_book?.fit?.timing_fit;

  return [title, why, triggerFit, lensFit, timingFit]
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .length >= 4;
}

function normalizeJudgeTotals(judgeResult) {
  const criteria = Array.isArray(judgeResult?.criteria) ? judgeResult.criteria : [];

  const newTotal = criteria.reduce(
    (sum, item) => sum + (Number.isFinite(item?.new_score) ? item.new_score : 0),
    0
  );

  const legacyTotal = criteria.reduce(
    (sum, item) => sum + (Number.isFinite(item?.legacy_score) ? item.legacy_score : 0),
    0
  );

  if (!judgeResult.overall_assessment || typeof judgeResult.overall_assessment !== 'object') {
    judgeResult.overall_assessment = {};
  }

  judgeResult.overall_assessment.new_total = newTotal;
  judgeResult.overall_assessment.legacy_total = legacyTotal;
  judgeResult.overall_assessment.does_new_beat_legacy = newTotal > legacyTotal;

  return judgeResult;
}

async function callOpenAI({ apiKey, model, temperature, messages }) {
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
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('La respuesta del juez llegó vacía.');
  }

  return JSON.parse(stripCodeFences(content));
}

function validateJudgeResult(judgeResult, newRun, legacyRun) {
  const criteria = Array.isArray(judgeResult.criteria) ? judgeResult.criteria : [];
  if (criteria.length !== 5) {
    throw new Error('Judge inválido: criteria debe tener exactamente 5 elementos.');
  }

  const legacyMaterial = hasSubstance(legacyRun);
  const newMaterial = hasSubstance(newRun);

  let newSum = 0;
  let legacySum = 0;
  let anyCriterionBelow7ForNew = false;

  for (const item of criteria) {
    if (typeof item.criterion !== 'string' || !item.criterion.trim()) {
      throw new Error('Judge inválido: criterion vacío.');
    }

    if (!Number.isFinite(item.new_score) || item.new_score < 0 || item.new_score > 10) {
      throw new Error(`Judge inválido: new_score fuera de rango en "${item.criterion}".`);
    }

    if (!Number.isFinite(item.legacy_score) || item.legacy_score < 0 || item.legacy_score > 10) {
      throw new Error(`Judge inválido: legacy_score fuera de rango en "${item.criterion}".`);
    }

    if (!['new_system', 'legacy_baseline', 'tie'].includes(item.winner)) {
      throw new Error(`Judge inválido: winner inválido en "${item.criterion}".`);
    }

    if (typeof item.rationale !== 'string' || item.rationale.trim().length < 20) {
      throw new Error(`Judge inválido: rationale demasiado débil en "${item.criterion}".`);
    }

    const evidence = Array.isArray(item.evidence) ? item.evidence : [];
    if (evidence.length < 2) {
      throw new Error(`Judge inválido: evidencia insuficiente en "${item.criterion}".`);
    }

    const hasNewEvidence = evidence.some(
      (entry) => typeof entry === 'string' && entry.startsWith('New: ')
    );
    const hasLegacyEvidence = evidence.some(
      (entry) => typeof entry === 'string' && entry.startsWith('Legacy: ')
    );

    if (!hasNewEvidence || !hasLegacyEvidence) {
      throw new Error(
        `Judge inválido: en "${item.criterion}" debe citar evidencia explícita de New y Legacy.`
      );
    }

    newSum += item.new_score;
    legacySum += item.legacy_score;

    if (item.new_score < 7) {
      anyCriterionBelow7ForNew = true;
    }
  }

  if (newMaterial && newSum === 0) {
    throw new Error('Judge inválido: new_system quedó en 0/50 pese a tener output con sustancia.');
  }

  if (legacyMaterial && legacySum === 0) {
    throw new Error(
      'Judge inválido: legacy_baseline quedó en 0/50 pese a tener output con sustancia.'
    );
  }

  const gaps = Array.isArray(judgeResult.overall_assessment?.primary_gaps_in_new)
    ? judgeResult.overall_assessment.primary_gaps_in_new
    : [];

  if (anyCriterionBelow7ForNew && gaps.length === 0) {
    throw new Error(
      'Judge inválido: new_system tiene criterios <7 pero no reporta primary_gaps_in_new.'
    );
  }

  const strongest = Array.isArray(judgeResult.overall_assessment?.strongest_advantages_of_new)
    ? judgeResult.overall_assessment.strongest_advantages_of_new
    : [];

  if (judgeResult.winner === 'new_system' && strongest.length === 0) {
    throw new Error('Judge inválido: declara ganador al new_system pero no explica ventajas reales.');
  }

  const rpc = judgeResult.recommended_prompt_change || {};

  if (typeof rpc.should_edit !== 'boolean') {
    throw new Error('Judge inválido: recommended_prompt_change.should_edit debe ser boolean.');
  }

  if (rpc.should_edit) {
    if (rpc.target_file !== 'prompts/tasks/select-book.md') {
      throw new Error('Judge inválido: target_file debe ser prompts/tasks/select-book.md.');
    }

    if (
      ![
        'tighten_specificity',
        'strengthen_lens_imprint',
        'tighten_timing_fit',
        'tighten_justification',
        'tighten_alternatives_rejections',
      ].includes(rpc.change_type)
    ) {
      throw new Error('Judge inválido: change_type no permitido.');
    }

    if (typeof rpc.exact_problem !== 'string' || rpc.exact_problem.trim().length < 20) {
      throw new Error('Judge inválido: exact_problem demasiado débil.');
    }

    if (typeof rpc.why_this_change !== 'string' || rpc.why_this_change.trim().length < 20) {
      throw new Error('Judge inválido: why_this_change demasiado débil.');
    }

    if (typeof rpc.instruction_block !== 'string' || rpc.instruction_block.trim().length < 40) {
      throw new Error('Judge inválido: instruction_block demasiado genérico o corto.');
    }

    const guardrails = Array.isArray(rpc.guardrails) ? rpc.guardrails : [];
    if (guardrails.length < 2) {
      throw new Error('Judge inválido: guardrails insuficientes.');
    }
  }

  if (
    typeof judgeResult.final_decision !== 'string' ||
    judgeResult.final_decision.trim().length < 20
  ) {
    throw new Error('Judge inválido: final_decision demasiado débil.');
  }
}

function buildSystemPrompt() {
  return `Eres un juez técnico-editorial despiadadamente estricto.

Tu misión NO es quedar bien.
Tu misión es detectar si el output new-system realmente supera al legacy-baseline para case-003.

REGLAS ABSOLUTAS:
- Evalúa con dureza.
- Penaliza clichés, genericidad, timing vacío, lente decorativo y justificaciones intercambiables.
- NO pongas 0/10 a un output que sí tiene contenido material salvo que expliques una falla catastrófica explícita.
- SIEMPRE cita evidencia textual de ambos lados: new y legacy.
- Si new gana por poco pero sigue débil, dilo.
- Si new saca menos de 7/10 en algún criterio, debes reportar al menos un gap real.
- Propón solo UN cambio de prompt. Debe ser específico, insertable, operativo y no tautológico.
- Devuelve únicamente JSON válido.`;
}

function buildBaseUserPrompt({ rubric, protocol, fixture, newRun, legacyRun }) {
  return `
Evalúa estos dos outputs usando la rúbrica y el protocolo adjuntos.

## RUBRIC
${rubric}

## COMPARISON PROTOCOL
${protocol}

## FIXTURE
${JSON.stringify(fixture, null, 2)}

## NEW SYSTEM OUTPUT
${JSON.stringify(newRun, null, 2)}

## LEGACY BASELINE OUTPUT
${JSON.stringify(legacyRun, null, 2)}

Devuelve exactamente este shape JSON:

{
  "winner": "new_system" | "legacy_baseline" | "tie",
  "criteria": [
    {
      "criterion": "Specificity of why_it_matters_now",
      "new_score": 0,
      "legacy_score": 0,
      "winner": "new_system" | "legacy_baseline" | "tie",
      "rationale": "string",
      "evidence": ["New: ...", "Legacy: ..."]
    },
    {
      "criterion": "Real lens imprint",
      "new_score": 0,
      "legacy_score": 0,
      "winner": "new_system" | "legacy_baseline" | "tie",
      "rationale": "string",
      "evidence": ["New: ...", "Legacy: ..."]
    },
    {
      "criterion": "Timing fit quality",
      "new_score": 0,
      "legacy_score": 0,
      "winner": "new_system" | "legacy_baseline" | "tie",
      "rationale": "string",
      "evidence": ["New: ...", "Legacy: ..."]
    },
    {
      "criterion": "Non-interchangeable book justification",
      "new_score": 0,
      "legacy_score": 0,
      "winner": "new_system" | "legacy_baseline" | "tie",
      "rationale": "string",
      "evidence": ["New: ...", "Legacy: ..."]
    },
    {
      "criterion": "Alternatives and rejections quality",
      "new_score": 0,
      "legacy_score": 0,
      "winner": "new_system" | "legacy_baseline" | "tie",
      "rationale": "string",
      "evidence": ["New: ...", "Legacy: ..."]
    }
  ],
  "overall_assessment": {
    "new_total": 0,
    "legacy_total": 0,
    "does_new_beat_legacy": true,
    "strongest_advantages_of_new": ["string"],
    "primary_gaps_in_new": ["string"]
  },
  "recommended_prompt_change": {
    "should_edit": true,
    "target_file": "prompts/tasks/select-book.md",
    "change_type": "tighten_specificity" | "strengthen_lens_imprint" | "tighten_timing_fit" | "tighten_justification" | "tighten_alternatives_rejections",
    "exact_problem": "string",
    "why_this_change": "string",
    "instruction_block": "string",
    "guardrails": ["string", "string"]
  },
  "final_decision": "string"
}

Reglas adicionales:
- new_total y legacy_total deben ser la suma exacta de los 5 criterios.
- Si cualquier criterio de new queda debajo de 7/10, primary_gaps_in_new NO puede ir vacío.
- instruction_block debe ser una instrucción insertable dentro del prompt, no una frase obvia o tautológica.
- Si legacy tiene contenido material, no lo trates como 0 absoluto sin evidencia textual demoledora.
`;
}

async function saveRejectedAttempt({
  outputPrefix,
  model,
  runLabel,
  attemptNumber,
  judgeResult,
  validationError,
}) {
  const rejectedPath = path.join(
    OUTPUTS_DIR,
    `${outputPrefix}__model-${model}__run-${runLabel}__rejected-attempt-${String(attemptNumber).padStart(2, '0')}.json`
  );

  await writeFile(
    rejectedPath,
    JSON.stringify(
      {
        attempt: attemptNumber,
        validation_error: validationError,
        judge_result: judgeResult,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  console.log(`🧨 Judge rechazado guardado: ${rel(rejectedPath)}`);
}

async function runJudgeWithValidation({
  apiKey,
  model,
  temperature,
  maxAttempts,
  outputPrefix,
  runLabel,
  systemPrompt,
  baseUserPrompt,
  newRun,
  legacyRun,
}) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content:
          attempt === 1
            ? baseUserPrompt
            : `${baseUserPrompt}

CORRECCIÓN OBLIGATORIA:
Tu intento anterior fue inválido por este motivo exacto:
${lastError}

Rehaz TODO el JSON completo corrigiendo ese defecto.
No expliques nada fuera del JSON.
No recicles una respuesta inválida.`,
      },
    ];

    console.log(`🚀 Intento del juez ${attempt}/${maxAttempts}...`);

    const judgeResult = await callOpenAI({
      apiKey,
      model,
      temperature,
      messages,
    });

    try {
      normalizeJudgeTotals(judgeResult);
      validateJudgeResult(judgeResult, newRun, legacyRun);
      return judgeResult;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);

      await saveRejectedAttempt({
        outputPrefix,
        model,
        runLabel,
        attemptNumber: attempt,
        judgeResult,
        validationError: lastError,
      });

      if (attempt === maxAttempts) {
        throw new Error(lastError);
      }

      console.log(`⚠️ Judge inválido en intento ${attempt}: ${lastError}`);
      console.log('🔁 Reintentando con feedback de validación...');
    }
  }

  throw new Error('No se pudo obtener un judge válido.');
}

function renderMarkdownReport({
  judgeResult,
  fixturePath,
  rubricPath,
  protocolPath,
  newPath,
  legacyPath,
}) {
  const criteria = Array.isArray(judgeResult.criteria) ? judgeResult.criteria : [];
  const strengths = Array.isArray(judgeResult.overall_assessment?.strongest_advantages_of_new)
    ? judgeResult.overall_assessment.strongest_advantages_of_new
    : [];
  const gaps = Array.isArray(judgeResult.overall_assessment?.primary_gaps_in_new)
    ? judgeResult.overall_assessment.primary_gaps_in_new
    : [];
  const guardrails = Array.isArray(judgeResult.recommended_prompt_change?.guardrails)
    ? judgeResult.recommended_prompt_change.guardrails
    : [];

  const criteriaMd = criteria
    .map((item, index) => {
      const evidence =
        Array.isArray(item.evidence) && item.evidence.length
          ? item.evidence.map((entry) => `  - ${entry}`).join('\n')
          : '  - —';

      return `### ${index + 1}) ${item.criterion}

- Winner: ${item.winner}
- New score: ${item.new_score}/10
- Legacy score: ${item.legacy_score}/10
- Rationale: ${item.rationale}

Evidence:
${evidence}
`;
    })
    .join('\n');

  const strengthsMd = strengths.length ? strengths.map((item) => `- ${item}`).join('\n') : '- —';
  const gapsMd = gaps.length ? gaps.map((item) => `- ${item}`).join('\n') : '- —';
  const guardrailsMd = guardrails.length
    ? guardrails.map((item) => `- ${item}`).join('\n')
    : '- —';

  return `# Judge evaluation — case-003 — new-system vs legacy-baseline

## Archivos evaluados
- Fixture: \`${rel(fixturePath)}\`
- Rubric: \`${rel(rubricPath)}\`
- Protocol: \`${rel(protocolPath)}\`
- New system: \`${rel(newPath)}\`
- Legacy baseline: \`${rel(legacyPath)}\`

## Veredicto global
- Winner: ${judgeResult.winner}
- New total: ${judgeResult.overall_assessment?.new_total ?? '—'}/50
- Legacy total: ${judgeResult.overall_assessment?.legacy_total ?? '—'}/50
- Does new beat legacy?: ${
    judgeResult.overall_assessment?.does_new_beat_legacy ? 'Sí' : 'No'
  }

## Fortalezas reales del new-system
${strengthsMd}

## Gaps reales del new-system
${gapsMd}

## Evaluación por criterio
${criteriaMd}

## Cambio recomendado al prompt
- Should edit now?: ${judgeResult.recommended_prompt_change?.should_edit ? 'Sí' : 'No'}
- Target file: ${judgeResult.recommended_prompt_change?.target_file ?? '—'}
- Change type: ${judgeResult.recommended_prompt_change?.change_type ?? '—'}
- Exact problem: ${judgeResult.recommended_prompt_change?.exact_problem ?? '—'}
- Why this change: ${judgeResult.recommended_prompt_change?.why_this_change ?? '—'}

### Instruction block proposed
\`\`\`md
${judgeResult.recommended_prompt_change?.instruction_block ?? '—'}
\`\`\`

## Guardrails
${guardrailsMd}

## Decision
${judgeResult.final_decision ?? '—'}
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const model = String(args.model || DEFAULTS.model);
  const temperature = Number.parseFloat(String(args.temperature || DEFAULTS.temperature));
  const maxAttempts = Number.parseInt(String(args.maxAttempts || DEFAULTS.maxAttempts), 10);

  const fixturePath = path.resolve(String(args.fixture || DEFAULTS.fixturePath));
  const rubricPath = path.resolve(String(args.rubric || DEFAULTS.rubricPath));
  const protocolPath = path.resolve(String(args.protocol || DEFAULTS.protocolPath));

  const newPath = args.new
    ? path.resolve(String(args.new))
    : await findLatestOutput(String(args.newPrefix || DEFAULTS.newPrefix));

  const legacyPath = args.legacy
    ? path.resolve(String(args.legacy))
    : await findLatestOutput(String(args.legacyPrefix || DEFAULTS.legacyPrefix));

  const apiKey = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Falta OPENAI_KEY o OPENAI_API_KEY.');
  }

  const fixture = await readJson(fixturePath);
  const rubric = await readText(rubricPath);
  const protocol = await readText(protocolPath);
  const newRun = await readJson(newPath);
  const legacyRun = await readJson(legacyPath);

  const systemPrompt = buildSystemPrompt();
  const baseUserPrompt = buildBaseUserPrompt({
    rubric,
    protocol,
    fixture,
    newRun,
    legacyRun,
  });

  const runNumber = await getNextRunNumber(DEFAULTS.outputPrefix);
  const runLabel = String(runNumber).padStart(2, '0');

  console.log('🧪 Evaluando new-system vs legacy-baseline con juez estricto...');

  const judgeResult = await runJudgeWithValidation({
    apiKey,
    model,
    temperature,
    maxAttempts,
    outputPrefix: DEFAULTS.outputPrefix,
    runLabel,
    systemPrompt,
    baseUserPrompt,
    newRun,
    legacyRun,
  });

  normalizeJudgeTotals(judgeResult);
  validateJudgeResult(judgeResult, newRun, legacyRun);

  const jsonPath = path.join(
    OUTPUTS_DIR,
    `${DEFAULTS.outputPrefix}__model-${model}__run-${runLabel}.json`
  );
  const mdPath = path.join(
    OUTPUTS_DIR,
    `${DEFAULTS.outputPrefix}__model-${model}__run-${runLabel}.md`
  );

  const markdown = renderMarkdownReport({
    judgeResult,
    fixturePath,
    rubricPath,
    protocolPath,
    newPath,
    legacyPath,
  });

  await writeFile(jsonPath, JSON.stringify(judgeResult, null, 2) + '\n', 'utf8');
  await writeFile(mdPath, markdown, 'utf8');

  console.log('✅ Judge eval válido guardado');
  console.log(`📁 ${rel(jsonPath)}`);
  console.log(`📁 ${rel(mdPath)}`);
}

main().catch((error) => {
  console.error('❌ Error ejecutando judge eval');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});