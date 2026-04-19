/* ═══════════════════════════════════════════════════════════════════════════════
   extract-nucleus.js — EXTRACTOR SEMÁNTICO CANÓNICO V2
   
   Una sola llamada a OpenAI con structured outputs strict:true.
   Recibe inputs como parámetros directos (no lee archivos):
     - lens:         curaduría silenciosa (texto libre)
     - visualIntent: intención visual del día (texto libre)
     - bookContext:  contexto específico del libro (texto libre)
   Aplica automáticamente:
     - Framework cronobiológico Badir (desde fecha/hora del servidor)
     - Política editorial completa en el prompt (no en el schema)
═══════════════════════════════════════════════════════════════════════════════ */

import fs from "node:fs/promises";

const SCHEMA_URL = new URL("./edition-nucleus.schema.json", import.meta.url);

/* ─────────────────────────────────────────────────────────────────────────────
   FRAMEWORK CRONOBIOLÓGICO BADIR
   (documentado en Archivo Maestro, no es ciencia canónica — es calibración personal)
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

  let franja;
  let franjaDesc;
  if (hora >= 0 && hora < 6)        { franja = "madrugada"; franjaDesc = "Madrugada: claridad mental máxima. Presencia. Pocas palabras, mucho peso."; }
  else if (hora >= 6 && hora < 12)  { franja = "manana";    franjaDesc = "Mañana: cortisol alto, acción. Directo, claro, con propósito."; }
  else if (hora >= 12 && hora < 18) { franja = "tarde";     franjaDesc = "Tarde: pensamiento analítico. Matices, profundidad, contexto."; }
  else                              { franja = "noche";     franjaDesc = "Noche: melatonina en ascenso. Reflexivo, contemplativo, sin urgencia."; }

  const diaInfo = diaMap[dia] || diaMap.lunes;
  return {
    dia, hora, franja,
    energia: diaInfo.energia,
    modo: diaInfo.modo,
    descripcion_dia: diaInfo.descripcion,
    descripcion_franja: franjaDesc
  };
}

async function loadSchema() {
  return JSON.parse(await fs.readFile(SCHEMA_URL, "utf8"));
}

/* ─────────────────────────────────────────────────────────────────────────────
   PROMPT DEL SISTEMA — contiene toda la política editorial
   (el schema es el contrato técnico; el prompt es la política)
────────────────────────────────────────────────────────────────────────────── */

function systemPrompt(crono) {
  return `Eres el Extractor Semántico de Triggui.

Triggui tiene UN propósito: hacer que el lector abra un libro físico.

REGLA MADRE:
No eres crítico ni reseñador. No hablas DEL libro.
Produces texto que podría estar EN el libro, en la voz del autor en ESTE libro específico.
El lector debe sentir que abrió el libro en una página al azar y leyó. Nada más.

═══════════════════════════════════════════════════════════════════
IDENTIDAD CORRECTA DEL LIBRO (book_identity)
═══════════════════════════════════════════════════════════════════

- titulo_en: usa el TÍTULO ORIGINAL de publicación en inglés si lo conoces.
  • "Peak Mind" para el libro de Amishi Jha (NO "The New Science of Attention")
  • "Atomic Habits" para James Clear (NO "Hábitos Atómicos")
  • "Build" para Tony Fadell
  • "The Almanack of Naval Ravikant" para Eric Jorgenson
  Solo traduces literalmente si el libro no tiene edición inglesa conocida.

- autor: nombre COMPLETO como aparece en la edición publicada.
  • "Amishi P. Jha" (no solo "Amishi")
  • "James Clear" (no "J. Clear")
  • "Ryan Holiday" (no "R. Holiday")
  Si el CSV viene con el nombre incompleto, tú lo completas con tu conocimiento.

═══════════════════════════════════════════════════════════════════
PROCESO OBLIGATORIO (sigue este orden)
═══════════════════════════════════════════════════════════════════

PASO 1 — ANCLAJE (book_grounding_anchors)
Antes de escribir cualquier otra cosa, llena book_grounding_anchors honestamente:
- ¿Conoces ESTE libro específico o solo el título? Marca book_known.
- Lista 3-5 conceptos REALES del libro (no genéricos). Ejemplos correctos:
  • Peak Mind: "flashlight attention", "3 subsistemas alerting/orienting/executive", "12 minutos de práctica diaria"
  • Atomic Habits: "regla del 1% mejor cada día", "loop señal-antojo-respuesta-recompensa", "identidad vs. resultados"
  • Meditaciones: "dominio ante los insultos", "el alma se tiñe de sus pensamientos"
- 3-6 términos del vocabulario propio del autor
- 2-3 oraciones describiendo CÓMO escribe este autor específicamente

Los anchors son tu brújula para TODO lo demás.

PASO 2 — ANÁLISIS DE LENTE (lens_analysis)
Si hay lens o book_context, DEBES analizar antes de decidir:
- apply_directly: el libro trata directamente el tema
- apply_through_adjacent_concept: hay un concepto cercano que sirve de puente
- dont_apply_book_is_about_something_else: solo si tras buscar no hay conexión real
NUNCA marques dont_apply sin haber buscado. Y cuando aplica, lens_relevance.applied DEBE coincidir (true para apply_directly/apply_through_adjacent_concept, false solo para dont_apply).

PASO 3 — CARDS, WORDS, OG_PHRASES, EDITION_BLOCKS
Cada frase DEBE usar al menos un concepto de anchors.concepts o un key_term.
Si una frase podría aparecer en CUALQUIER libro de autoayuda → mal, reescríbela.

EDITION_BLOCKS tienen regla especial:
Son 4 VENTANAS DISTINTAS al libro (NO 4 pedazos de un párrafo).
Cada bloque = { gesture_type, phrase }.
Primero decides gesture_type (los 4 deben ser DIFERENTES o repetir máximo 1):
- instruccion_sensorial: micro-acción física/perceptual (imperativo + sensorial)
- pregunta_directa: pregunta del libro al lector (cierra con "?")
- imagen_concreta: imagen visual sin imperativo
- aforismo_autorial: sentencia corta cerrada con punto

Después escribes cada phrase en la forma propia de su tipo, con emoji al inicio.
REGLA CRÍTICA DE CIERRE: cada phrase debe cerrar con ".", "?" o "!". Nunca con "y", "de", "se", coma o palabra conectora. Si no cabe la idea completa en 110 chars, reformula más corta — NO la trunques.

PASO 4 — VISUAL_SIGNATURE
Emerge del libro, no de Triggui. Colores, tipografía, densidad, ritmo, era, género — todos desde el alma del libro.

═══════════════════════════════════════════════════════════════════
PRUEBA DEL OLFATO (aplica a toda frase)
═══════════════════════════════════════════════════════════════════

¿Esta frase la diría el autor real en su voz, o la diría un post de Instagram?
- Si suena a Instagram → borra y reescribe usando un concepto específico del libro.
- Si suena al autor → pasa.

Señales de que perdiste el libro:
- Metáforas huecas: "danza de decisiones", "laberinto de la existencia", "horizonte de posibilidades", "sueños anhelados", "esencia pura", "búsqueda incesante"
- Vocabulario intercambiable: "viaje", "camino", "luz", "presencia" sin ancla concreta
- Emoción sin concepto: "la felicidad se despliega", "la vida se revela"

Si detectas esas señales en tu propio output, regresa al PASO 1 mentalmente y reescribe.

═══════════════════════════════════════════════════════════════════
PROHIBICIONES DURAS
═══════════════════════════════════════════════════════════════════

- "este libro", "el autor", "la obra", "a través de"
- "nos invita a", "reflexiona sobre", "trata de", "propone", "muestra cómo"
- Instrucciones de tiempo tipo "toma 30 segundos"
- Cualquier envoltura narrativa sobre el libro
- Mencionar a Triggui, al curador, o al proceso de curaduría

═══════════════════════════════════════════════════════════════════
CONTEXTO CRONOBIOLÓGICO DEL MOMENTO
═══════════════════════════════════════════════════════════════════

- Día: ${crono.dia}
- Hora: ${crono.hora}:00 (franja ${crono.franja})
- Energía del lector: ${Math.round(crono.energia * 100)}%
- Modo del día: ${crono.modo}
- ${crono.descripcion_dia}
- ${crono.descripcion_franja}

Este contexto sesga QUÉ parte del libro se activa hoy. El libro sigue mandando. NO lo mencionas en el output al usuario.`;
}

function userPrompt(book, lens, visualIntent, bookContext) {
  let p = `LIBRO:\nTítulo: "${book.titulo}"\nAutor: ${book.autor}`;
  if (book.tagline) p += `\nContexto editorial: "${book.tagline}"`;

  if (lens || bookContext) {
    p += `\n\nCURADURÍA SILENCIOSA DEL CURADOR:`;
    if (lens) p += `\n[Lente global]\n${lens}`;
    if (bookContext) p += `\n[Contexto específico de ESTE libro]\n${bookContext}`;
    p += `\n\nRecuerda: analiza HONESTAMENTE en lens_analysis cómo el libro trata este tema. NO marques dont_apply sin buscar. lens_relevance.applied DEBE ser consistente con lens_analysis.decision.`;
  }

  if (visualIntent) {
    p += `\n\nINTENCIÓN VISUAL DEL CURADOR (modificador leve):\n${visualIntent}`;
  }

  p += `\n\nRECORDATORIO DE PROCESO:
1. Llena book_grounding_anchors con conceptos REALES del libro
2. Si hay lente, llena lens_analysis con análisis real antes de decidir
3. Escribe cards, og_phrases, edition_blocks — cada frase usando un anchor
4. edition_blocks: primero gesture_type, después phrase en la forma de su tipo. Los 4 tipos deben ser DIFERENTES.
5. Cada phrase DEBE cerrar con ".", "?" o "!" — nunca con conector suelto.

Extrae el EditionNucleus completo.`;

  return p;
}

/* ─────────────────────────────────────────────────────────────────────────────
   EXTRACCIÓN con reintentos y backoff exponencial
────────────────────────────────────────────────────────────────────────────── */

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

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
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
      return {
        nucleus: JSON.parse(chat.choices[0]?.message?.content || "{}"),
        usage: chat.usage,
        model: chat.model,
        elapsed_ms: Date.now() - t0,
        attempt,
        crono,
        inputs_applied: {
          has_lens: Boolean(lens),
          has_visual_intent: Boolean(visualIntent),
          has_book_context: Boolean(bookContext)
        }
      };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
    }
  }
  throw new Error(`extractNucleus falló tras 3 intentos: ${lastError?.message}`);
}
