/* ═══════════════════════════════════════════════════════════════════════════════
   TRIGGUI v7.4 GOD MODE - CÓDIGO DEFINITIVO PRODUCCIÓN
   
   Sistema de generación de contenido enriquecido para libros.
   
   CARACTERÍSTICAS v7.4:
   ✅ Palabras emocionales profundas (Hawkins 20-75)
   ✅ Frases únicas con estructuras radicalmente diferentes
   ✅ Paletas cromáticas imposibles de confundir
   ✅ Tarjetas editoriales DARK MODE (logo blanco visible)
   ✅ Delay 3 segundos entre libros (anti rate limit)
   ✅ Reintentos automáticos 3x
   ✅ Temperatura optimizada (1.1)
   ✅ Logging detallado para diagnóstico
   ✅ Validación doble anti-repetición
   ✅ Fallback robusto con contenido real
   ✅ CERO duplicados de variables
   
   AUTOR: Badir Nakid
   FECHA: Noviembre 2025
   VERSIÓN: 7.4 GOD MODE
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
  temp: 1.1,                     // 🌡️  Creatividad optimizada
  top_p: 0.95,                   // 🎲 Diversidad de tokens
  presence: 0.7,                 // 🚫 Penaliza repetir temas
  frequency: 0.4,                // 🔁 Penaliza repetir palabras
  csv: "data/libros_master.csv", // 📁 Archivo de entrada
  out: "contenido.json",         // 💾 Archivo de salida
  max: 5,                        // 📚 Libros por ejecución
  delay: 3000,                   // ⏱️  Delay entre libros (3 segundos)
  maxReintentos: 3               // 🔄 Reintentos por libro (hasta 3x)
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
   2. tarjeta → Título, párrafos (texto)
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
  "palabras": [4 emociones únicas, BAJAS Hawkins 20-75 (vergüenza, culpa, apatía, duelo, miedo), específicas al libro],
  "frases": [4 frases con estructuras RADICALMENTE diferentes, emoji único, 100-120 chars],
  "colores": [4 hex únicos, mezcla cálido/frío, valores RGB inusuales, dopaminérgicos],
  "fondo": "#hex oscuro"
}

REGLAS CRÍTICAS:
✅ Cada palabra: EMOCIONES DENSAS del fondo del mapa (vergüenza 20, culpa 30, apatía 50, duelo 75, miedo 100), súper específica al libro
✅ Cada frase: estructura ÚNICA, emoji ÚNICO, acción CONCRETA con contexto
✅ Cada color: imposible confundir con paletas anteriores

MAPA HAWKINS BAJO (USA ESTE RANGO):
20  → Vergüenza (humillación, deshonra, autorechazo)
30  → Culpa (remordimiento, autoacusación, arrepentimiento)
50  → Apatía (desesperanza, indiferencia, desconexión)
75  → Duelo (pesar, melancolía, pérdida)

SOLO JSON.`,

    /* ─────────────────────────────────────────────────────────
       PROMPT 2: TARJETA
       
       Genera: título, parrafoTop, subtitulo, parrafoBot
       
       🎯 CRITICAL: Longitud exacta para evitar desborde en móvil
       🔗 JOURNEY: Coherencia total con palabras/frases anteriores
    ───────────────────────────────────────────────────────── */
    tarjeta: base + `
${extra ? `
CONTEXTO EMOCIONAL PREVIO GENERADO:
Palabras: ${extra.palabras.join(", ")}
Frases: ${extra.frases.map((f, i) => `${i + 1}. ${f}`).join(" ")}

El contenido editorial debe CONTINUAR este journey emocional.
` : ""}

Escribe contenido editorial específico al libro:

TÍTULO (30-45 chars): Concepto único del libro, directo, sin frases genéricas
PÁRRAFO 1 (80-120 chars): Insight del libro en 1ra persona, específico, sin metadata
SUBTÍTULO (25-40 chars): Frase que conecta emocionalmente, NO genérica
PÁRRAFO 2 (70-110 chars): Acción concreta 15-30seg que eleva desde emociones previas

REGLAS CRÍTICAS:
❌ NO uses: corchetes [], "Bisagra provocadora", "Reflexión activa", metadata, @@tags
❌ NO excedas límites: P1 max 120 chars, P2 max 110 chars
✅ Contenido DIRECTO sin adornos ni corchetes
✅ Journey continuo: de palabras bajas → frases acción → insight → transformación

FORMATO (4 líneas sin tags):
[Título del concepto]
[Insight en 1ra persona del autor]
[Subtítulo provocador específico]
[Acción concreta breve]

EJEMPLO:
El arte de no hacer nada
Descubrí que el Niksen transforma mi relación con el estrés y la productividad diaria.
¿Qué pasaría si parar fuera avanzar?
Dedica 5 minutos hoy a sentarte sin hacer nada y observa tus pensamientos sin juzgar.`,

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
   7. Genera tarjeta de contenido
   8. Genera tarjeta de estilo visual DARK MODE
   9. Retorna objeto completo
   
   PROTECCIONES:
   - Logging detallado en cada paso
   - Reintento automático si respuesta incompleta
   - Reintento automático si palabras repetidas
   - Error si arrays vacíos → Fallback completo
   - Loop con reintentos configurables (3x)
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
      // PASO 7: TARJETA CONTENIDO (CON VALIDACIÓN DE LONGITUD)
      // ─────────────────────────────────────────────────────────
      console.log(`   🔧 Paso 7: Generando tarjeta de contenido...`);
      const pT = prompt(libro, "tarjeta", c, extra);
      let rawT = await call(openai, pT, "Genera tarjeta");
      rawT = rawT.replace(/@@BODY|@@ENDBODY/g, "").trim();
      const lineas = rawT.split(/\n+/).filter(Boolean).map(l => {
        // Limpiar corchetes, metadata y frases genéricas
        return l
          .replace(/^\[|\]$/g, "")  // Eliminar corchetes al inicio/fin
          .replace(/\[Título\]|\[Párrafo.*?\]|\[Subtítulo\]|\[Acción.*?\]/gi, "")  // Eliminar metadata
          .replace(/^(Concepto único del libro|Insight específico|Bisagra provocadora|Acción específica)[:.\s]*/gi, "")  // Eliminar labels
          .trim();
      }).filter(l => l.length > 0);  // Eliminar líneas vacías
      
      extra.tarjeta = {
        titulo: (lineas[0] || "").substring(0, 45),  // Max 45 chars
        parrafoTop: (lineas[1] || "").substring(0, 120),  // Max 120 chars
        subtitulo: (lineas[2] || "").substring(0, 40),  // Max 40 chars
        parrafoBot: (lineas.slice(3).join(" ") || "").substring(0, 110),  // Max 110 chars
        style: {}
      };
      
      // Log si hubo truncado
      if (lineas[1] && lineas[1].length > 120) console.warn(`   ⚠️  P1 truncado: ${lineas[1].length} → 120 chars`);
      if (lineas.slice(3).join(" ").length > 110) console.warn(`   ⚠️  P2 truncado: ${lineas.slice(3).join(" ").length} → 110 chars`);

      // ─────────────────────────────────────────────────────────
      // PASO 8: TARJETA ESTILO (CON FORZADO DARK MODE)
      // ─────────────────────────────────────────────────────────
      console.log(`   🔧 Paso 8: Generando tarjeta de estilo...`);
      const pE = prompt(libro, "estilo", c);
      let rawE = await call(openai, pE, "Genera estilo");
      rawE = rawE.replace(/@@STYLE|@@ENDSTYLE/g, "").trim();
      
      let styleParsed = false;
      let styleAttempts = 0;
      
      while (!styleParsed && styleAttempts < 2) {
        try {
          extra.tarjeta.style = JSON.parse(utils.clean(rawE));
          styleParsed = true;
          
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
          styleAttempts++;
          if (styleAttempts < 2) {
            console.warn(`   ⚠️  Style parse error, reintentando... (${styleAttempts}/2)`);
            rawE = await call(openai, pE, "Genera SOLO JSON válido");
            rawE = rawE.replace(/@@STYLE|@@ENDSTYLE/g, "").trim();
          } else {
            console.warn(`   ⚠️  Style error final: ${e.message}, usando fallback`);
            // Fallback dark mode
            extra.tarjeta.style = {
              accent: "#ff6b6b",
              ink: "#f0f0f0",
              paper: "#1a1a1a",
              border: "#333333"
            };
            styleParsed = true;
          }
        }
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
  // FALLBACK COMPLETO (DARK MODE)
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
      parrafoTop: "La acción más importante es la que puedes hacer ahora mismo, sin esperar el momento perfecto.",
      subtitulo: "Un paso basta para avanzar",
      parrafoBot: "Identifica una acción de 15 segundos que te acerque a tu objetivo y hazla ahora.",
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
console.log("║   TRIGGUI v7.4 GOD MODE - ANTI-FALLBACK MAX  ║");
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
console.log("🔥 Sistema v7.4 GOD MODE ejecutado con éxito\n");

/* ═══════════════════════════════════════════════════════════════
   📖 GUÍA DE USO RÁPIDO
   
   EJECUCIÓN BÁSICA:
   node build-contenido.js
   
   ══════════════════════════════════════════════════════════════
   
   AJUSTES COMUNES (LÍNEAS DE REFERENCIA):
   
   Más creatividad:
   → Línea 50: temp: 1.3
   
   Más estabilidad:
   → Línea 50: temp: 0.9
   
   Más delay (si hay fallbacks):
   → Línea 57: delay: 5000
   
   Más reintentos:
   → Línea 58: maxReintentos: 5
   
   Más libros:
   → Línea 56: max: 20
   
   Modelo más robusto:
   → Línea 49: model: "gpt-4o"
   
   Palabras menos profundas:
   → Línea 225: "Hawkins 50-150"
   
   Frases más cortas:
   → Línea 226: "80-100 chars"
   
   ══════════════════════════════════════════════════════════════
   
   MÉTRICAS DE CALIDAD:
   
   BUENO:
   - 0-2 palabras repetidas en 20 libros
   - 0-1 fallbacks
   - Dark mode en 95% de tarjetas
   
   EXCELENTE:
   - 0 palabras repetidas
   - 0 fallbacks
   - Dark mode al 100%
   - Paletas imposibles de confundir
   
   GOD MODE:
   - Cada palabra específica al libro
   - Cada frase única en estructura
   - Cada paleta memorable
   - 0 fallbacks en 100 libros
   - Dark mode perfecto siempre
   
   ══════════════════════════════════════════════════════════════
   
   TROUBLESHOOTING:
   
   Si hay fallbacks:
   1. Revisa logs: busca "❌ Intento"
   2. Aumenta delay a 5000ms
   3. Baja temp a 0.9
   4. Prueba gpt-4o
   5. Aumenta reintentos a 5
   
   Si palabras repetidas:
   1. Aumenta presence a 0.8
   2. Aumenta frequency a 0.5
   
   Si frases muy similares:
   1. Revisa prompt main (línea 220)
   2. Enfatiza "estructuras RADICALMENTE diferentes"
   
   Si tarjetas no dark mode:
   1. El código ya fuerza dark mode automáticamente
   2. Verifica logs: "⚠️  Fondo claro detectado"
   3. Si persiste, reporta bug
   
   ══════════════════════════════════════════════════════════════
   
   LOGS DETALLADOS INCLUIDOS:
   
   Ahora verás en cada libro:
   - 🔧 Paso X: [acción]
   - ✅ [éxito]
   - ⚠️  [advertencia]
   - ❌ [error con stack trace]
   - 🔄 [reintento]
   - 🛡️  [fallback]
   
   Esto permite diagnosticar exactamente dónde falla.
   
   ══════════════════════════════════════════════════════════════
   
   🔥 NIVEL DIOS MÁXIMO ACTIVADO
   
═══════════════════════════════════════════════════════════════ */
