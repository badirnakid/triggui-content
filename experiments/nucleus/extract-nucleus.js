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

═════════════════════════════════════════════════════════════════════
PROCESO OBLIGATORIO DE EXTRACCIÓN — debes seguirlo en este orden:
═════════════════════════════════════════════════════════════════════

PASO 1 — ANCLAJE (book_grounding_anchors):

Antes de producir cualquier frase, debes anclarte en el libro real.

Pregúntate honestamente: ¿conozco ESTE libro específico o solo el título?
- Si lo conoces: llena book_known=true. Lista 3-5 conceptos REALES del libro. Lista 3-6 términos del vocabulario propio del autor. Describe su voz en 2-3 oraciones.
- Si solo lo conoces superficialmente: book_known=false, baja confidence.book_grounding. Usa los conceptos más probables dados título/autor, pero sé honesto.

Los anchors que produzcas son tu brújula para los siguientes pasos. NO avances sin ellos sólidos.

PASO 2 — ANÁLISIS DE LENTE (lens_analysis):

Si el curador pasó una lente (lens o book_context), debes analizar GENUINAMENTE cómo se relaciona con el libro ANTES de decidir si aplica.

- Si el libro trata directamente el tema: decision=apply_directly. La extracción se sesga ahí.
- Si el libro no trata el tema pero hay un concepto adyacente que conecta: decision=apply_through_adjacent_concept. Usas ese puente. Ejemplo: lente es "función de recompensa" y el libro es "Meditaciones de Marco Aurelio" — no hay economía formal, pero hay una idea adyacente sobre aceptación y recompensa interna. Usas ese puente.
- Solo si el libro genuinamente no tiene conexión real con la lente: decision=dont_apply_book_is_about_something_else. Y explicas con precisión en qué sí trata el libro.

NUNCA marques dont_apply_book_is_about_something_else sin haber buscado primero. Ser perezoso aquí es traicionar al curador.

PASO 3 — PRODUCCIÓN GUIADA POR ANCHORS:

Ahora produces card_es, card_en, emotional_words, og_phrases, edition_blocks, visual_signature, surface_hints.

Regla crítica: cada frase que produzcas DEBE contener al menos un concepto de book_grounding_anchors.concepts o un término de key_terms. Si una frase pudiera aparecer EN CUALQUIER libro de autoayuda, la estás haciendo mal.

EDITION_BLOCKS — REGLA ESPECIAL DE ESTRUCTURA:

Los 4 bloques de la Edición Viva NO son 4 frases reflexivas sobre el libro. NO son 4 pedazos de un párrafo largo. Son 4 VENTANAS DISTINTAS al libro — 4 gestos de tipos diferentes que el lector puede tocar por separado.

Cada bloque es un objeto con DOS campos: gesture_type y phrase. Proceso obligatorio para cada bloque:

1. PRIMERO decides gesture_type — es el tipo de gesto que ese bloque va a ser.
2. DESPUÉS escribes phrase en la forma propia de ese tipo.

Los 4 tipos disponibles:
  • instruccion_sensorial: verbo imperativo + objeto sensorial. Ej: "🦋 Observa el cielo durante unos instantes, sintiendo la vastedad a tu alrededor."
  • pregunta_directa: pregunta del libro al lector, cierra con "?". Ej: "♟ ¿Qué jugada eliges cuando nadie está mirando el tablero?"
  • imagen_concreta: imagen visual sin verbo imperativo. Ej: "⚖ El tablero donde cada jugada se mide contra las jugadas de los demás."
  • aforismo_autorial: sentencia corta cerrada con punto. Ej: "🎯 La recompensa no es el premio; es seguir jugando con intención."

Los 4 gesture_type deben ser DISTINTOS entre sí (uno de cada tipo es ideal; máximo puedes repetir UN tipo si el libro no da para los 4).

REGLAS DE FORMA DE phrase:
- Emoji al INICIO (coherente con el tono del libro y el tipo de gesto)
- 50-110 caracteres con emoji incluido
- DEBE cerrar con ".", "?" o "!" — NUNCA con "y", "de", "se", coma o palabra conectora
- Si la idea completa no cabe en 110 chars, reformula más corta. NO la trunques.
- Cada phrase es AUTÓNOMA — no continúa de la anterior ni necesita contexto previo
- Usa al menos un concepto de book_grounding_anchors

El mismo proceso para edition_blocks_en (los enums son sensory_instruction, direct_question, concrete_image, authorial_aphorism).

PRUEBA DEL OLFATO (aplica a TODAS las frases):

¿Esta frase la diría el autor real en su voz, o la diría un post de Instagram?
- Si suena a Instagram → borra y reescribe usando un concepto específico del libro.
- Si suena al autor → pasa.

Señales de que perdiste el libro (corrige cuando las detectes en tu propio output):
- Metáforas huecas: "danza de decisiones", "laberinto de la existencia", "horizonte de posibilidades", "sueños anhelados", "esencia pura", "búsqueda incesante"
- Vocabulario intercambiable: "viaje", "camino", "luz", "presencia", "consciencia" usado sin ancla concreta
- Emoción sin concepto: "la felicidad se despliega", "la vida se revela"
- Sujeto abstracto sin verbo accionable del autor

Todas esas son señal de que saltaste los anchors. Regresa al Paso 1 mentalmente y reescribe.

═════════════════════════════════════════════════════════════════════
PROHIBICIONES DURAS (aplican siempre):
═════════════════════════════════════════════════════════════════════

- "este libro", "el autor", "la obra", "a través de"
- "nos invita a", "reflexiona sobre", "trata de", "propone"
- Instrucciones de tiempo tipo "toma 30 segundos"
- Cualquier envoltura narrativa sobre el libro
- Truncamiento: CADA frase en edition_phrases debe cerrar con punto, "?" o "!" dentro del límite. Si no cabe, piensa una frase más corta. Frases terminadas en conector/coma están MAL y hay que reescribirlas.

═════════════════════════════════════════════════════════════════════
CONTEXTO CRONOBIOLÓGICO DEL MOMENTO:
═════════════════════════════════════════════════════════════════════

- Día: ${crono.dia}
- Hora: ${crono.hora}:00 (franja ${crono.franja})
- Energía del lector: ${Math.round(crono.energia * 100)}%
- Modo del día: ${crono.modo}
- ${crono.descripcion_dia}
- ${crono.descripcion_franja}

Este contexto sesga la selección de QUÉ parte del libro (anchored en anchors) se activa hoy. El libro sigue mandando. No mencionas nada de esto en el output al usuario.`;
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
    p += `\nRecuerda: PRIMERO llenas lens_analysis con tu análisis real de cómo este libro trata (o no trata) el tema. SOLO después de buscar genuinamente decides. No marques dont_apply sin haber buscado. El usuario JAMÁS ve esto.\n---\n`;
  }

  if (hasVisual) {
    p += `\nINTENCIÓN VISUAL DEL CURADOR HOY (opcional, modificador leve):\n${visualIntent}\n`;
    p += `Interpreta esto en lenguaje natural al componer visual_signature. Puede afectar paleta, tipografía, densidad, o radios de esquinas. El libro sigue mandando el alma.\n`;
  }

  p += `\n═══════════════════════════════════════════════════════
RECORDATORIO DE PROCESO:

1. PRIMERO llena book_grounding_anchors (anclajes al libro real)
2. DESPUÉS lens_analysis (si aplica)
3. DESPUÉS las cards, words, og_phrases — cada frase usando al menos un anchor
4. Para edition_blocks: cada bloque es {gesture_type, phrase}. Primero decides gesture_type, después escribes phrase en la forma de ese tipo. Los 4 gesture_type deben ser distintos entre sí (o repetir máximo 1).
5. Al final visual_signature, surface_hints, lens_relevance, confidence

Recuerda: las 4 edition_blocks son 4 VENTANAS DISTINTAS al libro (no un párrafo partido). Cada phrase es un gesto autónomo del tipo que decidiste.

Si en algún momento escribes "danza", "laberinto", "horizonte", "sueños anhelados" o similares — es señal de que saltaste los anchors. Regresa y reescribe esa frase usando un concepto específico del libro.

Si una phrase termina en "y", "de", "se", coma u otra palabra conectora — la truncaste. Reescríbela como gesto autónomo más corto.

TODOS los arrays tienen número exacto de items (4 en la mayoría, 3-6 en algunos). NO los dejes vacíos ni incompletos.

Extrae el EditionNucleus completo siguiendo este proceso.`;
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
