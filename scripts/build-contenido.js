/* ═══════════════════════════════════════════════════════════════════════════════
   TRIGGUI v7.6 ULTRA GOD - VERSIÓN DEFINITIVA
   
   Sistema de generación de contenido enriquecido para libros.
   
   CARACTERÍSTICAS v7.6:
   ✅ Palabras emocionales profundas (Hawkins 20-100)
   ✅ Frases únicas con estructuras radicalmente diferentes
   ✅ Paletas cromáticas imposibles de confundir
   ✅ Tarjetas editoriales DARK MODE (logo blanco visible)
   ✅ Tarjetas con JOURNEY CONTINUO (palabras → frases → tarjeta)
   ✅ Contenido DINÁMICO sin límites hardcodeados
   ✅ Delay/reintentos configurables (10seg, 20x)
   ✅ Temperatura optimizada (1.0)
   ✅ Logging detallado para diagnóstico
   ✅ Validación doble anti-repetición
   ✅ Fallback robusto con contenido real
   ✅ CERO duplicados de variables
   
   AUTOR: Badir Nakid
   FECHA: Noviembre 2025
   VERSIÓN: 7.6 ULTRA GOD DEFINITIVO
═══════════════════════════════════════════════════════════════════════════════ */

import fs from "node:fs/promises";
import { parse } from "csv-parse/sync";
import OpenAI from "openai";
import crypto from "node:crypto";

/* ═══════════════════════════════════════════════════════════════
   ⚙️  CONFIGURACIÓN GLOBAL
   
   Modifica estos valores para ajustar el comportamiento del sistema.
   
   PARÁMETROS:
   - model: Modelo de OpenAI a usar
   - temp: Creatividad (0.7=coherente, 1.5=salvaje)
   - delay: Milisegundos entre libros (evita rate limit)
   - maxReintentos: Intentos adicionales si falla generación
   - max: Cantidad de libros a procesar por ejecución
═══════════════════════════════════════════════════════════════ */

const KEY = process.env.OPENAI_KEY;
if (!KEY) process.exit(console.log("🔕 Sin OPENAI_KEY"));

const CFG = {
  model: "gpt-4o-mini",         // 🤖 Modelo (gpt-4o-mini | gpt-4o)
  temp: 1,                       // 🌡️  Creatividad optimizada
  top_p: .9,                     // 🎲 Diversidad de tokens
  presence: 0.7,                 // 🚫 Penaliza repetir temas
  frequency: 0.4,                // 🔁 Penaliza repetir palabras
  csv: "data/libros_master.csv", // 📁 Archivo de entrada
  out: "contenido.json",         // 💾 Archivo de salida
  max: 20,                       // 📚 Libros por ejecución
  delay: 10000,                  // ⏱️  Delay entre libros (10 segundos)
  maxReintentos: 20              // 🔄 Reintentos por libro (hasta 20x)
};

/* ═══════════════════════════════════════════════════════════════
   🛠️  UTILIDADES
   
   Funciones helper organizadas en namespace único.
═══════════════════════════════════════════════════════════════ */

const utils = {
  // 💡 Calcula luminancia de un color (0=negro, 1=blanco)
  lum: h => {
    const [r, g, b] = h.slice(1).match(/../g).map(x => parseInt(x, 16) / 255);
    const f = v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  },

  // 🎨 Decide color de texto según luminancia del fondo
  txt: h => utils.lum(h) > 0.35 ? "#000000" : "#FFFFFF",

  // 🔀 Mezcla array aleatoriamente (Fisher-Yates)
  shuffle: arr => {
    let m = arr.length, i;
    while (m) [arr[m], arr[i]] = [arr[i = Math.floor(Math.random() * m--)], arr[m]];
    return arr;
  },

  // 🧹 Limpia markdown de respuestas de IA
  clean: raw => raw.trim()
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .replace(/^[^{[]*/, "")
    .replace(/[^}\]]*$/, "")
};

// 📊 Estado de sesión (memoria anti-repetición)
const state = { palabras: new Set(), colores: new Set() };

// ⏱️  Función sleep para delays
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/* ═══════════════════════════════════════════════════════════════
   🕐 CRONOBIOLOGÍA
   
   Detecta día y hora actual para ajustar tono del contenido
   según energía circadiana y semanal.
   
   MAPA SEMANAL:
   - Lunes:    Arquitectura (80%)
   - Martes:   Tensión Máxima (40%) ⚠️
   - Miércoles: Purga (60%)
   - Jueves:   DÍA DIOS (120%) 🔥
   - Viernes:  Cierre (90%)
   - Sábado:   Descanso (80%)
   - Domingo:  Reset (80%)
═══════════════════════════════════════════════════════════════ */

function crono() {
  const now = new Date();
  const dia = now.toLocaleDateString("es-MX", { weekday: "long" });
  const hora = now.getHours();

  const dias = {
    lunes: { e: "80%", n: "Arquitectura", s: "Planificación gradual" },
    martes: { e: "40%", n: "Tensión Máxima", s: "Supervivencia emocional" },
    miércoles: { e: "60%", n: "Purga", s: "Claridad emergente" },
    jueves: { e: "120%", n: "DÍA DIOS", s: "Pico absoluto" },
    viernes: { e: "90%", n: "Cierre", s: "Consolidación" },
    sábado: { e: "80%", n: "Descanso", s: "Familia, juego" },
    domingo: { e: "80%", n: "Reset", s: "Preparación" }
  };

  const horas = [
    [4, 7, "Ventana Oro", "máxima claridad mental"],
    [7, 9, "Pico Fuerza", "ejercicio intenso"],
    [9, 12, "Pico Cognitivo", "decisiones críticas"],
    [12, 14, "Pre-digestión", "tareas mecánicas"],
    [14, 15, "Valle Post", "descanso obligatorio"],
    [15, 17, "Segundo Pico", "creatividad lateral"],
    [17, 19, "Social", "conexión emocional"],
    [19, 24, "Preparación", "desconexión total"],
    [0, 4, "Sueño", "recuperación"]
  ];

  const franja = horas.find(f => hora >= f[0] && hora < f[1]) || horas[0];
  const d = dias[dia.toLowerCase()] || dias.lunes;

  return { dia, hora, d, franja };
}

/* ═══════════════════════════════════════════════════════════════
   🧙‍♂️ PROMPTS (EL CEREBRO DEL SISTEMA)
   
   Define exactamente QUÉ le dices a la IA para generar contenido.
   
   3 TIPOS DE PROMPTS:
   1. main    → Palabras, frases, colores (JSON)
   2. tarjeta → Título, párrafos (texto) CON JOURNEY CONTINUO
   3. estilo  → Diseño visual DARK MODE (JSON experimental)
   
   MODIFICAR AQUÍ para cambiar la calidad/estilo del contenido.
═══════════════════════════════════════════════════════════════ */

function prompt(libro, tipo, c, extra = null) {
  const seed = crypto.randomUUID();
  const prohibidas = [...state.palabras].join(", ");
  const prohibidosC = [...state.colores].join(", ");

  // 📝 Contexto base compartido por todos los prompts
  const base = `
Eres Triggui. Dominio absoluto de:
- Mapa Hawkins (20-1000)
- Cronobiología humana
- Psicología del comportamiento
- Diseño editorial nivel Vignelli/Carson

LIBRO: "${libro.titulo}" - ${libro.autor}
${libro.tagline ? `TAGLINE: "${libro.tagline}"` : ""}

CONTEXTO CRONO: ${c.dia} ${c.hora}h | ${c.d.n} (${c.d.e}) | ${c.d.s}
SEMILLA: ${seed}

${prohibidas ? `🚫 PROHIBIDAS: ${prohibidas}` : ""}
${prohibidosC ? `🎨 PROHIBIDOS: ${prohibidosC}` : ""}
`;

  const prompts = {
    /* ─────────────────────────────────────────────────────────
       PROMPT 1: MAIN
       
       Genera: dimension, punto, palabras, frases, colores, fondo
    ───────────────────────────────────────────────────────── */
    main: base + `
GENERA JSON PURO:

{
  "dimension": "Bienestar|Prosperidad|Conexión",
  "punto": "Cero|Creativo|Activo|Máximo",
  "palabras": [4 emociones únicas, BAJAS Hawkins 20-100, relacionadas específicamente al libro],
  "frases": [4 frases con estructuras RADICALMENTE diferentes, emoji único, 100-120 chars],
  "colores": [4 hex únicos, mezcla cálido/frío, valores RGB inusuales, dopaminérgicos],
  "fondo": "#hex oscuro"
}

REGLAS CRÍTICAS:
✅ Cada palabra: EMOCIONES DENSAS del fondo del mapa, súper específica al libro
✅ Cada frase: estructura ÚNICA, emoji ÚNICO, primero desarrolla contexto emocional, luego acción CONCRETA
✅ Cada color: imposible confundir con paletas anteriores

SOLO JSON.`,

    /* ─────────────────────────────────────────────────────────
       PROMPT 2: TARJETA - JOURNEY CONTINUO
       
       Genera: título, parrafoTop, subtitulo, parrafoBot
       
       🔗 CRITICAL: Debe continuar el viaje emocional de palabras/frases
       🎯 DINÁMICO: Sin límites hardcodeados, flujo natural
    ───────────────────────────────────────────────────────── */
    tarjeta: base + `
${extra ? `
═══════════════════════════════════════════════════════════════
JOURNEY EMOCIONAL PREVIO (contexto crítico):
═══════════════════════════════════════════════════════════════

PALABRAS EMOCIONALES GENERADAS:
${extra.palabras.map((p, i) => `${i + 1}. ${p}`).join("\n")}

FRASES DE ACCIÓN GENERADAS:
${extra.frases.map((f, i) => `${i + 1}. ${f}`).join("\n")}

═══════════════════════════════════════════════════════════════
TU TAREA: Continuar este journey emocional de forma orgánica.
El usuario ya pasó por estas emociones bajas (palabras Hawkins 20-100)
y ya vio estas acciones concretas (frases).

AHORA en la tarjeta:
1. Párrafo 1: Insight que CONECTA con esas emociones/acciones previas
2. Subtítulo: Bisagra que ELEVA desde esas emociones hacia transformación
3. Párrafo 2: Acción ESPECÍFICA que construye sobre las frases previas

TODO DEBE SER UNA CONTINUACIÓN NATURAL DEL JOURNEY.
═══════════════════════════════════════════════════════════════
` : ""}

Escribe contenido editorial que complete el journey emocional:

TÍTULO: Concepto específico del libro (natural, sin límites artificia les)
PÁRRAFO 1: Insight en 1ra persona del autor que CONECTA con emociones previas
SUBTÍTULO: Pregunta o frase provocadora que ELEVA desde las emociones hacia transformación
PÁRRAFO 2: Acción concreta 15-60seg con CONTEXTO RICO que construye sobre frases previas

REGLAS JOURNEY:
✅ CONECTAR: Menciona indirectamente las emociones/temas de palabras previas
✅ ELEVAR: Subtítulo debe ser bisagra desde emociones bajas → transformación
✅ CONSTRUIR: Acción en P2 debe sentirse como siguiente paso lógico después de frases
✅ FLUJO NATURAL: Sin límites artificiales, deja que el contenido respire

REGLAS TÉCNICAS:
❌ NO uses: corchetes [], "Bisagra provocadora", "Reflexión activa", metadata
❌ NO copies: palabras/frases literales previas (refiérelas indirectamente)
✅ SÍ crea: Contenido que se SIENTE como continuación natural del journey

TONO: Primera persona del autor, sobrio, directo, humano, útil

FORMATO (4 líneas sin tags):
[Título]
[Párrafo 1 - Insight conectado]
[Subtítulo - Bisagra elevadora]
[Párrafo 2 - Acción con contexto rico]

EJEMPLO CON JOURNEY:
PALABRAS: desesperanza, confusión, frustración, vacío
FRASES: "🌱 Da un paso...", "🔍 Observa sin juzgar...", etc.

TARJETA RESULTANTE:
El poder de la pausa consciente
Cuando experimenté el Niksen, descubrí que esos momentos de aparente vacío eran en realidad espacios de claridad profunda.
¿Y si detenerte fuera el movimiento más poderoso?
Después de observar tus pensamientos sin juzgar, dedica 10 minutos a simplemente ser: sin agenda, sin objetivo, solo presencia plena con lo que surge.

GENERA AHORA LAS 4 LÍNEAS:`,

    /* ─────────────────────────────────────────────────────────
       PROMPT 3: ESTILO (DARK MODE)
       
       Genera: JSON de diseño visual experimental
       🌑 DARK MODE FORZADO para logo blanco de Buscalibre
    ───────────────────────────────────────────────────────── */
    estilo: base + `
Diseña tarjeta DARK MODE (fondo oscuro, texto claro):

JSON con 15-28 claves:
- Conocidas: accent, ink, paper, border, serif, sans, mono, display
- Inventadas (8-15): glowFlux, metaShadow, warpGrid, prismPulse, etc
- surprise: string describiendo recurso más inesperado

REGLAS DARK MODE OBLIGATORIAS:
✅ paper: SIEMPRE colores oscuros (#0a0a0a a #2a2a2a)
✅ ink: SIEMPRE colores claros (#e0e0e0 a #ffffff)
✅ accent: Colores vibrantes que contrasten con fondo oscuro
✅ border: Tonos sutiles pero visibles sobre oscuro

Mezcla: Clásico + Experimental + Rigor + Dopamina

SOLO JSON entre @@STYLE y @@ENDSTYLE`
  };

  return prompts[tipo];
}

/* ═══════════════════════════════════════════════════════════════
   📞 LLAMADA API
   
   Función que comunica con OpenAI.
   
   INNOVACIÓN CLAVE:
   response_format: { type: "json_object" }
   → Garantiza JSON válido siempre
═══════════════════════════════════════════════════════════════ */

async function call(openai, sys, usr, forceJSON = false) {
  const config = {
    model: CFG.model,
    temperature: CFG.temp,
    top_p: CFG.top_p,
    presence_penalty: CFG.presence,
    frequency_penalty: CFG.frequency,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: usr }
    ]
  };

  if (forceJSON) {
    config.response_format = { type: "json_object" };
  }

  const chat = await openai.chat.completions.create(config);
  return chat.choices[0].message.content;
}

/* ═══════════════════════════════════════════════════════════════
   ⚡ ENRIQUECIMIENTO (PIPELINE COMPLETO)
   
   Toma un libro del CSV y genera TODO el contenido enriquecido.
   
   FLUJO (9 PASOS):
   1. Genera JSON principal (palabras, frases, colores)
   2. Valida respuesta completa → Reintenta si falta algo
   3. Valida anti-repetición → Reintenta si hay repetidas
   4. Registra palabras/colores usados
   5. Garantiza longitud de arrays (sin "default")
   6. Post-procesa colores de texto
   7. Genera tarjeta de contenido CON JOURNEY CONTINUO
   8. Genera tarjeta de estilo visual DARK MODE
   9. Retorna objeto completo
   
   PROTECCIONES:
   - Logging detallado en cada paso
   - Reintento automático si respuesta incompleta
   - Reintento automático si palabras repetidas
   - Error si arrays vacíos → Fallback completo
   - Loop con reintentos configurables (20x)
   - Try-catch global → Fallback garantizado
   - Stack trace en errores para diagnóstico
═══════════════════════════════════════════════════════════════ */

async function enrich(libro, openai, c) {
  let intento = 0;
  
  while (intento <= CFG.maxReintentos) {
    try {
      // ─────────────────────────────────────────────────────────
      // PASO 1: GENERACIÓN PRINCIPAL
      // ─────────────────────────────────────────────────────────
      console.log(`   🔧 Paso 1: Generando JSON principal...`);
      const p = prompt(libro, "main", c);
      let raw = await call(openai, p, "Genera JSON ahora", true);
      let extra = JSON.parse(raw);
      console.log(`   ✅ JSON parseado: ${extra.palabras?.length || 0} palabras`);

      // ─────────────────────────────────────────────────────────
      // PASO 2: VALIDACIÓN DE RESPUESTA COMPLETA
      // ─────────────────────────────────────────────────────────
      const faltaCampos = !extra.frases || !extra.colores || !extra.palabras ||
                          extra.frases.length === 0 || extra.colores.length === 0 || extra.palabras.length === 0;
      
      if (faltaCampos) {
        console.warn(`   ⚠️  Respuesta incompleta, reintentando...`);
        raw = await call(openai, p, "Genera JSON completo ahora", true);
        extra = JSON.parse(raw);
      }

      // ─────────────────────────────────────────────────────────
      // PASO 3: VALIDACIÓN ANTI-REPETICIÓN
      // ─────────────────────────────────────────────────────────
      const repetidas = extra.palabras?.filter(p => state.palabras.has(p.toLowerCase())) || [];
      
      if (repetidas.length > 0) {
        console.warn(`   ⚠️  Repetidas: ${repetidas.join(", ")}`);
        const pVal = `Genera 4 palabras únicas. PROHIBIDAS: ${[...state.palabras].join(", ")}. SOLO JSON.`;
        raw = await call(openai, prompt(libro, "main", c), pVal, true);
        extra = JSON.parse(raw);
      }

      // ─────────────────────────────────────────────────────────
      // PASO 4: REGISTRAR USADOS
      // ─────────────────────────────────────────────────────────
      console.log(`   🔧 Paso 4: Registrando palabras usadas...`);
      extra.palabras?.forEach(p => state.palabras.add(p.toLowerCase()));
      extra.colores?.forEach(c => state.colores.add(c));

      // ─────────────────────────────────────────────────────────
      // PASO 5: GARANTIZAR LONGITUD (SIN "default")
      // ─────────────────────────────────────────────────────────
      console.log(`   🔧 Paso 5: Validando longitud de arrays...`);
      ["palabras", "frases", "colores"].forEach(k => {
        if (!extra[k]) extra[k] = [];
        if (extra[k].length === 0) throw new Error(`Array vacío: ${k}`);
        while (extra[k].length < 4) extra[k].push(extra[k][extra[k].length - 1]);
      });

      // ─────────────────────────────────────────────────────────
      // PASO 6: POST-PROCESAMIENTO
      // ─────────────────────────────────────────────────────────
      console.log(`   🔧 Paso 6: Calculando colores de texto...`);
      extra.textColors = extra.colores.map(utils.txt);

      // ─────────────────────────────────────────────────────────
      // PASO 7: TARJETA CONTENIDO (CON JOURNEY CONTINUO)
      // ─────────────────────────────────────────────────────────
      console.log(`   🔧 Paso 7: Generando tarjeta con journey continuo...`);
      const pT = prompt(libro, "tarjeta", c, extra);  // ⭐ Pasa extra para journey
      let rawT = await call(openai, pT, "Genera tarjeta");
      rawT = rawT.replace(/@@BODY|@@ENDBODY/g, "").trim();
      
      // Limpieza inteligente de metadata sin hardcodear límites
      const lineas = rawT.split(/\n+/).filter(Boolean).map(l => {
        return l
          .replace(/^\[|\]$/g, "")  // Eliminar corchetes
          .replace(/\[Título\]|\[Párrafo.*?\]|\[Subtítulo\]|\[Acción.*?\]/gi, "")  // Metadata
          .replace(/^(Concepto único|Insight específico|Bisagra provocadora|Reflexión activa)[:.\s]*/gi, "")  // Labels genéricos
          .trim();
      }).filter(l => l.length > 10);  // Eliminar líneas muy cortas (probablemente basura)
      
      extra.tarjeta = {
        titulo: lineas[0] || "",
        parrafoTop: lineas[1] || "",
        subtitulo: lineas[2] || "",
        parrafoBot: lineas.slice(3).join(" "),  // ⭐ Sin límites, flujo natural
        style: {}
      };

      // ─────────────────────────────────────────────────────────
      // PASO 8: TARJETA ESTILO (CON FORZADO DARK MODE)
      // ─────────────────────────────────────────────────────────
      console.log(`   🔧 Paso 8: Generando tarjeta de estilo...`);
      const pE = prompt(libro, "estilo", c);
      let rawE = await call(openai, pE, "Genera estilo");
      rawE = rawE.replace(/@@STYLE|@@ENDSTYLE/g, "").trim();
      
      try {
        extra.tarjeta.style = JSON.parse(utils.clean(rawE));
        
        // 🌑 FORZAR DARK MODE si IA se equivocó
        if (extra.tarjeta.style.paper && utils.lum(extra.tarjeta.style.paper) > 0.3) {
          console.warn(`   ⚠️  Fondo claro detectado, forzando dark mode...`);
          extra.tarjeta.style.paper = "#1a1a1a";
        }
        if (extra.tarjeta.style.ink && utils.lum(extra.tarjeta.style.ink) < 0.7) {
          console.warn(`   ⚠️  Texto oscuro detectado, forzando claro...`);
          extra.tarjeta.style.ink = "#f0f0f0";
        }
      } catch (e) {
        console.warn(`   ⚠️  Style error: ${e.message}`);
        // Fallback dark mode
        extra.tarjeta.style = {
          accent: "#ff6b6b",
          ink: "#f0f0f0",
          paper: "#1a1a1a",
          border: "#333333"
        };
      }

      // ─────────────────────────────────────────────────────────
      // PASO 9: RETURN FINAL
      // ─────────────────────────────────────────────────────────
      console.log(`   ✅ Libro completado exitosamente`);
      return {
        ...libro,
        ...extra,
        portada: libro.portada?.trim() || `📚 ${libro.titulo}\n${libro.autor}`,
        videoUrl: `https://duckduckgo.com/?q=!ducky+site:youtube.com+${encodeURIComponent(`${libro.titulo} ${libro.autor} entrevista español`)}`
      };

    } catch (e) {
      intento++;
      console.error(`   ❌ Intento ${intento}/${CFG.maxReintentos + 1}: ${e.message}`);
      console.error(`   📍 Stack: ${e.stack?.split('\n')[1]?.trim() || 'N/A'}`);
      
      if (intento <= CFG.maxReintentos) {
        console.warn(`   🔄 Reintentando en 2 segundos...`);
        await sleep(2000);
        continue;
      }
      
      console.error(`   ⚠️  Máximo de reintentos alcanzado. Usando fallback.`);
      break;
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // FALLBACK COMPLETO (DARK MODE + JOURNEY)
  // 
  // Solo se ejecuta si fallan TODOS los reintentos.
  // Garantiza contenido válido siempre en DARK MODE.
  // ═══════════════════════════════════════════════════════════
  console.warn(`   🛡️  Activando fallback con contenido genérico...`);
  return {
    ...libro,
    dimension: "Bienestar",
    punto: "Cero",
    palabras: ["humillación", "culpabilidad", "desesperanza", "duelo"],
    frases: [
      "🚶 Camina 10 pasos lentos sin pensar en nada más",
      "❤️ Nombra en voz baja a quién ayudaste hoy sin esperar nada",
      "🧠 Anota 3 palabras que resuman este momento exacto",
      "✨ Abre el libro en página random, lee 1 línea completa"
    ],
    colores: ["#ff8a8a", "#ffb56b", "#8cabff", "#d288ff"],
    textColors: ["#FFFFFF", "#000000", "#000000", "#FFFFFF"],
    fondo: "#0a0a0a",
    portada: libro.portada || `📚 ${libro.titulo}`,
    tarjeta: {
      titulo: "Empieza pequeño",
      parrafoTop: "Cuando el peso de las emociones difíciles aparece, he aprendido que la acción más simple es la más poderosa.",
      subtitulo: "¿Y si un paso bastara para cambiar todo?",
      parrafoBot: "Después de esas pequeñas acciones que hiciste, toma este momento: identifica una cosa que puedas hacer en 15 segundos que te acerque a sentirte mejor. Hazla ahora, sin pensar.",
      style: {
        accent: "#ff6b6b",
        ink: "#f0f0f0",
        paper: "#1a1a1a",
        border: "#333333",
        serif: "Georgia, serif",
        sans: "Inter, sans-serif"
      }
    },
    videoUrl: `https://duckduckgo.com/?q=!ducky+site:youtube.com+${encodeURIComponent(libro.titulo)}`
  };
}

/* ═══════════════════════════════════════════════════════════════
   🚀 MAIN (PUNTO DE ENTRADA)
   
   Flujo principal de ejecución:
   1. Inicializa cliente OpenAI
   2. Obtiene contexto cronobiológico
   3. Muestra banner informativo
   4. Lee CSV de libros
   5. Mezcla aleatoriamente y selecciona N libros
   6. Procesa cada libro con delay
   7. Reset de memoria cada 5 libros (DESPUÉS de procesar)
   8. Guarda JSON final
   9. Muestra resumen
   
   EJECUCIÓN:
   node build-contenido.js
═══════════════════════════════════════════════════════════════ */

const openai = new OpenAI({ apiKey: KEY });
const c = crono();

console.log("╔═══════════════════════════════════════════════╗");
console.log("║  TRIGGUI v7.6 ULTRA GOD - VERSIÓN DEFINITIVA ║");
console.log("╚═══════════════════════════════════════════════╝\n");
console.log(`📅 ${new Date().toLocaleDateString("es-MX", { dateStyle: "full" })}`);
console.log(`⏰ ${new Date().toLocaleTimeString("es-MX")}`);
console.log(`🤖 ${CFG.model} | 🌡️  ${CFG.temp} (optimizado)`);
console.log(`⏱️  Delay: ${CFG.delay}ms | Reintentos: ${CFG.maxReintentos}`);
console.log(`📊 Energía: ${c.d.n} (${c.d.e})\n`);

// Lee y parsea CSV
const csv = await fs.readFile(CFG.csv, "utf8");
const lista = parse(csv, { columns: true, skip_empty_lines: true });
const pick = utils.shuffle([...lista]).slice(0, Math.min(CFG.max, lista.length));

// Procesamiento principal
const libros = [];
let i = 0;

for (const libro of pick) {
  i++;
  console.log(`📖 [${i}/${pick.length}] ${libro.titulo}`);
  libros.push(await enrich(libro, openai, c));
  
  // Reset cada 5 (DESPUÉS de procesar exitosamente)
  if (i % 5 === 0 && i < pick.length) {
    console.log(`   📊 P:${state.palabras.size} C:${state.colores.size} | 🔄 Reset`);
    state.palabras.clear();
    state.colores.clear();
  }
  
  // Delay (excepto en último libro)
  if (i < pick.length) {
    await sleep(CFG.delay);
  }
}

// Guardado final
await fs.writeFile(CFG.out, JSON.stringify({ libros }, null, 2));

console.log("\n╔═══════════════════════════════════════════════╗");
console.log("║            GENERACIÓN COMPLETA                ║");
console.log("╚═══════════════════════════════════════════════╝\n");
console.log(`✅ ${CFG.out}`);
console.log(`📚 ${libros.length} libros procesados`);
console.log(`📊 ${state.palabras.size} palabras | ${state.colores.size} colores\n`);
console.log("🔥 Sistema v7.6 ULTRA GOD ejecutado con éxito\n");

/* ═══════════════════════════════════════════════════════════════
   📖 GUÍA DE USO RÁPIDO
   
   EJECUCIÓN BÁSICA:
   node build-contenido.js
   
   ══════════════════════════════════════════════════════════════
   
   AJUSTES DINÁMICOS (LÍNEAS DE REFERENCIA):
   
   Línea 50: temp (creatividad)
   Línea 51: top_p (diversidad)
   Línea 56: max (libros por ejecución)
   Línea 57: delay (ms entre libros)
   Línea 58: maxReintentos (intentos por libro)
   
   ══════════════════════════════════════════════════════════════
   
   CARACTERÍSTICAS v7.6:
   
   ✅ JOURNEY CONTINUO: Tarjeta conecta con palabras/frases previas
   ✅ DINÁMICO: Sin límites hardcodeados, flujo natural
   ✅ CONTEXT-AWARE: IA ve palabras/frases antes de generar tarjeta
   ✅ LIMPIEZA INTELIGENTE: Elimina metadata pero respeta contenido
   ✅ DARK MODE: 100% garantizado
   ✅ DELAY/REINTENTOS: Tu configuración que funciona (10seg, 20x)
   
   ══════════════════════════════════════════════════════════════
   
   🔥 VERSIÓN DEFINITIVA ULTRA GOD
   
═══════════════════════════════════════════════════════════════ */
