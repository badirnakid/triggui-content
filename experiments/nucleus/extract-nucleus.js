/* ═══════════════════════════════════════════════════════════════════════════════
   extract-nucleus.js — EXTRACTOR SEMÁNTICO ÚNICO

   UNA sola llamada a OpenAI con structured outputs estricto.
   El modelo NO puede devolver nada que viole el schema (constrained decoding).

   No hay parsing defensivo.
   No hay cleanJSON.
   No hay reparación.
   No hay coerceTarjeta.
   No hay retries estructurales.

   Retries solo por red.
═══════════════════════════════════════════════════════════════════════════════ */

import fs from "node:fs/promises";
import OpenAI from "openai";

const SCHEMA_URL = new URL("./edition-nucleus.schema.json", import.meta.url);

const SYSTEM_PROMPT = `Eres el Extractor Semántico de Triggui.

Tu único trabajo es extraer el núcleo semántico de un libro que conoces y llenar la estructura EditionNucleus.

REGLAS INQUEBRANTABLES:

1. LÍNEA SAGRADA: si cualquier campo pudiera aplicarse a otro libro, fallaste. Todo debe ser específico a ESTE libro. Si tu conocimiento del libro es pobre, BAJA la ambición y pon confidence.book_grounding bajo. No inventes citas ni escenas.

2. NO GENERAS ARTEFACTOS FINALES: NO escribes tarjetas, NO aplicas formato [H][/H], NO compones párrafos completos. Solo llenas la materia prima del schema.

3. BILINGÜISMO NATIVO: los campos EN no son traducciones del ES. Son el MISMO insight expresado naturalmente en inglés. Si el libro es originalmente en inglés, los títulos canónicos ya existen; úsalos si los conoces.

4. VERBOS FÍSICOS: la micro_action debe usar un verbo físico concreto (escribir, marcar, respirar, observar, nombrar, tocar, caminar). PROHIBIDO: reflexiona, piensa, considera, medita, imagina.

5. SEEDS ATÓMICAS: highlight_seeds son frases CORTAS de 6-14 palabras. No son párrafos. No contienen [H].

6. HONESTIDAD EPISTEMOLÓGICA: Llena confidence con valores reales. Si inventas, el sistema lo detecta.

7. PROHIBIDO: primera persona (yo/mi/I/my), frases genéricas de autoayuda (encuentra tu fuerza, dream big, transforma tu vida), meta-referencias (según el libro, el autor propone).`;

function buildUserPrompt(book) {
  const { titulo, autor, tagline } = book;
  return `LIBRO:
Título: "${titulo}"
Autor: ${autor}
${tagline ? `Contexto editorial: "${tagline}"` : ""}

Extrae el EditionNucleus llenando el schema requerido.`;
}

/**
 * Extrae el Nucleus de un libro con UNA sola llamada.
 * @param {OpenAI} openai - Cliente OpenAI inicializado
 * @param {object} book - { titulo, autor, tagline? }
 * @param {object} options - { model?, temperature? }
 * @returns {Promise<{nucleus, usage, model, elapsed_ms}>}
 */
export async function extractNucleus(openai, book, options = {}) {
  if (!book?.titulo || !book?.autor) {
    throw new Error("Book requiere titulo y autor");
  }

  const model = options.model || "gpt-4o-mini";
  const temperature = options.temperature ?? 0.7;

  const rawSchema = await fs.readFile(SCHEMA_URL, "utf8");
  const schemaDef = JSON.parse(rawSchema);

  const responseFormat = {
    type: "json_schema",
    json_schema: {
      name: schemaDef.name,
      description: schemaDef.description,
      strict: true,
      schema: schemaDef.schema
    }
  };

  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const t0 = Date.now();
      const chat = await openai.chat.completions.create({
        model,
        temperature,
        top_p: 0.9,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(book) }
        ],
        response_format: responseFormat
      });
      const elapsed_ms = Date.now() - t0;

      const raw = chat.choices[0]?.message?.content;
      if (!raw) throw new Error("Respuesta vacía de OpenAI");

      // Guaranteed valid JSON matching schema (strict: true)
      const nucleus = JSON.parse(raw);

      return {
        nucleus,
        usage: chat.usage,
        model: chat.model,
        elapsed_ms,
        attempt
      };
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const backoff = 2 ** attempt * 1000;
        console.error(`   ⚠️  Intento ${attempt} falló: ${error.message}. Retry en ${backoff}ms`);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }

  throw new Error(`extractNucleus falló tras ${maxRetries} intentos: ${lastError?.message}`);
}
