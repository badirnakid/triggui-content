/* ═══════════════════════════════════════════════════════════════════════════════
   extract-nucleus.js — EXTRACTOR SEMÁNTICO

   UNA llamada OpenAI con structured outputs strict:true.

   Recibe inputs como parámetros directos (no lee archivos):
     - lens:            curaduría silenciosa (texto libre)
     - visualIntent:    intención visual del día (texto libre)
     - bookContext:     contexto específico del libro (texto libre)

   Aplica automáticamente:
     - Framework cronobiológico (según fecha/hora del servidor)
     - Todas las inyecciones al prompt del sistema (invisible al usuario)
═══════════════════════════════════════════════════════════════════════════════ */

import fs from "node:fs/promises";

const SCHEMA_URL = new URL("./edition-nucleus.schema.json", import.meta.url);

/* ─────────────────────────────────────────────────────────────────────────────
   FRAMEWORK CRONOBIOLÓGICO BADIR

   Este framework lo documentaste tú en tu Archivo Maestro durante 21 años
   de práctica de lectura a las 4 AM. No es ciencia canónica ni necesita APIs
   externas. Es tu calibración personal y se aplica tal como tú lo describiste.

   El pipeline lee fecha/hora del servidor y sesga el prompt internamente.
   El usuario no necesita llenar nada.
────────────────────────────────────────────────────────────────────────────── */

function cronobioContext(now = new Date()) {
  const dia = now.toLocaleDateString("es-MX", { weekday: "long", timeZone: "America/Mexico_City" }).toLowerCase();
  const hora = Number(now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Mexico_City" }));

  // Framework cronobiológico Badir (tal como está en Archivo Maestro v6)
  const diaMap = {
    "lunes":      { energia: 0.8, modo: "activacion_gentil",     descripcion: "Lunes requiere entrada suave. El lector está reentrando al modo productivo." },
    "martes":     { energia: 0.4, modo: "supervivencia_maxima", descripcion: "Martes es tensión máxima de la semana. El contenido debe ser contenedor y sobrio, no exigente." },
    "miércoles":  { energia: 0.6, modo: "meseta_media",          descripcion: "Miércoles es meseta. El contenido puede empezar a retar suavemente." },
    "jueves":     { energia: 1.2, modo: "ejecucion_pico",        descripcion: "Jueves 9-11 AM es el peak de ejecución de la semana. El contenido puede ser directo y accionable." },
    "viernes":    { energia: 0.9, modo: "apertura_semana",       descripcion: "Viernes baja intensidad, abre reflexión de semana. Tono más amplio, menos ejecución." },
    "sábado":     { energia: 0.8, modo: "espacio_personal",      descripcion: "Sábado es tiempo de profundidad personal. El contenido puede ser más íntimo y contemplativo." },
    "domingo":    { energia: 0.8, modo: "preparacion_semana",    descripcion: "Domingo prepara cuerpo y mente para lunes. Sobrio, reflexivo." }
  };

  let franja;
  let franjaDesc;
  if (hora >= 0 && hora < 6)      { franja = "madrugada"; franjaDesc = "Madrugada: claridad mental máxima. Presencia. Pocas palabras, mucho peso."; }
  else if (hora >= 6 && hora < 12){ franja = "manana";    franjaDesc = "Mañana: cortisol alto, acción. Directo, claro, con propósito."; }
  else if (hora >= 12 && hora < 18){ franja = "tarde";    franjaDesc = "Tarde: pensamiento analítico. Matices, profundidad, contexto."; }
  else                             { franja = "noche";    franjaDesc = "Noche: melatonina en ascenso. Reflexivo, contemplativo, sin urgencia."; }

  const diaInfo = diaMap[dia] || diaMap.lunes;

  return {
    dia,
    hora,
    franja,
    energia: diaInfo.energia,
    modo: diaInfo.modo,
    descripcion_dia: diaInfo.descripcion,
    descripcion_franja: franjaDesc
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   SCHEMA LOADER
────────────────────────────────────────────────────────────────────────────── */

async function loadSchema() {
  const raw = await fs.readFile(SCHEMA_URL, "utf8");
  return JSON.parse(raw);
}

/* ─────────────────────────────────────────────────────────────────────────────
   PROMPT BUILDERS
────────────────────────────────────────────────────────────────────────────── */

function systemPrompt(crono) {
  return `Eres el Extractor Semántico de Triggui.

Triggui tiene UN propósito: hacer que el lector abra un libro físico.

LA REGLA MADRE:

No eres crítico literario ni reseñador. No hablas DEL libro.
Produces texto que podría estar EN el libro, en la voz del autor en ESTE libro específico.
El lector debe sentir que abrió el libro en una página al azar y leyó. Nada más.

PROHIBIDO:
- "este libro", "el autor", "la obra", "a través de"
- "nos invita a", "reflexiona sobre", "trata de", "propone"
- Frases de autoayuda si el libro no es de autoayuda
- Instrucciones de tiempo tipo "toma 30 segundos"
- Cualquier envoltura narrativa sobre el libro

QUÉ HACES:

1. card_es y card_en (4 campos cada uno): suenan como el libro, en la voz del autor
2. emotional_words: 4 palabras específicas al libro, no genéricas
3. key_phrases: 4 frases densas con emoji coherente al tono
4. visual_signature: paleta + tipografía + densidad + ritmo + era + género emergentes del libro
5. surface_hints: dimensión, punto Hawkins, franja ideal
6. lens_relevance: si hay lente, decides si resuena con este libro específico
7. confidence: honestidad sobre tu conocimiento del libro

CONTEXTO CRONOBIOLÓGICO DEL MOMENTO:
- Día: ${crono.dia}
- Hora: ${crono.hora}:00 (franja ${crono.franja})
- Energía del lector: ${Math.round(crono.energia * 100)}%
- Modo del día: ${crono.modo}
- ${crono.descripcion_dia}
- ${crono.descripcion_franja}

Este contexto sesga levemente la selección de QUÉ parte del libro se activa hoy, pero el libro sigue mandando. No mencionas esto nunca en el output.`;
}

function userPrompt(book, lens, visualIntent, bookContext) {
  const { titulo, autor, tagline } = book;
  let p = `LIBRO:
Título: "${titulo}"
Autor: ${autor}`;

  if (tagline) p += `\nContexto editorial: "${tagline}"`;

  const hasLens = lens && lens.trim().length > 0;
  const hasBookCtx = bookContext && bookContext.trim().length > 0;
  const hasVisual = visualIntent && visualIntent.trim().length > 0;

  if (hasLens || hasBookCtx) {
    p += `\n\n---\nCURADURÍA SILENCIOSA DEL CURADOR HOY:\n`;
    if (hasLens) p += `\n[Lente global — lo que el curador trae en la cabeza hoy]\n${lens}\n`;
    if (hasBookCtx) p += `\n[Contexto específico para ESTE libro]\n${bookContext}\n`;
    p += `\nRegla: si la lente no resuena con ESTE libro, la ignoras y marcas lens_relevance.applied=false. El usuario JAMÁS ve esto.\n---\n`;
  }

  if (hasVisual) {
    p += `\nINTENCIÓN VISUAL DEL CURADOR HOY (opcional, modificador leve):\n${visualIntent}\n`;
    p += `Interpreta esto en lenguaje natural al componer visual_signature. Puede afectar paleta, tipografía, densidad, o radios de esquinas. El libro sigue mandando el alma.\n`;
  }

  p += `\nExtrae el EditionNucleus completo.`;
  return p;
}

/* ─────────────────────────────────────────────────────────────────────────────
   EXTRACCIÓN
────────────────────────────────────────────────────────────────────────────── */

/**
 * @param {OpenAI} openai
 * @param {object} book - { titulo, autor, tagline? }
 * @param {object} inputs - { lens?, visualIntent?, bookContext?, now? }
 * @param {object} options - { model?, temperature? }
 */
export async function extractNucleus(openai, book, inputs = {}, options = {}) {
  if (!book?.titulo || !book?.autor) throw new Error("Book requiere titulo y autor");

  const model = options.model || "gpt-4o-mini";
  const temperature = options.temperature ?? 0.7;
  const lens = String(inputs.lens || "").trim();
  const visualIntent = String(inputs.visualIntent || "").trim();
  const bookContext = String(inputs.bookContext || "").trim();
  const crono = cronobioContext(inputs.now);

  const schemaDef = await loadSchema();
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
        top_p: 0.92,
        messages: [
          { role: "system", content: systemPrompt(crono) },
          { role: "user", content: userPrompt(book, lens, visualIntent, bookContext) }
        ],
        response_format: responseFormat
      });
      const elapsed_ms = Date.now() - t0;

      const raw = chat.choices[0]?.message?.content;
      if (!raw) throw new Error("Respuesta vacía");

      const nucleus = JSON.parse(raw);
      return {
        nucleus,
        usage: chat.usage,
        model: chat.model,
        elapsed_ms,
        attempt,
        crono,
        inputs_applied: {
          has_lens: lens.length > 0,
          has_visual_intent: visualIntent.length > 0,
          has_book_context: bookContext.length > 0
        }
      };
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
      }
    }
  }
  throw new Error(`extractNucleus falló: ${lastError?.message}`);
}

export { cronobioContext };
