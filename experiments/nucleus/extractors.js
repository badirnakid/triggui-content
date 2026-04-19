/* ═══════════════════════════════════════════════════════════════════════════════
   extractors.js — LAS 4 LLAMADAS LLM DEL PIPELINE

   extractAnchors(openai, book, groundTruth, lens)
     → book_identity, anchors, lens_analysis, visual_intent, surface_hints

   extractContentES(openai, book, groundTruth, anchors)
     → card_es, emotional_words_es, og_phrases_es, edition_blocks_es

   extractContentEN(openai, book, groundTruth, anchors, cardEs)
     → card_en, emotional_words_en, og_phrases_en, edition_blocks_en

   judgeGrounding(openai, groundTruth, generatedContent)
     → grounded_score, reason
═══════════════════════════════════════════════════════════════════════════════ */

import fs from "node:fs/promises";

const SCHEMA_URL = new URL("./edition-nucleus.schema.json", import.meta.url);

async function loadSchemas() {
  return JSON.parse(await fs.readFile(SCHEMA_URL, "utf8"));
}

// Defensa: si el modelo devuelve null, undefined, o JSON inválido, devolvemos {} en lugar de tronar
function safeParseJSON(raw) {
  if (!raw || typeof raw !== "string") return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

/* ─────────────────────────────────────────────────────────────────────────────
   CONTEXTO CRONOBIOLÓGICO (re-exportado para que build-contenido-nucleus lo use)
────────────────────────────────────────────────────────────────────────────── */

export function cronobioContext(now = new Date()) {
  const dia = now.toLocaleDateString("es-MX", { weekday: "long", timeZone: "America/Mexico_City" }).toLowerCase();
  const hora = Number(now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Mexico_City" }));

  const diaMap = {
    lunes:     { energia: 0.8, modo: "activacion_gentil",    descripcion: "Lunes requiere entrada suave. El lector está reentrando al modo productivo." },
    martes:    { energia: 0.4, modo: "supervivencia_maxima", descripcion: "Martes es tensión máxima de la semana. Contenido contenedor y sobrio, no exigente." },
    miércoles: { energia: 0.6, modo: "meseta_media",         descripcion: "Miércoles es meseta. El contenido puede empezar a retar suavemente." },
    jueves:    { energia: 1.2, modo: "ejecucion_pico",       descripcion: "Jueves 9-11 AM es el peak de ejecución. Contenido directo y accionable." },
    viernes:   { energia: 0.9, modo: "apertura_semana",      descripcion: "Viernes baja intensidad, abre reflexión de semana. Tono amplio." },
    sábado:    { energia: 0.8, modo: "espacio_personal",     descripcion: "Sábado es tiempo de profundidad personal. Más íntimo y contemplativo." },
    domingo:   { energia: 0.8, modo: "preparacion_semana",   descripcion: "Domingo prepara cuerpo y mente para lunes. Sobrio, reflexivo." }
  };

  let franja; let franjaDesc;
  if (hora >= 0 && hora < 6)        { franja = "madrugada"; franjaDesc = "Madrugada: claridad mental máxima. Presencia. Pocas palabras, mucho peso."; }
  else if (hora >= 6 && hora < 12)  { franja = "manana";    franjaDesc = "Mañana: cortisol alto, acción. Directo, claro, con propósito."; }
  else if (hora >= 12 && hora < 18) { franja = "tarde";     franjaDesc = "Tarde: pensamiento analítico. Matices, profundidad, contexto."; }
  else                              { franja = "noche";     franjaDesc = "Noche: melatonina en ascenso. Reflexivo, contemplativo, sin urgencia."; }

  const diaInfo = diaMap[dia] || diaMap.lunes;
  return { dia, hora, franja, energia: diaInfo.energia, modo: diaInfo.modo, descripcion_dia: diaInfo.descripcion, descripcion_franja: franjaDesc };
}

/* ─────────────────────────────────────────────────────────────────────────────
   LLAMADA 1 — ANCHORS + VISUAL INTENT
────────────────────────────────────────────────────────────────────────────── */

function anchorsSystemPrompt() {
  return `Eres el Extractor de Anchors de Triggui.

Triggui tiene UN propósito: hacer que el lector abra un libro físico.

Tu tarea ÚNICA en esta llamada:
1. Extraer la identidad verificable del libro (titulo_es, titulo_en original, autor completo).
2. Listar 3-5 conceptos REALES del libro (anchors) basados en el GROUND TRUTH que recibirás.
3. Listar 3-6 key_terms del vocabulario propio del autor.
4. Describir la voz autorial específica de este libro.
5. Analizar si la lente del curador aplica al libro.
6. Elegir intención visual NUMÉRICA (no colores, solo parámetros matemáticos).
7. Inferir surface_hints (dimensión, punto_hawkins, franja_ideal).

═══════════════════════════════════════════════════════════════════
IDENTIDAD DEL LIBRO
═══════════════════════════════════════════════════════════════════
- titulo_es: título en español. Si el GROUND TRUTH da el título verificado, usa ESE.
- titulo_en: título ORIGINAL en inglés si el libro se publicó en inglés originalmente. Si el GROUND TRUTH lo da, usa ESE.
- autor_completo: nombre completo como aparece publicado. Si el GROUND TRUTH da el autor verificado, usa ESE.
- idioma_original: "es" o "en" según el idioma original de publicación.

═══════════════════════════════════════════════════════════════════
ANCHORS (lo más crítico)
═══════════════════════════════════════════════════════════════════
Los anchors DEBEN basarse en el GROUND TRUTH recibido, no en tu memoria o suposición.
Si el GROUND TRUTH viene de "CURADOR" o "SINOPSIS OFICIAL": usa conceptos presentes ahí.
Si el GROUND TRUTH dice "TEMA INFERIDO": los anchors son inferencias razonables, no afirmaciones sobre lo que el libro dice.

Ejemplos de buenos anchors:
- "la regla del 1% mejor cada día" (Atomic Habits)
- "dominio ante los insultos como disciplina moral" (Meditaciones)
- "apalancamiento mediante código y medios escalables" (Naval)

Ejemplos de MALOS anchors (demasiado genéricos, podrían aplicar a cualquier libro):
- "cambio de mentalidad"
- "crecimiento personal"
- "enfoque en lo esencial"

═══════════════════════════════════════════════════════════════════
INTENCIÓN VISUAL (NUMÉRICA)
═══════════════════════════════════════════════════════════════════
NO devuelves colores hex ni nombres de colores. Devuelves:

- hue_primary: entero 0-359 (círculo cromático).
    Ejemplos por tema:
    0-20 o 340-359: rojo (pasión, urgencia, amor, guerra)
    20-45: naranja/ámbar (calidez, otoño, tradición, artesanía)
    45-65: amarillo (sol, optimismo, energía, claridad mental)
    65-140: verde (naturaleza, crecimiento, abundancia, calma)
    140-200: cian/azul verdoso (serenidad, agua, reflexión)
    200-250: azul (confianza, conocimiento, cielo, profundidad)
    250-290: violeta (misterio, espiritualidad, creatividad, nobleza)
    290-340: magenta/rosa (emoción, corazón, feminidad, romance)

- saturation: "muted" (libros contemplativos, filosofía, clásicos) | "balanced" (ensayos, narrativa) | "vivid" (manifiestos, libros de acción, autoayuda enérgica)

- lightness_paper: "dark" (libros nocturnos, misticismo, tragedia) | "medium_dark" (literario denso, poesía oscura) | "medium_light" (ensayo moderno) | "light" (libros de día, prácticos, aireados)

- temperature_shift: entero -30 a +30. Negativo = desplazar hacia frío (azul). Positivo = hacia cálido (ámbar). 0 = mantener el hue tal cual.

- palette_strategy: "monochromatic" (disciplina, minimalismo) | "analogous" (armonía, continuidad, narrativa) | "complementary" (tensión, dualidad) | "triadic" (variedad viva) | "split_complementary" (equilibrio con tensión)

- typography_family, density, rhythm, era, genre_visual: elige enums según voz y género del libro.

═══════════════════════════════════════════════════════════════════
SURFACE HINTS
═══════════════════════════════════════════════════════════════════
- dimension: Bienestar | Prosperidad | Conexion (a cuál dimensión vital apela más el libro)
- punto_hawkins: Cero | Creativo | Activo | Maximo (energía vibratoria que emite el libro)
- franja_ideal: madrugada | manana | tarde | noche (cuándo tiene más sentido leer este libro)

═══════════════════════════════════════════════════════════════════
En esta llamada NO escribes cards, og_phrases ni edition_blocks. Solo extraes anchors + visual_intent + lens_analysis + identity.`;
}

function anchorsUserPrompt(book, groundTruth, lens) {
  let p = `LIBRO:\nTítulo proporcionado: "${book.titulo}"\nAutor proporcionado: "${book.autor}"`;
  if (book.tagline) p += `\nContexto editorial: "${book.tagline}"`;
  p += `\n\n═══════════════════════════════════════════════════════════════════\nGROUND TRUTH (fuente de verdad sobre el libro):\n═══════════════════════════════════════════════════════════════════\n${groundTruth}`;
  if (lens && lens.trim()) {
    p += `\n\n═══════════════════════════════════════════════════════════════════\nLENTE DEL CURADOR:\n═══════════════════════════════════════════════════════════════════\n${lens}\n\nAnaliza honestamente en lens_analysis cómo (o si) el libro aborda este tema.`;
  }
  p += `\n\nExtrae anchors + visual_intent numérico + lens_analysis + identity. No escribas cards.`;
  return p;
}

export async function extractAnchors(openai, book, groundTruth, lens = "", options = {}) {
  const schemas = await loadSchemas();
  const model = options.model || "gpt-4o-mini";
  const temperature = options.temperature ?? 0.5;

  const response = await openai.chat.completions.create({
    model,
    temperature,
    messages: [
      { role: "system", content: anchorsSystemPrompt() },
      { role: "user", content: anchorsUserPrompt(book, groundTruth, lens) }
    ],
    response_format: {
      type: "json_schema",
      json_schema: schemas.anchors_and_intent
    }
  });

  return {
    data: safeParseJSON(response.choices?.[0]?.message?.content),
    usage: response.usage,
    model: response.model
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   LLAMADA 2 — CONTENIDO ES
────────────────────────────────────────────────────────────────────────────── */

function contentESSystemPrompt(crono) {
  return `Eres el Extractor de Contenido Editorial de Triggui (español).

Triggui tiene UN propósito: hacer que el lector abra un libro físico.

REGLA MADRE:
No eres crítico ni reseñador. No hablas DEL libro.
Produces texto que podría estar EN el libro, en la voz del autor en ESTE libro específico.
El lector debe sentir que abrió el libro en una página al azar y leyó. Nada más.

═══════════════════════════════════════════════════════════════════
INPUT QUE RECIBIRÁS
═══════════════════════════════════════════════════════════════════
- GROUND TRUTH: fuente verificada sobre el libro
- ANCHORS: conceptos, key_terms y voice_notes ya extraídos de este libro
- LENTE: perspectiva curatorial del día (si aplica)

Los ANCHORS son tu brújula obligatoria. Cada card, og_phrase y edition_block DEBE usar al menos un concepto de anchors.concepts o un key_term.
Si una frase que escribes podría aparecer en CUALQUIER libro de autoayuda genérica, la reescribes usando un anchor específico.

═══════════════════════════════════════════════════════════════════
CARD_ES
═══════════════════════════════════════════════════════════════════
- titulo: 8-60 chars. Captura un concepto específico del libro.
- parrafoTop: 80-320 chars. Voz del autor hablando sobre un concepto central del libro. Nunca "este libro", "el autor", "la obra".
- subtitulo: 20-120 chars. Una pregunta o afirmación que abre el segundo párrafo.
- parrafoBot: 80-320 chars. Segunda idea del libro en la voz del autor.

═══════════════════════════════════════════════════════════════════
EMOTIONAL_WORDS_ES
═══════════════════════════════════════════════════════════════════
Exactamente 4 palabras (3-25 chars cada una) que capturen el estado emocional que el libro evoca.
Ejemplos correctos: "serenidad", "dominio", "claridad", "desapego".
NO uses palabras genéricas: "bienestar", "éxito", "crecimiento".

═══════════════════════════════════════════════════════════════════
OG_PHRASES_ES (4 frases, 30-70 chars cada una)
═══════════════════════════════════════════════════════════════════
CRÍTICO:
- CADA FRASE en UNA SOLA LÍNEA. Nunca incluyas "\\n" ni saltos de línea.
- NUNCA escribas emojis. El sistema los inyectará después.
- Cada frase cierra con "." "?" o "!".
- Cada frase usa un concepto específico del libro desde anchors.

Ejemplos correctos (en voz del libro):
- "El alma toma el color de los juicios repetidos."
- "Pocas decisiones cargan casi todo el resultado."

═══════════════════════════════════════════════════════════════════
EDITION_BLOCKS_ES (4 bloques)
═══════════════════════════════════════════════════════════════════
Son 4 VENTANAS DISTINTAS al libro, no 4 pedazos del mismo párrafo.

Cada bloque = { gesture_type, sensory_anchor, phrase }
- gesture_type: los 4 deben ser DIFERENTES
  • instruccion_sensorial: micro-acción física/perceptual (imperativo + sensorial)
  • pregunta_directa: pregunta del libro al lector (cierra con "?")
  • imagen_concreta: imagen visual sin imperativo
  • aforismo_autorial: sentencia corta cerrada con punto
- sensory_anchor: el sentido o dimensión corporal evocado
  • vista, oido, tacto, olfato, gusto, movimiento, espacio, luz, respiracion, tiempo
- phrase: 40-100 chars, UNA SOLA LÍNEA, SIN EMOJI, cerrada con ".", "?" o "!"

═══════════════════════════════════════════════════════════════════
PROHIBICIONES DURAS
═══════════════════════════════════════════════════════════════════
- "este libro", "el autor", "la obra", "a través de"
- "nos invita a", "reflexiona sobre", "trata de", "propone", "muestra cómo"
- Metáforas intercambiables: "danza de decisiones", "laberinto de la existencia", "horizonte de posibilidades"
- Instrucciones de tiempo: "toma 30 segundos"
- Mencionar Triggui, al curador, o al proceso de curaduría
- Emojis en cualquier parte (el sistema los agrega después)
- Newlines embebidos (\\n) dentro de cualquier frase

═══════════════════════════════════════════════════════════════════
CONTEXTO CRONOBIOLÓGICO DEL MOMENTO (sesga qué parte del libro se activa hoy)
═══════════════════════════════════════════════════════════════════
- Día: ${crono.dia}, hora ${crono.hora}h franja ${crono.franja}
- Energía del lector: ${Math.round(crono.energia * 100)}%, modo: ${crono.modo}
- ${crono.descripcion_dia}
- ${crono.descripcion_franja}

El libro sigue mandando. NO lo mencionas en el output.`;
}

function contentESUserPrompt(book, groundTruth, anchorsData, lens) {
  let p = `LIBRO: "${anchorsData.book_identity.titulo_es}" — ${anchorsData.book_identity.autor_completo}`;
  p += `\n\nGROUND TRUTH:\n${groundTruth}`;
  p += `\n\nANCHORS YA EXTRAÍDOS (usar como brújula):\nConceptos:\n${anchorsData.book_grounding_anchors.concepts.map((c) => `- ${c}`).join("\n")}\n\nKey terms: ${anchorsData.book_grounding_anchors.key_terms.join(", ")}\n\nVoz autorial: ${anchorsData.book_grounding_anchors.authorial_voice_notes}`;
  if (lens && lens.trim()) p += `\n\nLENTE DEL CURADOR:\n${lens}`;
  p += `\n\nEscribe card_es + emotional_words_es + og_phrases_es + edition_blocks_es. SIN EMOJIS. SIN NEWLINES. Cada frase usa al menos un anchor.`;
  return p;
}

export async function extractContentES(openai, book, groundTruth, anchorsData, lens = "", options = {}) {
  const schemas = await loadSchemas();
  const crono = options.crono || cronobioContext();
  const model = options.model || "gpt-4o-mini";
  const temperature = options.temperature ?? 0.7;

  const response = await openai.chat.completions.create({
    model,
    temperature,
    messages: [
      { role: "system", content: contentESSystemPrompt(crono) },
      { role: "user", content: contentESUserPrompt(book, groundTruth, anchorsData, lens) }
    ],
    response_format: {
      type: "json_schema",
      json_schema: schemas.content_es
    }
  });

  return {
    data: safeParseJSON(response.choices?.[0]?.message?.content),
    usage: response.usage,
    model: response.model
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   LLAMADA 3 — CONTENIDO EN
   Re-extracción, no traducción. Recibe anchors + card_es como referencia.
────────────────────────────────────────────────────────────────────────────── */

function contentENSystemPrompt() {
  return `You are Triggui's English Content Extractor.

Triggui's single purpose: make the reader open a physical book.

MOTHER RULE:
You are not a critic or reviewer. You do not talk ABOUT the book.
You produce text that could appear IN the book, in the author's voice in THIS specific book.
The reader must feel they opened the book at a random page. That's it.

═══════════════════════════════════════════════════════════════════
INPUT
═══════════════════════════════════════════════════════════════════
- GROUND TRUTH about the book
- ANCHORS (concepts, key_terms, voice_notes)
- card_es (Spanish card already written) — use as SEMANTIC reference, NOT as text to translate

This is a RE-EXTRACTION into English, NOT a translation.
Write as the author WOULD HAVE written directly in English, using the same anchors.
Do not translate "danza" as "dance" if the author would say "movement" in English.
Preserve meaning, rewrite voice.

═══════════════════════════════════════════════════════════════════
OUTPUT LANGUAGE — CRITICAL
═══════════════════════════════════════════════════════════════════
EVERY field in this output MUST be in pure English.
NO Spanish words. NO "Elige", "Vivir", "Día", "Qué". If you find yourself writing Spanish, STOP and rewrite.

═══════════════════════════════════════════════════════════════════
STRUCTURE
═══════════════════════════════════════════════════════════════════
card_en: titulo (8-60 chars), parrafoTop (80-320), subtitulo (20-120), parrafoBot (80-320)
emotional_words_en: exactly 4 words, 3-25 chars each
og_phrases_en: exactly 4 phrases, 30-70 chars each, ONE LINE, NO emojis, NO "\\n"
edition_blocks_en: exactly 4 blocks with different gesture_types, each 40-100 chars, ONE LINE, NO emojis

gesture_type enum: sensory_instruction | direct_question | concrete_image | authorial_aphorism
sensory_anchor enum: sight | hearing | touch | smell | taste | movement | space | light | breath | time

═══════════════════════════════════════════════════════════════════
FORBIDDEN
═══════════════════════════════════════════════════════════════════
- "this book", "the author", "the work"
- "invites us to", "reflects on", "is about", "proposes"
- Hollow metaphors: "dance of decisions", "labyrinth of existence", "horizon of possibilities"
- Spanish words anywhere in the output
- Emojis (system injects them later)
- Embedded newlines`;
}

function contentENUserPrompt(book, groundTruth, anchorsData, cardES, lens) {
  let p = `BOOK: "${anchorsData.book_identity.titulo_en}" — ${anchorsData.book_identity.autor_completo}`;
  p += `\n\nGROUND TRUTH:\n${groundTruth}`;
  p += `\n\nANCHORS (your compass):\nConcepts:\n${anchorsData.book_grounding_anchors.concepts.map((c) => `- ${c}`).join("\n")}\n\nKey terms: ${anchorsData.book_grounding_anchors.key_terms.join(", ")}\n\nAuthorial voice: ${anchorsData.book_grounding_anchors.authorial_voice_notes}`;
  p += `\n\ncard_es (SEMANTIC REFERENCE, do not translate literally):\nTítulo: ${cardES.titulo}\nParrafoTop: ${cardES.parrafoTop}\nSubtítulo: ${cardES.subtitulo}\nParrafoBot: ${cardES.parrafoBot}`;
  if (lens && lens.trim()) p += `\n\nCURATORIAL LENS:\n${lens}`;
  p += `\n\nWrite card_en + emotional_words_en + og_phrases_en + edition_blocks_en. 100% English. No emojis. No newlines. No Spanish.`;
  return p;
}

export async function extractContentEN(openai, book, groundTruth, anchorsData, cardES, lens = "", options = {}) {
  const schemas = await loadSchemas();
  const model = options.model || "gpt-4o-mini";
  const temperature = options.temperature ?? 0.7;

  const response = await openai.chat.completions.create({
    model,
    temperature,
    messages: [
      { role: "system", content: contentENSystemPrompt() },
      { role: "user", content: contentENUserPrompt(book, groundTruth, anchorsData, cardES, lens) }
    ],
    response_format: {
      type: "json_schema",
      json_schema: schemas.content_en
    }
  });

  return {
    data: safeParseJSON(response.choices?.[0]?.message?.content),
    usage: response.usage,
    model: response.model
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   LLAMADA 4 — GROUNDING JUDGE
   Un modelo pequeño juzga si el contenido generado realmente usa el ground_truth.
────────────────────────────────────────────────────────────────────────────── */

function groundingJudgePrompt(groundTruth, contentSnippets) {
  return `You are a grounding auditor. You judge whether generated editorial content is truly anchored to a specific book's ground truth, or whether it's generic filler that could apply to any book.

GROUND TRUTH ABOUT THE BOOK:
${groundTruth}

GENERATED CONTENT (excerpts):
${contentSnippets}

Judge:
1. grounded_score (0-1): how specifically does the content reflect ground_truth? 1.0 = uses specific concepts/terms from ground_truth; 0.3 = vaguely related; 0.0 = generic.
2. uses_book_specific_concepts: true if at least 2 phrases use concepts named in the ground truth.
3. could_apply_to_any_book: true if the content is so generic it would work for any self-help/philosophy/business book with minimal edits.
4. reason: specific observation explaining the score.

Be honest. False positives (saying it's grounded when it isn't) break the system.`;
}

export async function judgeGrounding(openai, groundTruth, content, options = {}) {
  const schemas = await loadSchemas();
  const model = options.model || "gpt-4o-mini";

  // Construir snippet representativo del contenido generado
  const snippets = [
    `Card titulo: "${content.card_es?.titulo || ""}"`,
    `Card parrafoTop: "${content.card_es?.parrafoTop || ""}"`,
    `Card parrafoBot: "${content.card_es?.parrafoBot || ""}"`,
    `OG phrases: ${(content.og_phrases_es || []).map((p) => `"${p}"`).join(" / ")}`,
    `Edition blocks: ${(content.edition_blocks_es || []).map((b) => `"${b.phrase}"`).join(" / ")}`
  ].join("\n");

  const response = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [{ role: "user", content: groundingJudgePrompt(groundTruth, snippets) }],
    response_format: {
      type: "json_schema",
      json_schema: schemas.grounding_judge
    }
  });

  return {
    data: safeParseJSON(response.choices?.[0]?.message?.content),
    usage: response.usage,
    model: response.model
  };
}
