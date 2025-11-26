/* ═══════════════════════════════════════════════════════════════════════════════
   TRIGGUI v7.2 GOD MODE - CÓDIGO DEFINITIVO
   
   ¿QUÉ HACE?
   Genera contenido enriquecido para libros:
   - 4 palabras emocionales (Mapa Hawkins 20-200)
   - 4 frases de acción únicas (micro-protocolos)
   - Paleta cromática imposible de confundir
   - Tarjeta editorial (título, insights, call-to-action)
   - Diseño visual experimental
   
   INNOVACIONES v7.2:
   ✅ Validación doble anti-"default"
   ✅ Reintento automático si respuesta incompleta
   ✅ JSON nativo garantizado (response_format)
   ✅ Anti-repetición con memoria de sesión
   ✅ Fallback robusto
   ✅ Cronobiología silenciosa
   
   CÓMO ITERAR:
   1. Modifica prompts (línea 175-260)
   2. Ejecuta: node build-contenido-v7.2-GOD.js
   3. Revisa contenido.json
   4. Ajusta y repite
   
   Badir Nakid | Nov 2025
═══════════════════════════════════════════════════════════════════════════════ */

import fs from "node:fs/promises";
import { parse } from "csv-parse/sync";
import OpenAI from "openai";
import crypto from "node:crypto";

/* ═══════════════════════════════════════════════════════════════
   ⚙️  CONFIGURACIÓN GLOBAL
   
   Aquí ajustas TODO sin tocar código interno.
   
   PARÁMETROS CLAVE:
   - temp: Creatividad (0.7=coherente, 1.5=salvaje)
   - max: Cantidad de libros a procesar
   - presence/frequency: Anti-repetición de OpenAI
═══════════════════════════════════════════════════════════════ */

const KEY = process.env.OPENAI_KEY;
if (!KEY) process.exit(console.log("🔕 Sin OPENAI_KEY"));

const CFG = {
  model: "gpt-4o-mini",         // 🤖 Modelo
  temp: 1.3,                     // 🌡️  Creatividad (0.1-2.0)
  top_p: 0.95,                   // 🎲 Diversidad
  presence: 0.7,                 // 🚫 Penaliza repetir temas
  frequency: 0.4,                // 🔁 Penaliza repetir palabras
  csv: "data/libros_master.csv", // 📁 Input
  out: "contenido.json",         // 💾 Output
  max: 5                         // 📚 Cantidad a procesar
};

/* ═══════════════════════════════════════════════════════════════
   🛠️  UTILIDADES (NAMESPACE)
   
   Funciones helper organizadas en objeto único.
   Inspirado en arquitectura de Gemini.
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

  // 🔀 Mezcla array (Fisher-Yates)
  shuffle: arr => {
    let m = arr.length, i;
    while (m) [arr[m], arr[i]] = [arr[i = Math.floor(Math.random() * m--)], arr[m]];
    return arr;
  },

  // 🧹 Limpia markdown de respuestas
  clean: raw => raw.trim()
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .replace(/^[^{[]*/, "")
    .replace(/[^}\]]*$/, "")
};

// 📊 Estado de sesión (anti-repetición)
const state = { palabras: new Set(), colores: new Set() };

/* ═══════════════════════════════════════════════════════════════
   🕐 CRONOBIOLOGÍA
   
   Detecta día/hora para ajustar tono del contenido.
   
   MAPA SEMANAL:
   Lunes    → Arquitectura (80%)
   Martes   → Tensión Máxima (40%) ⚠️
   Miércoles→ Purga (60%)
   Jueves   → DÍA DIOS (120%) 🔥
   Viernes  → Cierre (90%)
   Sábado   → Descanso (80%)
   Domingo  → Reset (80%)
   
   USO: Se inyecta silenciosamente en prompts
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
   
   Aquí defines QUÉ le dices a la IA.
   
   3 TIPOS:
   1. main    → Palabras, frases, colores (JSON)
   2. tarjeta → Título, párrafos (texto)
   3. estilo  → Diseño visual (JSON)
   
   💡 CONSEJO: Los prompts son el 90% de la calidad.
   Itera aquí para mejorar resultados.
═══════════════════════════════════════════════════════════════ */

function prompt(libro, tipo, c) {
  const seed = crypto.randomUUID();
  const prohibidas = [...state.palabras].join(", ");
  const prohibidosC = [...state.colores].join(", ");

  // 📝 Contexto base (compartido)
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
       
       🎯 MODIFICAR AQUÍ PARA:
       - Ajustar longitud de frases
       - Cambiar rango Hawkins
       - Definir mejor tipo de colores
    ───────────────────────────────────────────────────────── */
    main: base + `
GENERA JSON PURO:

{
  "dimension": "Bienestar|Prosperidad|Conexión",
  "punto": "Cero|Creativo|Activo|Máximo",
  "palabras": [4 emociones únicas, BAJAS EN LA ESCALA! Hawkins 20-75, específicas al libro],
  "frases": [4 frases con estructuras RADICALMENTE diferentes, emoji único, 100-120 chars],
  "colores": [4 hex únicos, mezcla cálido/frío, valores RGB inusuales, dopaminérgicos],
  "fondo": "#hex oscuro"
}

REGLAS CRÍTICAS:
✅ Cada palabra: súper específica al libro, poco común, emoción sentida
✅ Cada frase: estructura ÚNICA, emoji ÚNICO, acción o aportación CONCRETA con contexto
✅ Cada color: imposible confundir con paletas anteriores, increíbles a la pupila

SOLO JSON.`,

    /* ─────────────────────────────────────────────────────────
       PROMPT 2: TARJETA
       
       Genera: título, parrafoTop, subtitulo, parrafoBot
       
       🎯 MODIFICAR AQUÍ PARA:
       - Ajustar límites de caracteres
       - Cambiar tono editorial
       - Definir mejor tipo de acción
    ───────────────────────────────────────────────────────── */
    tarjeta: base + `
Escribe contenido editorial:

TÍTULO (≤50 chars): Concepto único del libro
PÁRRAFO 1 (≤130 chars): Insight específico del libro + autor en 1ra persona
SUBTÍTULO (≤48 chars): Bisagra provocadora
PÁRRAFO 2 (≤130 chars): Acción o aportación con contexto específica derivada del libro (15-60 seg)

TONO: Sobrio, directo, humano, sin adornos, utilidad inmediata

Devuelve SOLO entre @@BODY y @@ENDBODY:
@@BODY
[Título]
[Párrafo 1]
[Subtítulo]
[Párrafo 2]
@@ENDBODY`,

    /* ─────────────────────────────────────────────────────────
       PROMPT 3: ESTILO
       
       Genera: JSON de diseño visual
       
       🎯 MODIFICAR AQUÍ PARA:
       - Cambiar cantidad de claves (15-28)
       - Definir mejor claves inventadas
       - Ajustar nivel de experimentación
    ───────────────────────────────────────────────────────── */
    estilo: base + `
Diseña tarjeta imposible de confundir:

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
   📞 LLAMADA API
   
   Función que habla con OpenAI.
   
   INNOVACIÓN CLAVE:
   response_format: { type: "json_object" }
   → Garantiza JSON válido SIEMPRE
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
   
   Toma un libro y genera TODO.
   
   FLUJO (8 PASOS):
   1. Genera JSON principal
   2. Valida respuesta completa → Reintenta si falta algo
   3. Valida anti-repetición → Reintenta si hay repetidas
   4. Registra usados
   5. Garantiza longitud (sin "default")
   6. Post-procesa colores de texto
   7. Genera tarjeta contenido
   8. Genera tarjeta estilo
   9. Retorna objeto completo
   
   🛡️ PROTECCIONES:
   - Reintento si respuesta incompleta
   - Reintento si palabras repetidas
   - Error si arrays vacíos → Fallback completo
   - Try-catch global → Fallback completo
═══════════════════════════════════════════════════════════════ */

async function enrich(libro, openai, c) {
  try {
    /* ─────────────────────────────────────────────────────────
       PASO 1: GENERACIÓN PRINCIPAL
    ───────────────────────────────────────────────────────── */
    const p = prompt(libro, "main", c);
    let raw = await call(openai, p, "Genera JSON ahora", true);
    let extra = JSON.parse(raw);

    /* ─────────────────────────────────────────────────────────
       PASO 2: VALIDACIÓN DE RESPUESTA COMPLETA
       
       Si OpenAI responde con campos vacíos → Reintentar
       Esto evita el problema "default"
    ───────────────────────────────────────────────────────── */
    const faltaCampos = !extra.frases || !extra.colores || !extra.palabras ||
                        extra.frases.length === 0 || extra.colores.length === 0 || extra.palabras.length === 0;
    
    if (faltaCampos) {
      console.warn(`   ⚠️  Respuesta incompleta, reintentando...`);
      raw = await call(openai, p, "Genera JSON completo ahora", true);
      extra = JSON.parse(raw);
    }

    /* ─────────────────────────────────────────────────────────
       PASO 3: VALIDACIÓN ANTI-REPETICIÓN
       
       Si hay palabras ya usadas → Reintentar con prohibidas
    ───────────────────────────────────────────────────────── */
    const repetidas = extra.palabras?.filter(p => state.palabras.has(p.toLowerCase())) || [];
    
    if (repetidas.length > 0) {
      console.warn(`   ⚠️  Repetidas: ${repetidas.join(", ")}`);
      const pVal = `Genera 4 palabras únicas. PROHIBIDAS: ${[...state.palabras].join(", ")}. SOLO JSON.`;
      raw = await call(openai, prompt(libro, "main", c), pVal, true);
      extra = JSON.parse(raw);
    }

    /* ─────────────────────────────────────────────────────────
       PASO 4: REGISTRAR USADOS
    ───────────────────────────────────────────────────────── */
    extra.palabras?.forEach(p => state.palabras.add(p.toLowerCase()));
    extra.colores?.forEach(c => state.colores.add(c));

    /* ─────────────────────────────────────────────────────────
       PASO 5: GARANTIZAR LONGITUD (SIN "default")
       
       Si array vacío → throw Error → Fallback completo
       Si array con <4 elementos → Duplicar último
    ───────────────────────────────────────────────────────── */
    ["palabras", "frases", "colores"].forEach(k => {
      if (!extra[k]) extra[k] = [];
      
      // Array vacío = error crítico → Fallback
      if (extra[k].length === 0) {
        throw new Error(`Array vacío: ${k}`);
      }
      
      // Completar hasta 4 duplicando último
      while (extra[k].length < 4) {
        extra[k].push(extra[k][extra[k].length - 1]);
      }
    });

    /* ─────────────────────────────────────────────────────────
       PASO 6: POST-PROCESAMIENTO
       
       Calcula colores de texto automáticamente
    ───────────────────────────────────────────────────────── */
    extra.textColors = extra.colores.map(utils.txt);

    /* ─────────────────────────────────────────────────────────
       PASO 7: TARJETA CONTENIDO
    ───────────────────────────────────────────────────────── */
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

    /* ─────────────────────────────────────────────────────────
       PASO 8: TARJETA ESTILO
    ───────────────────────────────────────────────────────── */
    const pE = prompt(libro, "estilo", c);
    let rawE = await call(openai, pE, "Genera estilo");
    rawE = rawE.replace(/@@STYLE|@@ENDSTYLE/g, "").trim();
    
    try {
      extra.tarjeta.style = JSON.parse(utils.clean(rawE));
    } catch (e) {
      console.warn(`   ⚠️  Style error: ${e.message}`);
    }

    /* ─────────────────────────────────────────────────────────
       PASO 9: RETURN FINAL
    ───────────────────────────────────────────────────────── */
    return {
      ...libro,
      ...extra,
      portada: libro.portada?.trim() || `📚 ${libro.titulo}\n${libro.autor}`,
      videoUrl: `https://duckduckgo.com/?q=!ducky+site:youtube.com+${encodeURIComponent(`${libro.titulo} ${libro.autor} entrevista español`)}`
    };

  } catch (e) {
    console.error(`   ❌ "${libro.titulo}": ${e.message}`);
    
    /* ─────────────────────────────────────────────────────────
       FALLBACK COMPLETO (NIVEL DIOS)
       
       Si CUALQUIER cosa falla → Contenido válido garantizado
       NUNCA "default", siempre contenido usable
    ───────────────────────────────────────────────────────── */
    return {
      ...libro,
      dimension: "Bienestar",
      punto: "Cero",
      palabras: ["Inquietud", "Cansancio", "Duda", "Resistencia"],
      frases: [
        "🚶 Camina 10 pasos lentos sin pensar",
        "❤️ Nombra en voz baja a quién ayudaste hoy",
        "🧠 Anota 3 palabras que resuman este momento",
        "✨ Abre el libro en página random, lee 1 línea"
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
   🚀 MAIN (PUNTO DE ENTRADA)
   
   FLUJO:
   1. Inicializa OpenAI
   2. Obtiene contexto crono
   3. Lee CSV
   4. Mezcla y selecciona N libros
   5. Procesa cada uno
   6. Reset cada 5 (evita acumulación de prohibidos)
   7. Guarda JSON
   8. Muestra resumen
   
   EJECUCIÓN:
   node build-contenido-v7.2-GOD.js
═══════════════════════════════════════════════════════════════ */

const openai = new OpenAI({ apiKey: KEY });
const c = crono();

console.log("╔═══════════════════════════════════════════════╗");
console.log("║  TRIGGUI v7.2 GOD MODE - CÓDIGO DEFINITIVO   ║");
console.log("╚═══════════════════════════════════════════════╝\n");
console.log(`📅 ${new Date().toLocaleDateString("es-MX", { dateStyle: "full" })}`);
console.log(`⏰ ${new Date().toLocaleTimeString("es-MX")}`);
console.log(`🤖 ${CFG.model} | 🌡️  ${CFG.temp} | 🎯 JSON nativo`);
console.log(`📊 Energía del día: ${c.d.n} (${c.d.e})\n`);

// CARGA Y SHUFFLE
const csv = await fs.readFile(CFG.csv, "utf8");
const lista = parse(csv, { columns: true, skip_empty_lines: true });
const pick = utils.shuffle([...lista]).slice(0, Math.min(CFG.max, lista.length));

// PROCESAMIENTO
const libros = [];
let i = 0;

for (const libro of pick) {
  i++;
  console.log(`📖 [${i}/${pick.length}] ${libro.titulo}`);
  libros.push(await enrich(libro, openai, c));
  
  // Reset cada 5
  if (i % 5 === 0) {
    console.log(`   📊 P:${state.palabras.size} C:${state.colores.size} | 🔄 Reset`);
    state.palabras.clear();
    state.colores.clear();
  }
}

// GUARDADO
await fs.writeFile(CFG.out, JSON.stringify({ libros }, null, 2));

console.log("\n╔═══════════════════════════════════════════════╗");
console.log("║            GENERACIÓN COMPLETA                ║");
console.log("╚═══════════════════════════════════════════════╝\n");
console.log(`✅ ${CFG.out}`);
console.log(`📚 ${libros.length} libros procesados`);
console.log(`📊 ${state.palabras.size} palabras únicas | ${state.colores.size} colores únicos\n`);
console.log("🔥 Sistema v7.2 GOD MODE ejecutado\n");

/* ═══════════════════════════════════════════════════════════════
   📖 GUÍA RÁPIDA DE ITERACIÓN
   
   CICLO RECOMENDADO:
   
   1️⃣ MODIFICAR PROMPTS
      → Línea 205: Prompt MAIN (palabras/frases/colores)
      → Línea 230: Prompt TARJETA (contenido editorial)
      → Línea 247: Prompt ESTILO (diseño visual)
   
   2️⃣ EJECUTAR
      node build-contenido-v7.2-GOD.js
   
   3️⃣ REVISAR
      cat contenido.json | jq '.libros[0]'
   
   4️⃣ ANALIZAR
      - ¿Palabras específicas al libro?
      - ¿Frases con estructuras variadas?
      - ¿Colores únicos y memorables?
      - ¿Contenido editorial útil?
   
   5️⃣ AJUSTAR Y REPETIR
   
   ──────────────────────────────────────────────────────────
   
   🎛️ AJUSTES RÁPIDOS:
   
   Más creatividad:
   → Línea 42: temp: 1.5
   
   Más coherencia:
   → Línea 42: temp: 0.9
   
   Frases más largas:
   → Línea 210: "100-120 chars"
   
   Paletas más salvajes:
   → Línea 211: "valores RGB extremos (00-10 y F0-FF)"
   
   Más libros:
   → Línea 47: max: 20
   
   ──────────────────────────────────────────────────────────
   
   🛡️ PROTECCIONES ACTIVAS:
   
   ✅ Reintento si respuesta incompleta
   ✅ Reintento si palabras repetidas
   ✅ Error si arrays vacíos → Fallback
   ✅ Fallback completo si falla todo
   ✅ NUNCA más "default"
   
   ──────────────────────────────────────────────────────────
   
   📈 MÉTRICAS DE ÉXITO:
   
   BUENO:
   - 0-2 palabras repetidas en 20 libros
   - 0 colores repetidos
   - Frases variadas
   
   EXCELENTE:
   - 0 palabras repetidas
   - Paletas imposibles de confundir
   - Cada frase suena única
   
   GOD MODE:
   - Cada palabra conecta específicamente con el libro
   - Cada frase parece escrita por el autor
   - Cada paleta es memorable instantáneamente
   - Contenido editorial inspira acción inmediata
   
   ──────────────────────────────────────────────────────────
   
   🔥 ¡NIVEL DIOS ACTIVADO!
   
═══════════════════════════════════════════════════════════════ */
