/* ═══════════════════════════════════════════════════════════════════════════════
   TRIGGUI v7.1 ULTRA - FUSIÓN PERFECTA (VERSIÓN EXPLICADA CON MANZANITAS)
   
   ¿QUÉ HACE ESTE CÓDIGO?
   Toma libros de un CSV y genera contenido enriquecido:
   - 4 palabras emocionales (del Mapa de Hawkins)
   - 4 frases de acción (micro-protocolos)
   - Paleta de 4 colores + fondo
   - Tarjeta editorial (título, párrafos, estilo visual)
   
   ¿CÓMO FUNCIONA?
   1. Lee CSV con libros
   2. Por cada libro, llama a OpenAI con prompts inteligentes
   3. Valida que no repita palabras/colores
   4. Guarda todo en contenido.json
   
   ¿DÓNDE MODIFICAR?
   - Línea 35-42: Ajustar configuración (modelo, temperatura, cantidad)
   - Línea 127-198: Prompts (aquí está la MAGIA)
   - Línea 222-289: Lógica de enriquecimiento (el pipeline)
   
   Badir Nakid | Nov 2025
═══════════════════════════════════════════════════════════════════════════════ */

import fs from "node:fs/promises";
import { parse } from "csv-parse/sync";
import OpenAI from "openai";
import crypto from "node:crypto";

/* ═══════════════════════════════════════════════════════════════
   SECCIÓN 1: CONFIGURACIÓN
   
   Aquí defines TODO lo que quieras cambiar sin tocar código.
   
   ¿QUIERES EXPERIMENTAR?
   - Sube temp a 1.5 para más locura
   - Baja a 0.8 para más coherencia
   - Cambia max a 50 para procesar más libros
═══════════════════════════════════════════════════════════════ */

const KEY = process.env.OPENAI_KEY;
if (!KEY) process.exit(console.log("🔕 Sin OPENAI_KEY"));

const CFG = {
  model: "gpt-4o-mini",        // 🤖 Modelo de OpenAI
  temp: 1.3,                    // 🌡️  Creatividad (0.1=robótico, 2.0=caótico)
  top_p: 0.95,                  // 🎲 Diversidad de palabras
  presence: 0.7,                // 🚫 Penaliza repetir temas
  frequency: 0.4,               // 🔁 Penaliza repetir palabras exactas
  csv: "data/libros_master.csv", // 📁 Archivo de entrada
  out: "contenido.json",        // 💾 Archivo de salida
  max: 5                        // 📚 Cantidad de libros a procesar
};

/* ═══════════════════════════════════════════════════════════════
   SECCIÓN 2: UTILIDADES (NAMESPACE)
   
   Funciones helper que usamos en varias partes.
   Organizadas en un objeto "utils" para mantener todo limpio.
   
   ¿QUÉ HACE CADA UNA?
   - lum()    → Calcula luminancia de un color
   - txt()    → Decide si usar texto blanco o negro
   - shuffle()→ Mezcla array aleatoriamente
   - clean()  → Limpia markdown de respuestas de IA
═══════════════════════════════════════════════════════════════ */

const utils = {
  // 💡 LUMINANCIA: Calcula qué tan brillante es un color
  // Entrada: "#ff5733" → Salida: 0.45 (número entre 0 y 1)
  lum: h => {
    const [r, g, b] = h.slice(1).match(/../g).map(x => parseInt(x, 16) / 255);
    const f = v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  },

  // 🎨 COLOR DE TEXTO: Decide si poner texto negro o blanco
  // Entrada: "#ff5733" → Salida: "#FFFFFF" (blanco porque el fondo es oscuro)
  txt: h => utils.lum(h) > 0.35 ? "#000000" : "#FFFFFF",

  // 🔀 SHUFFLE: Mezcla array (algoritmo Fisher-Yates)
  // Entrada: [1,2,3,4,5] → Salida: [3,1,5,2,4] (aleatorio)
  shuffle: arr => {
    let m = arr.length, i;
    while (m) [arr[m], arr[i]] = [arr[i = Math.floor(Math.random() * m--)], arr[m]];
    return arr;
  },

  // 🧹 LIMPIEZA: Remueve markdown y texto basura
  // Entrada: "```json\n{...}\n```" → Salida: "{...}"
  clean: raw => raw.trim()
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .replace(/^[^{[]*/, "")
    .replace(/[^}\]]*$/, "")
};

// 📊 ESTADO GLOBAL: Set() para evitar repeticiones en la sesión actual
const state = { palabras: new Set(), colores: new Set() };

/* ═══════════════════════════════════════════════════════════════
   SECCIÓN 3: CRONOBIOLOGÍA
   
   Detecta DÍA y HORA actual para ajustar el tono del contenido.
   
   EJEMPLO:
   - Martes 14h → "Tensión Máxima" → Frases más intensas
   - Jueves 10h → "DÍA DIOS" → Máxima claridad y ejecución
   
   ¿DÓNDE SE USA?
   En los prompts (línea 135) para darle contexto a la IA.
═══════════════════════════════════════════════════════════════ */

function crono() {
  const now = new Date();
  const dia = now.toLocaleDateString("es-MX", { weekday: "long" });
  const hora = now.getHours();

  // 📅 MAPA DE DÍAS: Energía por día de la semana
  const dias = {
    lunes: { e: "80%", n: "Arquitectura", s: "Planificación gradual" },
    martes: { e: "40%", n: "Tensión Máxima", s: "Supervivencia emocional" },
    miércoles: { e: "60%", n: "Purga", s: "Claridad emergente" },
    jueves: { e: "120%", n: "DÍA DIOS", s: "Pico absoluto" },
    viernes: { e: "90%", n: "Cierre", s: "Consolidación" },
    sábado: { e: "80%", n: "Descanso", s: "Familia, juego" },
    domingo: { e: "80%", n: "Reset", s: "Preparación" }
  };

  // ⏰ MAPA DE HORAS: Energía por momento del día
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

  // 🔍 BUSCAR FRANJA ACTUAL
  const franja = horas.find(f => hora >= f[0] && hora < f[1]) || horas[0];
  const d = dias[dia.toLowerCase()] || dias.lunes;

  return { dia, hora, d, franja };
}

/* ═══════════════════════════════════════════════════════════════
   SECCIÓN 4: PROMPTS (LA MAGIA ESTÁ AQUÍ 🧙‍♂️)
   
   Aquí defines QUÉ le dices a la IA para que genere contenido.
   
   HAY 3 TIPOS DE PROMPTS:
   1. main    → Genera palabras, frases, colores
   2. tarjeta → Genera título, párrafos, subtítulo
   3. estilo  → Genera JSON de diseño visual
   
   ¿CÓMO ITERAR?
   1. Cambia las REGLAS (línea 162-166)
   2. Ejecuta: node build-contenido-v7.1-ULTRA-EXPLICADO.js
   3. Revisa contenido.json
   4. Si no te gusta, ajusta y vuelve a ejecutar
   
   💡 TIP: Los prompts son el 90% de la calidad del resultado.
═══════════════════════════════════════════════════════════════ */

function prompt(libro, tipo, c) {
  const seed = crypto.randomUUID();
  const prohibidas = [...state.palabras].join(", ");
  const prohibidosC = [...state.colores].join(", ");

  // 📝 BASE: Contexto compartido por todos los prompts
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
       PROMPT 1: MAIN (Palabras + Frases + Colores)
       
       ¿QUÉ GENERA?
       {
         "dimension": "Bienestar",
         "punto": "Cero",
         "palabras": ["Inquietud", "Cansancio", "Duda", "Resistencia"],
         "frases": ["🚶 Camina 10 pasos", ...],
         "colores": ["#ff8a8a", "#ffb56b", "#8cabff", "#d288ff"],
         "fondo": "#111111"
       }
       
       ¿DÓNDE MODIFICAR PARA MEJORAR?
       - Línea 162: Cambia "bajas Hawkins 20-200" por rango específico
       - Línea 163: Ajusta longitud de frases (60-80 chars)
       - Línea 164: Define mejor qué es "valores RGB inusuales"
    ───────────────────────────────────────────────────────── */
    main: base + `
GENERA JSON PURO:

{
  "dimension": "Bienestar|Prosperidad|Conexión",
  "punto": "Cero|Creativo|Activo|Máximo",
  "palabras": [4 emociones únicas, bajas Hawkins 20-200, específicas al libro],
  "frases": [4 frases con estructuras RADICALMENTE diferentes, emoji único, 60-80 chars],
  "colores": [4 hex únicos, mezcla cálido/frío, valores RGB inusuales],
  "fondo": "#hex oscuro"
}

REGLAS:
✅ Cada palabra: específica al libro, poco común, emoción sentida
✅ Cada frase: estructura ÚNICA, emoji ÚNICO, acción CONCRETA
✅ Cada color: imposible confundir con paletas anteriores

SOLO JSON.`,

    /* ─────────────────────────────────────────────────────────
       PROMPT 2: TARJETA (Contenido Editorial)
       
       ¿QUÉ GENERA?
       @@BODY
       Conexiones que transforman realidades
       Scott Gerber revela cómo conectar personas...
       ¿Estás listo para construir puentes?
       Identifica a tres personas en tu red...
       @@ENDBODY
       
       ¿DÓNDE MODIFICAR PARA MEJORAR?
       - Línea 189: Ajusta límite de caracteres (≤50)
       - Línea 192: Define mejor "acción específica"
    ───────────────────────────────────────────────────────── */
    tarjeta: base + `
Escribe contenido editorial:

TÍTULO (≤50 chars): Concepto único del libro
PÁRRAFO 1 (≤130 chars): Insight específico del libro + autor en 1ra persona
SUBTÍTULO (≤48 chars): Bisagra provocadora
PÁRRAFO 2 (≤130 chars): Acción específica derivada del libro (15-60 seg)

TONO: Sobrio, directo, humano, sin adornos, utilidad inmediata

Devuelve SOLO entre @@BODY y @@ENDBODY:
@@BODY
[Título]
[Párrafo 1]
[Subtítulo]
[Párrafo 2]
@@ENDBODY`,

    /* ─────────────────────────────────────────────────────────
       PROMPT 3: ESTILO (Diseño Visual)
       
       ¿QUÉ GENERA?
       @@STYLE
       {
         "accent": "#FF005A",
         "ink": "#1E1E1E",
         "glowFlux": "#39FF14",
         "surprise": "Efecto de nubes líquidas..."
       }
       @@ENDSTYLE
       
       ¿DÓNDE MODIFICAR PARA MEJORAR?
       - Línea 217: Define mejores claves "Conocidas"
       - Línea 218: Ejemplifica claves "Inventadas"
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
   SECCIÓN 5: LLAMADA API
   
   Función que habla con OpenAI.
   
   PARÁMETROS:
   - sys: Prompt de sistema (quién es la IA)
   - usr: Prompt de usuario (qué debe hacer)
   - forceJSON: Si true, OpenAI devuelve JSON garantizado
   
   💡 INNOVACIÓN CLAVE (De Gemini):
   response_format: { type: "json_object" }
   Esto GARANTIZA que OpenAI responda con JSON válido.
   Sin esto, a veces responde con texto + JSON.
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

  // 🎯 FORZAR JSON (Idea robada de Gemini)
  // Si forceJSON=true, OpenAI SOLO responde con JSON válido
  if (forceJSON) {
    config.response_format = { type: "json_object" };
  }

  const chat = await openai.chat.completions.create(config);
  return chat.choices[0].message.content;
}

/* ═══════════════════════════════════════════════════════════════
   SECCIÓN 6: ENRIQUECIMIENTO (EL PIPELINE COMPLETO)
   
   Esta es la función más importante. Toma un libro y genera TODO.
   
   FLUJO (8 PASOS):
   1. Genera JSON principal (palabras, frases, colores)
   2. Valida si hay palabras repetidas
   3. Registra palabras/colores usados
   4. Garantiza 4 elementos en cada array
   5. Calcula colores de texto (blanco/negro)
   6. Genera tarjeta de contenido
   7. Genera tarjeta de estilo visual
   8. Retorna objeto completo
   
   ¿DÓNDE ITERAR?
   - Paso 2 (línea 242): Ajusta lógica de validación
   - Paso 5 (línea 255): Modifica cálculo de colores
   - Paso 8 (línea 282): Cambia estructura del objeto final
═══════════════════════════════════════════════════════════════ */

async function enrich(libro, openai, c) {
  try {
    /* ─────────────────────────────────────────────────────────
       PASO 1: GENERACIÓN PRINCIPAL
       Llama a OpenAI con prompt "main" y forceJSON=true
    ───────────────────────────────────────────────────────── */
    const p = prompt(libro, "main", c);
    let raw = await call(openai, p, "Genera JSON ahora", true);
    let extra = JSON.parse(raw); // Ya viene limpio (gracias a forceJSON)

    /* ─────────────────────────────────────────────────────────
       PASO 2: VALIDACIÓN ANTI-REPETICIÓN
       Si encuentra palabras repetidas, vuelve a generar
       
       ¿POR QUÉ ES IMPORTANTE?
       Sin esto, la IA tiende a usar siempre las mismas palabras:
       "frustración", "miedo", "ansiedad"...
    ───────────────────────────────────────────────────────── */
    const repetidas = extra.palabras?.filter(p => state.palabras.has(p.toLowerCase())) || [];
    
    if (repetidas.length > 0) {
      console.warn(`   ⚠️  Repetidas: ${repetidas.join(", ")}`);
      const pVal = `Genera 4 palabras únicas. PROHIBIDAS: ${[...state.palabras].join(", ")}. SOLO JSON.`;
      raw = await call(openai, prompt(libro, "main", c), pVal, true);
      extra = JSON.parse(raw);
    }

    /* ─────────────────────────────────────────────────────────
       PASO 3: REGISTRAR USADOS
       Guarda palabras/colores en Set() para no repetir después
    ───────────────────────────────────────────────────────── */
    extra.palabras?.forEach(p => state.palabras.add(p.toLowerCase()));
    extra.colores?.forEach(c => state.colores.add(c));

    /* ─────────────────────────────────────────────────────────
       PASO 4: GARANTIZAR LONGITUD
       A veces la IA devuelve 3 palabras en vez de 4.
       Esto lo corrige duplicando la última.
    ───────────────────────────────────────────────────────── */
    ["palabras", "frases", "colores"].forEach(k => {
      if (!extra[k]) extra[k] = [];
      while (extra[k].length < 4) extra[k].push(extra[k][extra[k].length - 1] || "default");
    });

    /* ─────────────────────────────────────────────────────────
       PASO 5: POST-PROCESAMIENTO
       Calcula automáticamente si el texto debe ser blanco/negro
       según la luminancia del color de fondo.
       
       Ejemplo:
       colores: ["#ff8a8a", "#ffb56b", "#8cabff", "#d288ff"]
       textColors: ["#FFFFFF", "#000000", "#000000", "#FFFFFF"]
    ───────────────────────────────────────────────────────── */
    extra.textColors = extra.colores.map(utils.txt);

    /* ─────────────────────────────────────────────────────────
       PASO 6: TARJETA CONTENIDO
       Genera el texto editorial (título, párrafos, subtítulo)
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
       PASO 7: TARJETA ESTILO
       Genera el JSON de diseño visual (tipografía, colores, etc)
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
       PASO 8: RETURN FINAL
       Combina datos del libro original + datos generados
    ───────────────────────────────────────────────────────── */
    return {
      ...libro,
      ...extra,
      portada: libro.portada?.trim() || `📚 ${libro.titulo}\n${libro.autor}`,
      videoUrl: `https://duckduckgo.com/?q=!ducky+site:youtube.com+${encodeURIComponent(`${libro.titulo} ${libro.autor} entrevista español`)}`
    };

  } catch (e) {
    console.error(`❌ "${libro.titulo}":`, e.message);
    
    /* ─────────────────────────────────────────────────────────
       FALLBACK: Si algo falla, devuelve contenido por defecto
       Esto evita que el script se caiga completamente
    ───────────────────────────────────────────────────────── */
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
   SECCIÓN 7: MAIN (PUNTO DE ENTRADA)
   
   Aquí empieza la ejecución del script.
   
   FLUJO:
   1. Inicializa OpenAI
   2. Obtiene contexto cronobiológico
   3. Muestra banner
   4. Lee CSV
   5. Mezcla y selecciona N libros
   6. Procesa cada libro
   7. Guarda JSON
   8. Muestra resumen
   
   ¿CÓMO EJECUTAR?
   node build-contenido-v7.1-ULTRA-EXPLICADO.js
   
   ¿QUÉ VAS A VER?
   ╔════════════════════════════════════════════╗
   ║  TRIGGUI v7.1 ULTRA - FUSIÓN PERFECTA     ║
   ╚════════════════════════════════════════════╝
   
   📅 miércoles, 27 de noviembre de 2024
   ⏰ 16:30:45
   🤖 gpt-4o-mini | 🌡️  1.3 | 🎯 JSON nativo
   
   📖 [1/5] Superconnector
   📖 [2/5] Amar lo que es
   ...
   
   ✅ contenido.json
   📚 5 libros
   📊 20 palabras | 20 colores
═══════════════════════════════════════════════════════════════ */

const openai = new OpenAI({ apiKey: KEY });
const c = crono();

console.log("╔════════════════════════════════════════════╗");
console.log("║  TRIGGUI v7.1 ULTRA - FUSIÓN PERFECTA     ║");
console.log("╚════════════════════════════════════════════╝\n");
console.log(`📅 ${new Date().toLocaleDateString("es-MX", { dateStyle: "full" })}`);
console.log(`⏰ ${new Date().toLocaleTimeString("es-MX")}`);
console.log(`🤖 ${CFG.model} | 🌡️  ${CFG.temp} | 🎯 JSON nativo\n`);

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
  
  // RESET CADA 5 (evita que acumule demasiadas palabras prohibidas)
  if (i % 5 === 0) {
    console.log(`   📊 P:${state.palabras.size} C:${state.colores.size} | 🔄 Reset`);
    state.palabras.clear();
    state.colores.clear();
  }
}

// GUARDADO
await fs.writeFile(CFG.out, JSON.stringify({ libros }, null, 2));

console.log("\n╔════════════════════════════════════════════╗");
console.log("║           GENERACIÓN COMPLETA              ║");
console.log("╚════════════════════════════════════════════╝\n");
console.log(`✅ ${CFG.out}`);
console.log(`📚 ${libros.length} libros`);
console.log(`📊 ${state.palabras.size} palabras | ${state.colores.size} colores\n`);
console.log("🔥 Sistema v7.1 ULTRA ejecutado\n");

/* ═══════════════════════════════════════════════════════════════
   🎓 GUÍA DE ITERACIÓN RÁPIDA
   
   CICLO RECOMENDADO:
   
   1️⃣ MODIFICAR
      Edita los prompts (línea 127-226)
      Ejemplo: Cambiar "60-80 chars" por "40-60 chars"
   
   2️⃣ EJECUTAR
      node build-contenido-v7.1-ULTRA-EXPLICADO.js
   
   3️⃣ REVISAR
      cat contenido.json | jq '.libros[0].frases'
      (o abre contenido.json en tu editor)
   
   4️⃣ ANALIZAR
      ¿Las frases son demasiado largas?
      ¿Los colores son muy similares?
      ¿Las palabras son demasiado genéricas?
   
   5️⃣ VOLVER A 1️⃣
   
   ──────────────────────────────────────────────────────────
   
   🔧 MODIFICACIONES COMUNES:
   
   ▸ Más creatividad:
     Línea 37: temp: 1.5 (subir)
   
   ▸ Más coherencia:
     Línea 37: temp: 0.9 (bajar)
   
   ▸ Más variedad de palabras:
     Línea 162: Agregar más rangos Hawkins
   
   ▸ Frases más cortas:
     Línea 163: Cambiar "60-80 chars" por "40-60 chars"
   
   ▸ Paletas más locas:
     Línea 164: "valores RGB extremos (00-20 y E0-FF)"
   
   ──────────────────────────────────────────────────────────
   
   🐛 DEBUGGING:
   
   Si algo falla, mira:
   1. Línea 242: console.warn mostrará palabras repetidas
   2. Línea 278: console.warn mostrará errores de estilo
   3. Línea 289: console.error mostrará libro que falló
   
   ──────────────────────────────────────────────────────────
   
   📈 MÉTRICAS DE CALIDAD:
   
   BUENO:
   - 0-2 palabras repetidas en 20 libros
   - 0 colores repetidos en 20 libros
   - Frases con estructuras variadas
   
   EXCELENTE:
   - 0 palabras repetidas
   - Paletas imposibles de confundir
   - Cada frase suena escrita por persona diferente
   
   DIOS:
   - Cada palabra conecta ESPECÍFICAMENTE con el libro
   - Cada frase parece escrita por el autor original
   - Cada paleta es memorable y única
   
   ──────────────────────────────────────────────────────────
   
   🚀 PRÓXIMOS PASOS:
   
   1. Ejecuta con CFG.max = 5
   2. Revisa los 5 libros generados
   3. Si te gustan, sube a CFG.max = 20
   4. Itera sobre los prompts hasta nivel DIOS
   
   ¡ÉXITO! 🔥
═══════════════════════════════════════════════════════════════ */
