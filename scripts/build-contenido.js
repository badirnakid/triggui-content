/* ═══════════════════════════════════════════════════════════════
   TRIGGUI v7.0 DIOS - CÓDIGO MINIMALISTA PERFECTO
   
   Filosofía: Menos líneas, máxima claridad, cero redundancia
   Arquitectura: Prompts supremos + Lógica esencial
   
   Badir Nakid | Nov 2025
═══════════════════════════════════════════════════════════════ */

import fs from "node:fs/promises";
import { parse } from "csv-parse/sync";
import OpenAI from "openai";
import crypto from "node:crypto";

/* ═══════════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════════ */

const KEY = process.env.OPENAI_KEY;
if (!KEY) process.exit(console.log("🔕 Sin OPENAI_KEY"));

const CFG = {
  model: "gpt-4o-mini",
  temp: 1.3,
  top_p: 0.95,
  presence: 0.7,
  frequency: 0.4,
  csv: "data/libros_master.csv",
  out: "contenido.json",
  max: 5
};

/* ═══════════════════════════════════════════════════════════════
   UTILS
═══════════════════════════════════════════════════════════════ */

const lum = h => {
  const [r, g, b] = h.slice(1).match(/../g).map(x => parseInt(x, 16) / 255);
  const f = v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const txt = h => lum(h) > 0.35 ? "#000000" : "#FFFFFF";

const shuffle = arr => {
  let m = arr.length, i;
  while (m) [arr[m], arr[i]] = [arr[i = Math.floor(Math.random() * m--)], arr[m]];
  return arr;
};

const cleanJSON = raw => raw.trim()
  .replace(/```json\s*/g, "")
  .replace(/```\s*/g, "")
  .replace(/^[^{[]*/, "")
  .replace(/[^}\]]*$/, "");

const used = { palabras: new Set(), colores: new Set() };

/* ═══════════════════════════════════════════════════════════════
   CRONOBIOLOGÍA
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
   PROMPTS NIVEL DIOS
═══════════════════════════════════════════════════════════════ */

function prompt(libro, tipo, c) {
  const seed = crypto.randomUUID();
  const prohibidas = [...used.palabras].join(", ");
  const prohibidosC = [...used.colores].join(", ");

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
    // PROMPT PRINCIPAL
    main: base + `
GENERA JSON PURO (sin markdown):

{
  "dimension": "Bienestar|Prosperidad|Conexión",
  "punto": "Cero|Creativo|Activo|Máximo",
  "palabras": [4 emociones únicas, bajas Hawkins 20-200, específicas al libro],
  "frases": [4 frases con estructuras RADICALMENTE diferentes, emoji único, 60-80 chars],
  "colores": [4 hex únicos, mezcla cálido/frío, valores RGB inusuales],
  "fondo": "#hex oscuro"
}

REGLAS CRÍTICAS:
✅ Cada palabra: específica al libro, poco común, emoción respuesta a la pregunta ¿qué sientes o qué buscas ahora?
✅ Cada frase: estructura ÚNICA, emoji ÚNICO, acción CONCRETA del libro
✅ Cada color: imposible confundir con paletas anteriores

SOLO JSON. Adelante.`,

    // PROMPT TARJETA
    tarjeta: base + `
Escribe contenido editorial:

TÍTULO (≤50 chars): Concepto único del libro
PÁRRAFO 1 (≤130 chars): Insight específico del libro + autor en 1ra persona
SUBTÍTULO (≤48 chars): Bisagra provocadora
PÁRRAFO 2 (≤130 chars): Acción específica derivada del libro (15-60 seg)

TONO BADIR: Sobrio, directo, humano, sin adornos, utilidad inmediata

Devuelve SOLO entre @@BODY y @@ENDBODY:
@@BODY
[Título]
[Párrafo 1]
[Subtítulo]
[Párrafo 2]
@@ENDBODY`,

    // PROMPT ESTILO
    estilo: base + `
Diseña tarjeta legible imposible de confundir:

JSON con 15-28 claves:
- Conocidas: accent, ink, paper, border, serif, sans, mono, display
- Inventadas (8-15): glowFlux, metaShadow, warpGrid, prismPulse, etc
- surprise: string describiendo recurso más inesperado

Mezcla: Clásico + Experimental + Rigor + Dopamina

SOLO JSON entre @@STYLE y @@ENDSTYLE`
  };

  return prompts[tipo];
}

/* ═══════════════════════════════════════════════════════════════
   LLAMADA API
═══════════════════════════════════════════════════════════════ */

async function call(openai, sys, usr) {
  const chat = await openai.chat.completions.create({
    model: CFG.model,
    temperature: CFG.temp,
    top_p: CFG.top_p,
    presence_penalty: CFG.presence,
    frequency_penalty: CFG.frequency,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: usr }
    ]
  });
  return chat.choices[0].message.content;
}

/* ═══════════════════════════════════════════════════════════════
   ENRIQUECIMIENTO
═══════════════════════════════════════════════════════════════ */

async function enrich(libro, openai, c) {
  try {
    // 1. GENERACIÓN PRINCIPAL
    const p = prompt(libro, "main", c);
    let raw = await call(openai, p, "Genera JSON ahora");
    let extra = JSON.parse(cleanJSON(raw));

    // 2. VALIDACIÓN ANTI-REPETICIÓN
    const repetidas = extra.palabras?.filter(p => used.palabras.has(p.toLowerCase())) || [];
    
    if (repetidas.length > 0) {
      console.warn(`   ⚠️  Repetidas: ${repetidas.join(", ")}`);
      const pVal = `Genera 4 palabras únicas. PROHIBIDAS: ${[...used.palabras].join(", ")}. SOLO JSON.`;
      raw = await call(openai, prompt(libro, "main", c), pVal);
      extra = JSON.parse(cleanJSON(raw));
    }

    // 3. REGISTRAR USADOS
    extra.palabras?.forEach(p => used.palabras.add(p.toLowerCase()));
    extra.colores?.forEach(c => used.colores.add(c));

    // 4. GARANTIZAR LONGITUD
    ["palabras", "frases", "colores"].forEach(k => {
      if (!extra[k]) extra[k] = [];
      while (extra[k].length < 4) extra[k].push(extra[k][extra[k].length - 1] || "default");
    });

    extra.textColors = extra.colores.map(txt);

    // 5. TARJETA CONTENIDO
    const pT = prompt(libro, "tarjeta", c);
    let rawT = await call(openai, pT, "Genera tarjeta");
    rawT = rawT.replace(/@@BODY|@@ENDBODY/g, "").trim();
    const lineas = rawT.split(/\n+/).filter(Boolean);
    
    extra.tarjeta = {
      titulo: lineas[0] || "",
      parrafoTop: lineas[1] || "",
      subtitulo: lineas[2] || "",
      parrafoBot: lineas.slice(3).join(" "),
      style: {}
    };

    // 6. TARJETA ESTILO
    const pE = prompt(libro, "estilo", c);
    let rawE = await call(openai, pE, "Genera estilo");
    rawE = rawE.replace(/@@STYLE|@@ENDSTYLE/g, "").trim();
    
    try {
      extra.tarjeta.style = JSON.parse(cleanJSON(rawE));
    } catch (e) {
      console.warn(`   ⚠️  Style error: ${e.message}`);
    }

    // 7. RETURN
    return {
      ...libro,
      ...extra,
      portada: libro.portada?.trim() || `📚 ${libro.titulo}\n${libro.autor}`,
      videoUrl: `https://duckduckgo.com/?q=!ducky+site:youtube.com+${encodeURIComponent(`${libro.titulo} ${libro.autor} entrevista español`)}`
    };

  } catch (e) {
    console.error(`❌ "${libro.titulo}":`, e.message);
    
    // FALLBACK MÍNIMO
    return {
      ...libro,
      dimension: "Bienestar",
      punto: "Cero",
      palabras: ["Inquietud", "Cansancio", "Duda", "Resistencia"],
      frases: [
        "🚶 Camina 10 pasos lentos",
        "❤️ Nombra a quién ayudaste",
        "🧠 Anota 3 palabras clave",
        "✨ Abre en página random"
      ],
      colores: ["#ff8a8a", "#ffb56b", "#8cabff", "#d288ff"],
      textColors: ["#FFFFFF", "#000000", "#000000", "#FFFFFF"],
      fondo: "#111111",
      portada: libro.portada || `📚 ${libro.titulo}`,
      tarjeta: {
        titulo: "Empieza pequeño",
        parrafoTop: "La acción más importante es la más simple.",
        subtitulo: "Un paso basta",
        parrafoBot: "No necesitas claridad total para moverte.",
        style: {}
      },
      videoUrl: `https://duckduckgo.com/?q=!ducky+site:youtube.com+${encodeURIComponent(libro.titulo)}`
    };
  }
}

/* ═══════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════ */

const openai = new OpenAI({ apiKey: KEY });
const c = crono();

console.log("╔════════════════════════════════════════════╗");
console.log("║  TRIGGUI v7.0 DIOS - MINIMALISTA PERFECTO ║");
console.log("╚════════════════════════════════════════════╝\n");
console.log(`📅 ${new Date().toLocaleDateString("es-MX", { dateStyle: "full" })}`);
console.log(`⏰ ${new Date().toLocaleTimeString("es-MX")}`);
console.log(`🤖 ${CFG.model} | 🌡️  ${CFG.temp}\n`);

// CARGA Y SHUFFLE
const csv = await fs.readFile(CFG.csv, "utf8");
const lista = parse(csv, { columns: true, skip_empty_lines: true });
const pick = shuffle([...lista]).slice(0, Math.min(CFG.max, lista.length));

// PROCESAMIENTO
const libros = [];
let i = 0;

for (const libro of pick) {
  i++;
  console.log(`📖 [${i}/${pick.length}] ${libro.titulo}`);
  libros.push(await enrich(libro, openai, c));
  
  // RESET CADA 5
  if (i % 5 === 0) {
    console.log(`   📊 P:${used.palabras.size} C:${used.colores.size} | 🔄 Reset`);
    used.palabras.clear();
    used.colores.clear();
  }
}

// GUARDADO
await fs.writeFile(CFG.out, JSON.stringify({ libros }, null, 2));

console.log("\n╔════════════════════════════════════════════╗");
console.log("║           GENERACIÓN COMPLETA              ║");
console.log("╚════════════════════════════════════════════╝\n");
console.log(`✅ ${CFG.out}`);
console.log(`📚 ${libros.length} libros`);
console.log(`📊 ${used.palabras.size} palabras | ${used.colores.size} colores\n`);
console.log("🔥 Sistema v7.0 ejecutado\n");
