/* ═══════════════════════════════════════════════════════════════════════════════
   TRIGGUI v8.2 ULTRA PERFECTION - CÓDIGO DEFINITIVO PRODUCCIÓN
   
   AUTOR: Badir Nakid | FECHA: Nov 2025 | VERSIÓN: 8.2 ULTRA PERFECTION
═══════════════════════════════════════════════════════════════════════════════ */

import fs from "node:fs/promises";
import { parse } from "csv-parse/sync";
import OpenAI from "openai";

const KEY = process.env.OPENAI_KEY;
if (!KEY) process.exit(console.log("🔕 Sin OPENAI_KEY"));

/* ═══════════════════════════════════════════════════════════════
   ⚙️  CONFIGURACIÓN MAESTRA - TODO PARAMETRIZABLE
═══════════════════════════════════════════════════════════════ */

const CFG = {
  // ─── API ───
  model: "gpt-4o-mini",
  temp: 1,              // Base (se ajusta dinámicamente según día)
  top_p: 0.9,
  presence: 0.7,
  frequency: 0.4,
  
  // ─── Archivos ───
  csv: "data/libros_master.csv",
  out: "contenido.json",
  
  // ─── Procesamiento ───
  max: 20,              // Libros por ejecución
  delay: 10000,         // Ms entre libros
  maxReintentos: 20,    // Reintentos por libro
  sleepReintento: 2000, // Ms entre reintentos
  resetMemoryCada: 5,   // Reset cada N libros
  
  // ─── Contenido (DINÁMICO según hora/día) ───
  hawkins: {
    base: [20, 100],    // Rango base [min, max]
    madrugada: [20, 75],   // 0-6h: Emociones más profundas
    manana: [50, 150],     // 6-12h: Más elevadas
    tarde: [30, 120],      // 12-18h: Mixto
    noche: [20, 100]       // 18-24h: Vuelta a profundo
  },
  
  frases: {
    cantidad: 4,
    longitudMin: 100,
    longitudMax: 120
  },
  
  palabras: {
    cantidad: 4
  },
  
  colores: {
    cantidad: 4
  },
  
  tarjeta: {
    accionMin: 15,     // Segundos mínimos de acción
    accionMax: 60,     // Segundos máximos de acción
    lineasMin: 4,      // Líneas mínimas esperadas
    longitudMinLinea: 10,  // Chars mínimos por línea válida
    // ─── Límites GUÍA (no truncan, solo orientan a la IA) ───
    tituloGuia: 45,      // Guía para IA (flujo natural)
    parrafo1Guia: 120,   // Guía para IA (flujo natural)
    subtituloGuia: 60,   // Guía para IA (flujo natural)
    parrafo2Guia: 150    // Guía para IA (flujo natural, contexto rico)
  },
  
  // ─── Dark Mode ───
  darkMode: {
    paperMin: "#0a0a0a",
    paperMax: "#2a2a2a",
    inkMin: "#e0e0e0",
    inkMax: "#ffffff",
    lumThresholdPaper: 0.3,   // Max luminancia para fondo
    lumThresholdInk: 0.7      // Min luminancia para texto
  },
  
  // ─── Cronobiología (energía por día) ───
  energia: {
    lunes: 0.8,
    martes: 0.4,
    miércoles: 0.6,
    jueves: 1.2,
    viernes: 0.9,
    sábado: 0.8,
    domingo: 0.8
  },
  
  // ─── Ajustes dinámicos según energía ───
  dinamico: {
    tempMultiplicador: true,     // temp *= energia
    hawkinsShift: true,           // Ajusta rango según hora
    frasesExtension: true         // Más largas en alta energía
  }
};

/* ═══════════════════════════════════════════════════════════════
   🛠️  UTILIDADES
═══════════════════════════════════════════════════════════════ */

const utils = {
  lum: h => {
    const [r, g, b] = h.slice(1).match(/../g).map(x => parseInt(x, 16) / 255);
    const f = v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  },
  
  txt: h => utils.lum(h) > 0.35 ? "#000000" : "#FFFFFF",
  
  shuffle: arr => {
    let m = arr.length, i;
    while (m) [arr[m], arr[i]] = [arr[i = Math.floor(Math.random() * m--)], arr[m]];
    return arr;
  },
  
  clean: raw => raw.trim()
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .replace(/^[^{[]*/, "")
    .replace(/[^}\]]*$/, "")
};

const state = { palabras: new Set(), colores: new Set() };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/* ═══════════════════════════════════════════════════════════════
   🕐 CONTEXTO DINÁMICO (día/hora/energía)
═══════════════════════════════════════════════════════════════ */

function getContexto() {
  const now = new Date();
  const dia = now.toLocaleDateString("es-MX", { weekday: "long" }).toLowerCase();
  const hora = now.getHours();
  
  // Energía del día
  const energia = CFG.energia[dia] || 0.8;
  
  // Franja horaria para Hawkins dinámico
  let franja = "noche";
  if (hora >= 0 && hora < 6) franja = "madrugada";
  else if (hora >= 6 && hora < 12) franja = "manana";
  else if (hora >= 12 && hora < 18) franja = "tarde";
  
  // Temperatura dinámica según energía
  const tempDinamica = CFG.dinamico.tempMultiplicador 
    ? CFG.temp * energia 
    : CFG.temp;
  
  // Rango Hawkins dinámico según hora
  const hawkinsDinamico = CFG.dinamico.hawkinsShift
    ? CFG.hawkins[franja]
    : CFG.hawkins.base;
  
  // Longitud frases dinámica según energía
  const frasesLongitud = CFG.dinamico.frasesExtension
    ? {
        min: Math.round(CFG.frases.longitudMin * energia),
        max: Math.round(CFG.frases.longitudMax * energia)
      }
    : {
        min: CFG.frases.longitudMin,
        max: CFG.frases.longitudMax
      };
  
  return {
    dia,
    hora,
    franja,
    energia,
    tempDinamica,
    hawkinsDinamico,
    frasesLongitud
  };
}

/* ═══════════════════════════════════════════════════════════════
   🧙‍♂️ PROMPTS (con contexto dinámico)
═══════════════════════════════════════════════════════════════ */

function prompt(libro, tipo, ctx, extra = null) {
  const prohibidas = [...state.palabras].join(", ");
  const prohibidosC = [...state.colores].join(", ");
  
  const base = `
Eres Triggui. Experto absoluto en:
- Mapa Hawkins de consciencia
- Psicología del comportamiento
- Diseño editorial

LIBRO: "${libro.titulo}" - ${libro.autor}
${libro.tagline ? `TAGLINE: "${libro.tagline}"` : ""}

CONTEXTO: ${ctx.dia} ${ctx.hora}h | Energía ${Math.round(ctx.energia * 100)}%

${prohibidas ? `🚫 PALABRAS PROHIBIDAS: ${prohibidas}` : ""}
${prohibidosC ? `🎨 COLORES PROHIBIDOS: ${prohibidosC}` : ""}
`;

  const prompts = {
    main: base + `
GENERA JSON:

{
  "dimension": "Bienestar|Prosperidad|Conexión",
  "punto": "Cero|Creativo|Activo|Máximo",
  "palabras": [${CFG.palabras.cantidad} emociones Hawkins ${ctx.hawkinsDinamico[0]}-${ctx.hawkinsDinamico[1]}, específicas al libro],
  "frases": [${CFG.frases.cantidad} frases únicas, emoji, ${ctx.frasesLongitud.min}-${ctx.frasesLongitud.max} chars],
  "colores": [${CFG.colores.cantidad} hex únicos, dopaminérgicos],
  "fondo": "#hex oscuro"
}

CRÍTICO:
✅ Palabras: emociones densas Hawkins ${ctx.hawkinsDinamico[0]}-${ctx.hawkinsDinamico[1]}
✅ Frases: estructura única, emoji único, contexto + acción
✅ Colores: imposibles de confundir con anteriores

SOLO JSON.`,

    tarjeta: base + `
${extra ? `
════════════════════════════════════════════════════════════════
JOURNEY PREVIO (continúa este viaje emocional):

PALABRAS: ${extra.palabras.join(", ")}
FRASES:
${extra.frases.map((f, i) => `${i + 1}. ${f}`).join("\n")}

Tu tarjeta DEBE continuar orgánicamente este journey.
════════════════════════════════════════════════════════════════
` : ""}

Escribe 4 líneas (FLUJO NATURAL, las guías son aproximadas):

TÍTULO (~${CFG.tarjeta.tituloGuia} chars): Concepto específico del libro
PÁRRAFO 1 (~${CFG.tarjeta.parrafo1Guia} chars): Insight en 1ra persona que CONECTA con emociones previas
SUBTÍTULO (~${CFG.tarjeta.subtituloGuia} chars): Pregunta/frase que ELEVA desde emociones bajas
PÁRRAFO 2 (~${CFG.tarjeta.parrafo2Guia} chars): Acción ${CFG.tarjeta.accionMin}-${CFG.tarjeta.accionMax}seg con contexto RICO que CONSTRUYE sobre frases

REGLAS:
✅ CONECTAR con emociones previas (indirectamente)
✅ ELEVAR desde bajo → transformación
✅ CONSTRUIR sobre acciones previas
✅ FLUJO NATURAL: deja que el contenido respire, no te limites estrictamente
❌ NO: corchetes [], metadata, labels (TÍTULO:, PÁRRAFO:, SUBTÍTULO:), markdown (**, _, *)

FORMATO (4 líneas sin labels):
[línea 1: título]
[línea 2: párrafo 1]
[línea 3: subtítulo]
[línea 4: párrafo 2]`,

    estilo: base + `
Diseña style JSON DARK MODE:

{
  "accent": "hex vibrante",
  "ink": "${CFG.darkMode.inkMin} - ${CFG.darkMode.inkMax}",
  "paper": "${CFG.darkMode.paperMin} - ${CFG.darkMode.paperMax}",
  "border": "hex sutil oscuro"
}

CRÍTICO dark mode:
✅ paper OSCURO (${CFG.darkMode.paperMin} - ${CFG.darkMode.paperMax})
✅ ink CLARO (${CFG.darkMode.inkMin} - ${CFG.darkMode.inkMax})

SOLO JSON.`
  };
  
  return prompts[tipo];
}

/* ═══════════════════════════════════════════════════════════════
   📞 API CALL
═══════════════════════════════════════════════════════════════ */

async function call(openai, sys, usr, temp, forceJSON = false) {
  const config = {
    model: CFG.model,
    temperature: temp,
    top_p: CFG.top_p,
    presence_penalty: CFG.presence,
    frequency_penalty: CFG.frequency,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: usr }
    ]
  };
  
  if (forceJSON) config.response_format = { type: "json_object" };
  
  const chat = await openai.chat.completions.create(config);
  return chat.choices[0].message.content;
}

/* ═══════════════════════════════════════════════════════════════
   ⚡ ENRIQUECIMIENTO (Pipeline completo)
═══════════════════════════════════════════════════════════════ */

async function enrich(libro, openai, ctx) {
  let intento = 0;
  
  while (intento <= CFG.maxReintentos) {
    try {
      // PASO 1: JSON principal
      console.log(`   [1/3] JSON principal...`);
      const p = prompt(libro, "main", ctx);
      let raw = await call(openai, p, "Genera JSON", ctx.tempDinamica, true);
      let extra = JSON.parse(raw);
      
      // Validar respuesta completa
      if (!extra.frases || !extra.colores || !extra.palabras ||
          extra.frases.length === 0 || extra.colores.length === 0 || extra.palabras.length === 0) {
        throw new Error("Respuesta incompleta");
      }
      
      // Validar anti-repetición
      const repetidas = extra.palabras?.filter(p => state.palabras.has(p.toLowerCase())) || [];
      if (repetidas.length > 0) {
        console.log(`   ⚠️  Repetidas: ${repetidas.join(", ")}, regenerando...`);
        raw = await call(openai, prompt(libro, "main", ctx), "Palabras únicas", ctx.tempDinamica, true);
        extra = JSON.parse(raw);
      }
      
      // Registrar usados
      extra.palabras?.forEach(p => state.palabras.add(p.toLowerCase()));
      extra.colores?.forEach(c => state.colores.add(c));
      
      // Garantizar longitud
      ["palabras", "frases", "colores"].forEach(k => {
        if (!extra[k] || extra[k].length === 0) throw new Error(`Array vacío: ${k}`);
        while (extra[k].length < CFG[k].cantidad) extra[k].push(extra[k][extra[k].length - 1]);
      });
      
      extra.textColors = extra.colores.map(utils.txt);
      
      // PASO 2: Tarjeta contenido
      console.log(`   [2/3] Tarjeta (journey continuo)...`);
      const pT = prompt(libro, "tarjeta", ctx, extra);
      let rawT = await call(openai, pT, "Genera tarjeta", ctx.tempDinamica);
      rawT = rawT.replace(/@@BODY|@@ENDBODY/g, "").trim();
      
      // Limpieza PERFECTA de metadata y markdown
      const lineas = rawT.split(/\n+/).filter(Boolean).map(l => {
        return l
          .replace(/^\[|\]$/g, "")  // Corchetes
          .replace(/\[Título\]|\[Párrafo.*?\]|\[Subtítulo\]|\[Acción.*?\]|\[línea.*?\]/gi, "")  // Metadata tags
          .replace(/^(TÍTULO|PÁRRAFO\s*\d*|SUBTÍTULO|ACCIÓN)[:.\s]*/gi, "")  // Labels mayúsculas
          .replace(/^(Concepto único|Insight específico|Bisagra provocadora|Reflexión activa|Pregunta provocadora)[:.\s]*/gi, "")  // Labels genéricos
          .replace(/^\*{1,3}|\*{1,3}$/g, "")  // Markdown * ** ***
          .replace(/^_{1,3}|_{1,3}$/g, "")     // Markdown _ __ ___
          .trim();
      }).filter(l => l.length > CFG.tarjeta.longitudMinLinea);
      
      // ⭐ FLUJO NATURAL: Sin truncado, sin límites
      extra.tarjeta = {
        titulo: lineas[0] || "",
        parrafoTop: lineas[1] || "",
        subtitulo: lineas[2] || "",
        parrafoBot: lineas.slice(3).join(" "),  // Todo el contexto
        style: {}
      };
      
      // PASO 3: Tarjeta estilo
      console.log(`   [3/3] Style dark mode...`);
      const pE = prompt(libro, "estilo", ctx);
      let rawE = await call(openai, pE, "Genera estilo", ctx.tempDinamica);
      rawE = rawE.replace(/@@STYLE|@@ENDSTYLE/g, "").trim();
      
      try {
        extra.tarjeta.style = JSON.parse(utils.clean(rawE));
        
        // Forzar dark mode si necesario
        if (extra.tarjeta.style.paper && utils.lum(extra.tarjeta.style.paper) > CFG.darkMode.lumThresholdPaper) {
          extra.tarjeta.style.paper = CFG.darkMode.paperMin;
        }
        if (extra.tarjeta.style.ink && utils.lum(extra.tarjeta.style.ink) < CFG.darkMode.lumThresholdInk) {
          extra.tarjeta.style.ink = CFG.darkMode.inkMax;
        }
      } catch (e) {
        extra.tarjeta.style = {
          accent: "#ff6b6b",
          ink: CFG.darkMode.inkMax,
          paper: CFG.darkMode.paperMin,
          border: "#333333"
        };
      }
      
      console.log(`   ✅ Completado`);
      return {
        ...libro,
        ...extra,
        portada: libro.portada?.trim() || `📚 ${libro.titulo}\n${libro.autor}`,
        videoUrl: `https://duckduckgo.com/?q=!ducky+site:youtube.com+${encodeURIComponent(`${libro.titulo} ${libro.autor} entrevista español`)}`
      };
      
    } catch (e) {
      intento++;
      console.log(`   ❌ Error (${intento}/${CFG.maxReintentos + 1}): ${e.message}`);
      
      if (intento <= CFG.maxReintentos) {
        await sleep(CFG.sleepReintento);
        continue;
      }
      
      console.log(`   🛡️  Fallback activado`);
      break;
    }
  }
  
  // Fallback
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
        ink: CFG.darkMode.inkMax,
        paper: CFG.darkMode.paperMin,
        border: "#333333"
      }
    },
    videoUrl: `https://duckduckgo.com/?q=!ducky+site:youtube.com+${encodeURIComponent(libro.titulo)}`
  };
}

/* ═══════════════════════════════════════════════════════════════
   🚀 MAIN
═══════════════════════════════════════════════════════════════ */

const openai = new OpenAI({ apiKey: KEY });
const ctx = getContexto();

console.log("╔═══════════════════════════════════════════════╗");
console.log("║   TRIGGUI v8.2 ULTRA PERFECTION - DEFINITIVO ║");
console.log("╚═══════════════════════════════════════════════╝\n");
console.log(`📅 ${new Date().toLocaleDateString("es-MX", { dateStyle: "full" })}`);
console.log(`⏰ ${new Date().toLocaleTimeString("es-MX")}`);
console.log(`🤖 ${CFG.model} | 🌡️  ${ctx.tempDinamica.toFixed(2)} (${ctx.dia})`);
console.log(`📊 Energía: ${Math.round(ctx.energia * 100)}% | Hawkins: ${ctx.hawkinsDinamico[0]}-${ctx.hawkinsDinamico[1]}`);
console.log(`⏱️  Delay: ${CFG.delay}ms | Reintentos: ${CFG.maxReintentos}\n`);

const csv = await fs.readFile(CFG.csv, "utf8");
const lista = parse(csv, { columns: true, skip_empty_lines: true });
const pick = utils.shuffle([...lista]).slice(0, Math.min(CFG.max, lista.length));

const libros = [];
let i = 0;

for (const libro of pick) {
  i++;
  console.log(`📖 [${i}/${pick.length}] ${libro.titulo}`);
  libros.push(await enrich(libro, openai, ctx));
  
  if (i % CFG.resetMemoryCada === 0 && i < pick.length) {
    console.log(`   🔄 Reset memoria (${state.palabras.size}p, ${state.colores.size}c)`);
    state.palabras.clear();
    state.colores.clear();
  }
  
  if (i < pick.length) await sleep(CFG.delay);
}

await fs.writeFile(CFG.out, JSON.stringify({ libros }, null, 2));

console.log("\n╔═══════════════════════════════════════════════╗");
console.log("║            GENERACIÓN COMPLETA                ║");
console.log("╚═══════════════════════════════════════════════╝\n");
console.log(`✅ ${CFG.out}`);
console.log(`📚 ${libros.length} libros | ${state.palabras.size}p ${state.colores.size}c\n`);

/* ═══════════════════════════════════════════════════════════════
   📖 GUÍA RÁPIDA v8.2 ULTRA PERFECTION
   
   CAMBIOS v8.2:
   ✅ FLUJO NATURAL 100%: Sin truncado, contenido respira
   ✅ Límites como GUÍA: Orientan a IA, no cortan
   ✅ Limpieza PERFECTA: TÍTULO:, PÁRRAFO:, SUBTÍTULO:, markdown
   ✅ Contexto rico en P2: Todo el desarrollo necesario
   
   PARÁMETROS CLAVE (Línea 17-97):
   - CFG.temp: Creatividad base (se multiplica por energía día)
   - CFG.hawkins: Rangos por franja horaria (dinámico)
   - CFG.energia: Por día semana (afecta temp y frases)
   - CFG.tarjeta: Guías de longitud (NO truncan) ⭐
   - CFG.dinamico: Activa/desactiva ajustes automáticos
   
   AJUSTAR GUÍAS:
   1. Título más corto: CFG.tarjeta.tituloGuia = 35
   2. P2 más largo: CFG.tarjeta.parrafo2Guia = 200
   3. Subtítulo más corto: CFG.tarjeta.subtituloGuia = 50
   
   FILOSOFÍA v8.2:
   - IA genera naturalmente
   - Guías orientan, no limitan
   - Contenido fluye sin restricciones artificiales
   - Calidad > Rigidez
   
   🔥 MÁXIMA PERFECCIÓN ALCANZADA
   
═══════════════════════════════════════════════════════════════ */
