/* ═══════════════════════════════════════════════════════════════════════════════
   TRIGGUI v9.0 NIVEL DIOS - ARQUITECTURA PROMPT INTEGRADA
   
   CAMBIOS v8.2 → v9.0:
   ✅ Sistema de prompts en 5 CAPAS verificables
   ✅ Variables neurobiológicas escalables
   ✅ Verificación automática de resultados
   ✅ Precisión nivel dios para gpt-4o-mini
   
   AUTOR: Badir Nakid | FECHA: Dic 2025 | VERSIÓN: 9.0
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
  temp: 1,
  top_p: 0.9,
  presence: 0.7,
  frequency: 0.4,
  
  // ─── Archivos ───
  csv: "data/libros_master.csv",
  out: "contenido.json",
  
  // ─── Procesamiento ───
  max: 20,
  delay: 10000,
  maxReintentos: 20,
  sleepReintento: 2000,
  resetMemoryCada: 5,
  
  // ─── Contenido (DINÁMICO según hora/día) ───
  hawkins: {
    base: [20, 100],
    madrugada: [20, 75],
    manana: [50, 150],
    tarde: [30, 120],
    noche: [20, 100]
  },
  
  frases: {
    cantidad: 4,
    longitudMin: 90,
    longitudMax: 110
  },
  
  palabras: {
    cantidad: 4
  },
  
  colores: {
    cantidad: 4
  },
  
  tarjeta: {
    accionMin: 15,
    accionMax: 60,
    lineasMin: 3,
    longitudMinLinea: 10,
    tituloGuia: 50,
    parrafo1Guia: 60,
    subtituloGuia: 70,
    parrafo2Guia: 90
  },
  
  // ─── Dark Mode ───
  darkMode: {
    paperMin: "#0a0a0a",
    paperMax: "#2a2a2a",
    inkMin: "#e0e0e0",
    inkMax: "#ffffff",
    lumThresholdPaper: 0.3,
    lumThresholdInk: 0.7
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
    tempMultiplicador: true,
    hawkinsShift: true,
    frasesExtension: true
  },
  
  // ─── Verificación (nuevo en v9.0) ───
  verificacion: {
    activa: true,                    // Activar verificación automática
    logNivelBajo: true,              // Loggear cuando score < 0.8
    reintentoSiBajo: true,           // Reintentar si verificación falla
    umbralMinimo: 0.75              // Score mínimo aceptable
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
  
  const energia = CFG.energia[dia] || 0.8;
  
  let franja = "noche";
  if (hora >= 0 && hora < 6) franja = "madrugada";
  else if (hora >= 6 && hora < 12) franja = "manana";
  else if (hora >= 12 && hora < 18) franja = "tarde";
  
  const tempDinamica = CFG.dinamico.tempMultiplicador 
    ? CFG.temp * energia 
    : CFG.temp;
  
  const hawkinsDinamico = CFG.dinamico.hawkinsShift
    ? CFG.hawkins[franja]
    : CFG.hawkins.base;
  
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
   🧠 NEUROBIOLOGÍA - SISTEMA DE VARIABLES (NUEVO v9.0)
═══════════════════════════════════════════════════════════════ */

const NEUROBIOLOGIA = {
  estadoEntrada: {
    ondas: {
      actual: "beta",
      objetivo: "alfa",
      metodo: "Colores dopaminérgicos + palabras emocionales directas + frases rítmicas"
    },
    neurotransmisores: {
      dopamina: {
        fase: "entrada",
        metodo: "Colores vibrantes, emojis, promesa de acción rápida (<60seg)",
        verificacion: "Usuario siente impulso de actuar en <10seg"
      },
      serotonina: {
        fase: "desarrollo",
        metodo: "Colores cálidos suaves, palabras Hawkins 200-400, validación",
        verificacion: "Usuario siente bienestar y permanencia"
      },
      oxitocina: {
        fase: "cierre",
        metodo: "Primera persona, preguntas reflexivas, acciones de auto-cuidado",
        verificacion: "Usuario siente conexión y comprensión"
      }
    }
  }
};

/* ═══════════════════════════════════════════════════════════════
   🧙‍♂️ SISTEMA DE PROMPTS v9.0 (5 CAPAS)
═══════════════════════════════════════════════════════════════ */

function buildPrompt(libro, tipo, ctx, extra = null) {
  const prohibidas = [...state.palabras].join(", ");
  const prohibidosC = [...state.colores].join(", ");
  
  // CAPA 1: IDENTIDAD
  const identidad = `
Eres Triggui, sistema neurobiológico de activación lectora.

EXPERTISE CORE:
• Mapa de Consciencia de David Hawkins (escala 0-1000)
• Neurobiología del comportamiento (dopamina, serotonina, oxitocina)
• Estados de ondas cerebrales (beta → alfa → theta)
• Diseño de experiencias que bypassean resistencia mental

OBJETIVO MAESTRO: Mover al usuario de BETA (pensamiento activo) a ALFA (receptividad subconsciente) en 2-3 minutos usando transiciones neuroquímicas específicas.
`;

  // CAPA 2: CONTEXTO
  const contexto = `
═══════════════════════════════════════════════════════════════
📚 LIBRO ACTUAL:
═══════════════════════════════════════════════════════════════
Título: "${libro.titulo}"
Autor: ${libro.autor}
${libro.tagline ? `Tagline: "${libro.tagline}"` : ""}

═══════════════════════════════════════════════════════════════
⏰ CONTEXTO CRONOBIOLÓGICO:
═══════════════════════════════════════════════════════════════
Día: ${ctx.dia}
Hora: ${ctx.hora}h
Energía del usuario: ${Math.round(ctx.energia * 100)}%
Rango emocional óptimo: Hawkins ${ctx.hawkinsDinamico[0]}-${ctx.hawkinsDinamico[1]}
Franja: ${ctx.franja}

${prohibidas ? `
═══════════════════════════════════════════════════════════════
🚫 ANTI-REPETICIÓN (NO usar estas):
═══════════════════════════════════════════════════════════════
Palabras: ${prohibidas}
Colores: ${prohibidosC}
` : ""}
`;

  // CAPA 3: OBJETIVO + CAPA 4: RESTRICCIONES + CAPA 5: OUTPUT
  const prompts = {
    main: identidad + contexto + `
═══════════════════════════════════════════════════════════════
🎯 OBJETIVO NEUROBIOLÓGICO:
═══════════════════════════════════════════════════════════════

TRANSICIÓN: BETA → ALFA (apertura en 2-3min)
NEUROQUÍMICA: Spike de dopamina → serotonina sostenida

GENERAR componentes que activen esta transición:

1️⃣ PALABRAS (${CFG.palabras.cantidad}):
   • Propósito neuro: Activar reconocimiento emocional sin análisis racional
   • Rango: Hawkins ${ctx.hawkinsDinamico[0]}-${ctx.hawkinsDinamico[1]}
   • Tipo: Emociones DENSAS, ESPECÍFICAS al libro (no genéricas)
   • Efecto: Reducen activación cortical (beta) → abren subconsciente (alfa)
   • Ejemplos válidos: "vergüenza", "anhelo", "rendición", "asombro", "humillación", "éxtasis"
   • ❌ Ejemplos NO válidos: "miedo", "alegría", "tristeza" (demasiado genéricos)

2️⃣ FRASES (${CFG.frases.cantidad}):
   • Propósito neuro: Spike dopamina (emoji) + dirección clara (acción)
   • Estructura: [emoji único] + [micro-contexto] + [acción 15-60seg]
   • Longitud: ${ctx.frasesLongitud.min}-${ctx.frasesLongitud.max} caracteres
   • Efecto: Emoji = recompensa visual → dopamina, acción = dopamina anticipada
   • Ejemplos válidos:
     "🚶 Camina 10 pasos lentos sin pensar en nada más"
     "✨ Abre el libro en página random, lee solo la primera línea"
     "❤️ Nombra en voz baja a quién ayudaste hoy sin esperar nada"
   • ❌ Ejemplos NO válidos:
     "🤔 Piensa en tu día" (vago, no hay acción de 15-60seg)
     "Lee el libro" (sin emoji, sin tiempo específico)

3️⃣ COLORES (${CFG.colores.cantidad}):
   • Propósito neuro: Dopamina visual + reducción activación cortical
   • Tipo: Hex vibrantes pero NO estridentes
   • Efecto: Cálidos → dopamina, fríos suaves → serotonina
   • Gama válida: #ff6b6b, #4ecdc4, #ffe66d, #a8e6cf, #ff8a8a, #95e1d3
   • ❌ NO válidos: grises (#888888), pasteles débiles (#f0f0f0), neón (#00ff00)

4️⃣ FONDO (1):
   • Propósito neuro: Ancla visual, contraste para legibilidad en alfa
   • Tipo: Oscuro profundo
   • Rango: #0a0a0a a #2a2a2a
   • Efecto: Reduce fatiga visual, prolonga tiempo en alfa

═══════════════════════════════════════════════════════════════
❌ RESTRICCIONES CRÍTICAS:
═══════════════════════════════════════════════════════════════
• NO términos genéricos ("miedo", "amor", "felicidad")
• NO clichés emocionales
• NO palabras/colores ya usados
• NO acciones vagas ("reflexiona", "piensa en")
• NO explicar tus elecciones
• NO incluir metadata, labels, markdown

═══════════════════════════════════════════════════════════════
📤 OUTPUT (JSON válido, sin bloques de código, sin explicaciones):
═══════════════════════════════════════════════════════════════

{
  "dimension": "Bienestar|Prosperidad|Conexión",
  "punto": "Cero|Creativo|Activo|Máximo",
  "palabras": ["emoción_densa_1", "emoción_densa_2", "emoción_densa_3", "emoción_densa_4"],
  "frases": [
    "🚶 Acción concreta brevísima en 15-60seg",
    "✨ Segunda acción distinta con tiempo",
    "❤️ Tercera acción con contexto",
    "🧠 Cuarta acción específica"
  ],
  "colores": ["#hex1", "#hex2", "#hex3", "#hex4"],
  "fondo": "#hex_oscuro"
}

VERIFICA ANTES DE RESPONDER:
✓ ¿4 palabras Hawkins ${ctx.hawkinsDinamico[0]}-${ctx.hawkinsDinamico[1]}?
✓ ¿4 frases con emoji + acción 15-60seg?
✓ ¿4 colores hex vibrantes dopaminérgicos?
✓ ¿Fondo oscuro #0a-#2a?
`,

    tarjeta: identidad + contexto + `
${extra ? `
═══════════════════════════════════════════════════════════════
🔗 JOURNEY PREVIO (CONTINÚA este viaje, no lo repitas):
═══════════════════════════════════════════════════════════════
Palabras emocionales activadas: ${extra.palabras.join(", ")}

Micro-acciones realizadas:
${extra.frases.map((f, i) => `  ${i + 1}. ${f}`).join("\n")}

⚠️ CRÍTICO: Tu tarjeta debe SENTIRSE como continuación natural.
   El usuario YA activó esas emociones, YA hizo esas acciones.
   Ahora profundizas → elevas → transformas.
═══════════════════════════════════════════════════════════════
` : ""}

═══════════════════════════════════════════════════════════════
🎯 OBJETIVO NEUROBIOLÓGICO:
═══════════════════════════════════════════════════════════════

TRANSICIÓN: ALFA sostenido → THETA inicial (profundización)
NEUROQUÍMICA: Serotonina (bienestar) + Oxitocina (conexión)

GENERAR tarjeta en 4 componentes:

1️⃣ TÍTULO (~${CFG.tarjeta.tituloGuia} chars):
   • Propósito: Ancla conceptual específica del libro
   • Neuro: Nombra algo que el usuario "ya sabía pero no había verbalizado"
   • Tono: Afirmativo, concreto, sin adornos
   • Ejemplo válido: "La soledad como maestra"
   • ❌ NO válido: "Descubre tu potencial" (genérico, cliché)

2️⃣ PÁRRAFO 1 (~${CFG.tarjeta.parrafo1Guia} chars):
   • Propósito: Validación emocional + insight personal
   • Neuro: Primera persona → activa oxitocina ("yo he sentido", "descubrí", "aprendí")
   • Conexión: Debe resonar con emociones Hawkins que ya activaste en JOURNEY PREVIO
   • Ejemplo válido: "He aprendido que la soledad no es ausencia, es el espacio donde mi voz interior deja de competir con el ruido"
   • ❌ NO válido: "La gente a veces se siente sola" (3ra persona, genérico)

3️⃣ SUBTÍTULO (~${CFG.tarjeta.subtituloGuia} chars):
   • Propósito: Elevación emocional (bisagra transformacional)
   • Neuro: Pregunta o frase que mueve de emociones bajas → altas
   • Forma: Interrogación provocadora o declaración que invita
   • Ejemplo válido: "¿Y si el silencio fuera tu mejor consejero?"
   • ❌ NO válido: "¿Quieres sentirte mejor?" (obvio, sin profundidad)

4️⃣ PÁRRAFO 2 (~${CFG.tarjeta.parrafo2Guia} chars):
   • Propósito: Acción concreta ${CFG.tarjeta.accionMin}-${CFG.tarjeta.accionMax}seg + contexto profundo
   • Neuro: Cierre con oxitocina (auto-cuidado) + dopamina (acción clara)
   • Construcción: [Referencia sutil a micro-acciones previas] + [nueva acción específica]
   • Ejemplo válido: "Después de caminar esos pasos y nombrar a quien ayudaste, toma este momento: encuentra un espacio donde puedas estar 3 minutos solo. Cierra los ojos. Pregúntate en voz baja: ¿qué necesito escuchar de mí mismo?"
   • ❌ NO válido: "Ahora reflexiona sobre tu vida" (vago, sin tiempo, sin construcción)

FILOSOFÍA DE ESCRITURA:
✅ Todo en 1ra persona ("yo") o dirigido íntimamente ("tú")
✅ CONTINÚA el journey (no lo reinicia)
✅ ELEVA desde emociones bajas hacia transformación
✅ CONSTRUYE sobre micro-acciones previas
✅ Flujo natural: las guías de chars son aproximadas, no rígidas

═══════════════════════════════════════════════════════════════
❌ RESTRICCIONES CRÍTICAS:
═══════════════════════════════════════════════════════════════
• NO reiniciar el journey
• NO usar 3ra persona o tono académico
• NO acciones vagas ("piensa", "reflexiona")
• NO incluir: corchetes [], metadata (TÍTULO:, PÁRRAFO:), ni formato de markdown
• NO separadores técnicos
• NO explicar elecciones

═══════════════════════════════════════════════════════════════
📤 OUTPUT (4 líneas limpias, flujo natural):
═══════════════════════════════════════════════════════════════

Título corto y específico del libro
Primera persona, insight emocional que conecta con journey previo, valida sin juzgar
¿Pregunta provocadora que eleva desde emociones bajas?
Después de [referencia sutil a acciones previas], ahora: [acción concreta 15-60seg] que [profundiza el journey]

VERIFICA ANTES DE RESPONDER:
✓ ¿Línea 1 nombra algo específico del libro?
✓ ¿Línea 2 usa "yo"/"he" y conecta con emociones previas?
✓ ¿Línea 3 eleva con pregunta/invitación provocadora?
✓ ¿Línea 4 construye sobre acciones + da una nueva de 15-60seg?
✓ ¿Sin metadata, sin markdown, sin labels?
`,

    estilo: identidad + contexto + `
═══════════════════════════════════════════════════════════════
🎯 OBJETIVO NEUROBIOLÓGICO:
═══════════════════════════════════════════════════════════════

MODO: Dark mode (reducción fatiga visual, prolongación alfa)

GENERAR style JSON que optimice permanencia en estado alfa:

COMPONENTES:
• accent: Color vibrante que active dopamina sin romper inmersión
• ink: Texto claro para legibilidad en alfa (sin esfuerzo cognitivo)
• paper: Fondo oscuro para sostenibilidad (menos activación cortical)
• border: Borde sutil que no rompa inmersión

RANGOS ESPECÍFICOS:
• paper: ${CFG.darkMode.paperMin} a ${CFG.darkMode.paperMax} (OSCURO, luminancia < 0.3)
• ink: ${CFG.darkMode.inkMin} a ${CFG.darkMode.inkMax} (CLARO, luminancia > 0.7)
• accent: vibrante pero no estridente (#ff6b6b, #4ecdc4, #ffa07a)
• border: oscuro sutil (#333333, #444444, #2a2a2a)

NEUROBIOLOGÍA:
✅ Alto contraste paper/ink = menor esfuerzo cognitivo = más tiempo en alfa
✅ Fondos oscuros = menos activación cortical (beta)
✅ Accent vibrante = dopamina visual sin romper estado

═══════════════════════════════════════════════════════════════
❌ RESTRICCIONES CRÍTICAS:
═══════════════════════════════════════════════════════════════
• paper NO puede ser claro (luminancia DEBE ser < 0.3)
• ink NO puede ser oscuro (luminancia DEBE ser > 0.7)
• NO colores neón estridentes (#00ff00, #ff00ff)
• NO explicar elecciones

═══════════════════════════════════════════════════════════════
📤 OUTPUT (JSON válido, sin bloques de código):
═══════════════════════════════════════════════════════════════

{
  "accent": "#hexVibrante",
  "ink": "#hexClaro",
  "paper": "#hexOscuro",
  "border": "#hexSutil"
}

VERIFICA ANTES DE RESPONDER:
✓ ¿paper oscuro (< 0.3 luminancia)?
✓ ¿ink claro (> 0.7 luminancia)?
✓ ¿accent vibrante pero no estridente?
✓ ¿border oscuro y sutil?
`
  };
  
  return prompts[tipo];
}

/* ═══════════════════════════════════════════════════════════════
   ✅ VERIFICACIÓN AUTOMÁTICA (NUEVO v9.0)
═══════════════════════════════════════════════════════════════ */

const VERIFICADOR = {
  // Verificar resultado JSON principal
  main: (data) => {
    const checks = {
      tienePalabras: Array.isArray(data.palabras) && data.palabras.length === CFG.palabras.cantidad,
      palabrasNoVacias: data.palabras?.every(p => p && p.length > 3),
      tieneFrases: Array.isArray(data.frases) && data.frases.length === CFG.frases.cantidad,
      frasesConEmoji: data.frases?.every(f => /[\p{Emoji}]/u.test(f)),
      frasesLongitudOk: data.frases?.every(f => f.length >= 30 && f.length <= 150),
      tieneColores: Array.isArray(data.colores) && data.colores.length === CFG.colores.cantidad,
      coloresHex: data.colores?.every(c => /^#[0-9a-f]{6}$/i.test(c)),
      tieneFondo: typeof data.fondo === "string" && /^#[0-9a-f]{6}$/i.test(data.fondo),
      fondoOscuro: data.fondo && utils.lum(data.fondo) < CFG.darkMode.lumThresholdPaper
    };
    
    const cumple = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;
    
    return {
      score: cumple / total,
      checks,
      nivel: cumple === total ? "PERFECTO" : cumple >= total * 0.8 ? "BUENO" : "BAJO",
      aprobado: cumple / total >= CFG.verificacion.umbralMinimo
    };
  },
  
  // Verificar tarjeta
  tarjeta: (texto) => {
    const lineas = texto.split("\n").filter(l => l.trim().length > CFG.tarjeta.longitudMinLinea);
    
    const checks = {
      tiene4Lineas: lineas.length >= 4,
      sinMetadata: !/\[|\]|TÍTULO:|PÁRRAFO:|SUBTÍTULO:/i.test(texto),
      sinMarkdown: !/\*\*|__|```/g.test(texto),
      primeraPersona: /\b(yo|he|mi|descubrí|aprendí|sentido)\b/i.test(texto),
      tieneAccion: /\d+\s*(seg|segundo|minuto|min|paso)/i.test(texto),
      tienePregunta: /\?|¿/.test(texto)
    };
    
    const cumple = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;
    
    return {
      score: cumple / total,
      checks,
      nivel: cumple === total ? "PERFECTO" : cumple >= total * 0.8 ? "BUENO" : "BAJO",
      aprobado: cumple / total >= CFG.verificacion.umbralMinimo
    };
  },
  
  // Verificar estilo
  estilo: (data) => {
    const checks = {
      tieneAccent: typeof data.accent === "string" && /^#[0-9a-f]{6}$/i.test(data.accent),
      tieneInk: typeof data.ink === "string" && /^#[0-9a-f]{6}$/i.test(data.ink),
      tienePaper: typeof data.paper === "string" && /^#[0-9a-f]{6}$/i.test(data.paper),
      tieneBorder: typeof data.border === "string" && /^#[0-9a-f]{6}$/i.test(data.border),
      paperOscuro: data.paper && utils.lum(data.paper) < CFG.darkMode.lumThresholdPaper,
      inkClaro: data.ink && utils.lum(data.ink) > CFG.darkMode.lumThresholdInk
    };
    
    const cumple = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;
    
    return {
      score: cumple / total,
      checks,
      nivel: cumple === total ? "PERFECTO" : cumple >= total * 0.8 ? "BUENO" : "BAJO",
      aprobado: cumple / total >= CFG.verificacion.umbralMinimo
    };
  }
};

/* ═══════════════════════════════════════════════════════════════
   📞 API CALL (sin cambios)
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
   ⚡ ENRIQUECIMIENTO (Pipeline con verificación)
═══════════════════════════════════════════════════════════════ */

async function enrich(libro, openai, ctx) {
  let intento = 0;
  
  while (intento <= CFG.maxReintentos) {
    try {
      // PASO 1: JSON principal
      console.log(`   [1/3] JSON principal...`);
      const p = buildPrompt(libro, "main", ctx);
      let raw = await call(openai, p, "Genera JSON", ctx.tempDinamica, true);
      let extra = JSON.parse(raw);
      
      // VERIFICACIÓN v9.0
      if (CFG.verificacion.activa) {
        const v = VERIFICADOR.main(extra);
        if (CFG.verificacion.logNivelBajo && v.score < 0.8) {
          console.log(`   ⚠️  Verificación main: ${v.nivel} (${(v.score * 100).toFixed(0)}%)`);
          console.log(`      Checks fallidos:`, Object.entries(v.checks).filter(([k,v]) => !v).map(([k]) => k));
        }
        
        if (CFG.verificacion.reintentoSiBajo && !v.aprobado) {
          throw new Error(`Verificación main falló: score ${v.score.toFixed(2)}`);
        }
      }
      
      // Validar respuesta completa
      if (!extra.frases || !extra.colores || !extra.palabras ||
          extra.frases.length === 0 || extra.colores.length === 0 || extra.palabras.length === 0) {
        throw new Error("Respuesta incompleta");
      }
      
      // Validar anti-repetición
      const repetidas = extra.palabras?.filter(p => state.palabras.has(p.toLowerCase())) || [];
      if (repetidas.length > 0) {
        console.log(`   ⚠️  Repetidas: ${repetidas.join(", ")}, regenerando...`);
        raw = await call(openai, buildPrompt(libro, "main", ctx), "Palabras únicas", ctx.tempDinamica, true);
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
      console.log(`   [2/3] Tarjeta...`);
      const pT = buildPrompt(libro, "tarjeta", ctx, extra);
      let rawT = await call(openai, pT, "Genera tarjeta", ctx.tempDinamica);
      rawT = rawT.replace(/@@BODY|@@ENDBODY/g, "").trim();
      
      // VERIFICACIÓN v9.0
      if (CFG.verificacion.activa) {
        const v = VERIFICADOR.tarjeta(rawT);
        if (CFG.verificacion.logNivelBajo && v.score < 0.8) {
          console.log(`   ⚠️  Verificación tarjeta: ${v.nivel} (${(v.score * 100).toFixed(0)}%)`);
          console.log(`      Checks fallidos:`, Object.entries(v.checks).filter(([k,v]) => !v).map(([k]) => k));
        }
        
        if (CFG.verificacion.reintentoSiBajo && !v.aprobado) {
          throw new Error(`Verificación tarjeta falló: score ${v.score.toFixed(2)}`);
        }
      }
      
      // Limpieza PERFECTA
      const lineas = rawT.split(/\n+/).filter(Boolean).map(l => {
        return l
          .replace(/^\[|\]$/g, "")
          .replace(/\[Título\]|\[Párrafo.*?\]|\[Subtítulo\]|\[Acción.*?\]|\[línea.*?\]/gi, "")
          .replace(/^(TÍTULO|PÁRRAFO\s*\d*|SUBTÍTULO|ACCIÓN)[:.\s]*/gi, "")
          .replace(/^(Concepto único|Insight específico|Bisagra provocadora|Reflexión activa|Pregunta provocadora)[:.\s]*/gi, "")
          .replace(/^\*{1,3}|\*{1,3}$/g, "")
          .replace(/^_{1,3}|_{1,3}$/g, "")
          .trim();
      }).filter(l => l.length > CFG.tarjeta.longitudMinLinea);
      
      extra.tarjeta = {
        titulo: lineas[0] || "",
        parrafoTop: lineas[1] || "",
        subtitulo: lineas[2] || "",
        parrafoBot: lineas.slice(3).join(" "),
        style: {}
      };
      
      // PASO 3: Tarjeta estilo
      console.log(`   [3/3] Style...`);
      const pE = buildPrompt(libro, "estilo", ctx);
      let rawE = await call(openai, pE, "Genera estilo", ctx.tempDinamica);
      rawE = rawE.replace(/@@STYLE|@@ENDSTYLE/g, "").trim();
      
      try {
        extra.tarjeta.style = JSON.parse(utils.clean(rawE));
        
        // VERIFICACIÓN v9.0
        if (CFG.verificacion.activa) {
          const v = VERIFICADOR.estilo(extra.tarjeta.style);
          if (CFG.verificacion.logNivelBajo && v.score < 0.8) {
            console.log(`   ⚠️  Verificación estilo: ${v.nivel} (${(v.score * 100).toFixed(0)}%)`);
          }
        }
        
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
console.log("║   TRIGGUI v9.0 NIVEL DIOS - PROMPTS PERFECTOS║");
console.log("╚═══════════════════════════════════════════════╝\n");
console.log(`📅 ${new Date().toLocaleDateString("es-MX", { dateStyle: "full" })}`);
console.log(`⏰ ${new Date().toLocaleTimeString("es-MX")}`);
console.log(`🤖 ${CFG.model} | 🌡️  ${ctx.tempDinamica.toFixed(2)} (${ctx.dia})`);
console.log(`📊 Energía: ${Math.round(ctx.energia * 100)}% | Hawkins: ${ctx.hawkinsDinamico[0]}-${ctx.hawkinsDinamico[1]}`);
console.log(`✅ Verificación: ${CFG.verificacion.activa ? "ON" : "OFF"} | Umbral: ${(CFG.verificacion.umbralMinimo * 100).toFixed(0)}%\n`);

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
   📖 GUÍA v9.0 NIVEL DIOS
   
   🔥 CAMBIOS CLAVE v8.2 → v9.0:
   ✅ Sistema de prompts en 5 CAPAS verificables
   ✅ Neurobiología explícita en cada componente
   ✅ Verificación automática con scoring
   ✅ Arquitectura escalable para nuevas variables
   
   🧠 AÑADIR NUEVAS VARIABLES NEUROBIOLÓGICAS:
   
   1. Define en NEUROBIOLOGIA (línea 169):
      ```
      nuevaVariable: {
        fase: "cuando_activarla",
        metodo: "cómo lo logras",
        verificacion: "cómo sabes que funcionó"
      }
      ```
   
   2. Añade en buildPrompt() dentro del objetivo relevante (línea 256):
      ```
      • Nueva variable: [explicación del efecto]
        Método: [cómo implementarla]
      ```
   
   3. Añade verificación en VERIFICADOR (línea 450):
      ```
      nuevaCheck: [condición que verifica la variable]
      ```
   
   EJEMPLO: Añadir GABA (neurotransmisor calmante)
   
   En NEUROBIOLOGIA:
   ```
   gaba: {
     fase: "transicion_alfa",
     metodo: "Ritmo pausado, palabras paz/confianza, colores fríos",
     verificacion: "Usuario siente calma sin somnolencia"
   }
   ```
   
   En buildPrompt() tarjeta:
   ```
   2️⃣ PÁRRAFO 1:
      ...
      • GABA: Ritmo pausado que calma sin adormecer
        Evitar: palabras de urgencia ("rápido", "ahora")
        Usar: palabras de confianza ("puedes", "descansa")
   ```
   
   En VERIFICADOR.tarjeta:
   ```
   sinUrgencia: !/urgente|rápido|ahora\s+mismo/i.test(texto)
   ```
   
   🎯 VERIFICAR SI FUNCIONA:
   - Activa CFG.verificacion.logNivelBajo = true
   - Revisa console para ver scores por componente
   - Score < 0.75 = necesita ajuste en prompt
   - Score > 0.9 = nivel dios alcanzado
   
   💡 FILOSOFÍA v9.0:
   - Cada prompt explica OBJETIVO (qué), MÉTODO (cómo), VERIFICACIÓN (testeo)
   - GPT-4o-mini necesita estructura clara, no ambigüedad
   - Verificación automática = menos debugging manual
   - Escalable = añadir variables sin romper nada
   
   🔥 MÁXIMA PERFECCIÓN ALCANZADA - PROMPT ARCHITECTURE NIVEL DIOS
   
═══════════════════════════════════════════════════════════════ */
