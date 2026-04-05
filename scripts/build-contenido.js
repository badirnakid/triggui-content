/* ═══════════════════════════════════════════════════════════════════════════════
   TRIGGUI v9.1 NIVEL DIOS - CONTENIDO EDITORIAL UNIFICADO
   
   CAMBIOS v9.0 → v9.1:
   ✅ Tarjeta con contenido RICO (~250 chars por párrafo, no ~60)
   ✅ Prompt tarjeta fusionado con esencia del prompt sagrado de Apps Script
   ✅ Highlights [H]...[/H] generados desde build-contenido (no solo en Apps Script)
   ✅ Verificador: pregunta ya no obligatoria
   ✅ Una sola fuente de contenido para PNG + edición viva + correo
   
   AUTOR: Badir Nakid | FECHA: Abr 2026 | VERSIÓN: 9.1
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
  temp: 1.2,
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
    // ─── v9.1: Guías LARGAS para contenido editorial rico ───
    // Antes: 50/60/70/90 (para cards de app 320px)
    // Ahora: 50/250/70/250 (para tarjeta PNG 1080px + correo editorial)
    tituloGuia: 50,       // Título SÍ corto — concepto que intriga
    parrafo1Guia: 250,    // ~40-50 palabras — párrafo editorial real
    subtituloGuia: 70,    // Subtítulo SÍ corto — bisagra emocional
    parrafo2Guia: 250     // ~40-50 palabras — acción con contexto rico
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
    activa: true,
    logNivelBajo: true,
    reintentoSiBajo: true,
    umbralMinimo: 0.75
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
   🧙‍♂️ SISTEMA DE PROMPTS v9.1 (5 CAPAS + TARJETA EDITORIAL)
═══════════════════════════════════════════════════════════════ */

function buildPrompt(libro, tipo, ctx, extra = null) {
  const prohibidas = [...state.palabras].join(", ");
  const prohibidosC = [...state.colores].join(", ");
  
  const base = `
Eres Triggui. Neurobiólogo + Diseñador de experiencias emocionales.

═══════════════════════════════════════════════════════════════
📚 LIBRO QUE DEBES DOMINAR:
═══════════════════════════════════════════════════════════════
"${libro.titulo}" — ${libro.autor}
${libro.tagline ? `"${libro.tagline}"` : ""}

═══════════════════════════════════════════════════════════════
⏰ CONTEXTO CRONOBIOLÓGICO:
═══════════════════════════════════════════════════════════════
${ctx.dia} ${ctx.hora}h | Energía usuario: ${Math.round(ctx.energia * 100)}%
Rango Hawkins óptimo: ${ctx.hawkinsDinamico[0]}-${ctx.hawkinsDinamico[1]}

${prohibidas ? `🚫 PALABRAS YA USADAS (PROHIBIDO repetir): ${prohibidas}` : ""}
${prohibidosC ? `🎨 COLORES YA USADOS (PROHIBIDO repetir): ${prohibidosC}` : ""}

═══════════════════════════════════════════════════════════════
🧠 OBLIGACIÓN CRÍTICA:
═══════════════════════════════════════════════════════════════

INVESTIGA PROFUNDAMENTE antes de generar:
- Google Books → fragmentos, índice, primeras páginas
- Goodreads → reviews reales, qué sienten los lectores
- Wikipedia → contexto autor, movimiento, época
- Cualquier fuente con CONTENIDO REAL del libro

TEST DE CALIDAD BRUTAL:
→ Si puedo copiar tu output y usarlo para OTRO libro = FALLASTE COMPLETAMENTE
→ Si no refleja CONTENIDO ESPECÍFICO de este libro = FALLASTE
→ Si es genérico = FALLASTE

PROCESO OBLIGATORIO:
1. Investiga el libro (BUSCA, no adivines)
2. Identifica temas, emociones, conflictos REALES del libro
3. Extrae atmósfera, tono, sensación ESPECÍFICA
4. SOLO ENTONCES genera
`;

  const prompts = {
    main: base + `
═══════════════════════════════════════════════════════════════
🎯 GENERAR: Activadores emocionales para "${libro.titulo}"
═══════════════════════════════════════════════════════════════

INVESTIGACIÓN OBLIGATORIA:
→ ¿Cuáles son los 3 temas centrales INTRÍNSECOS de este libro específico?
→ ¿Qué emociones/conflictos dominan en esta obra?
→ ¿Cuál es el arco emocional de este libro?
→ ¿Qué dicen los lectores reales en Goodreads?

COMPONENTE 1 - PALABRAS (${CFG.palabras.cantidad}):
Rango: Hawkins ${ctx.hawkinsDinamico[0]}-${ctx.hawkinsDinamico[1]}

PROCESO:
→ Identifica emociones que APARECEN en el contenido del libro
→ Mapea esas emociones a escala Hawkins en el rango dado
→ Prioriza emociones DENSAS, viscerales, específicas al libro
→ Emociones deben ser IMPOSIBLES de usar en otro libro sin que se note

PROHIBIDO ABSOLUTO:
❌ Emociones genéricas aplicables a cualquier libro
❌ Palabras que no reflejen contenido real del libro
❌ Cualquier emoción que no investigaste en el libro

COMPONENTE 2 - FRASES (${CFG.frases.cantidad}):
Longitud: ${ctx.frasesLongitud.min}-${ctx.frasesLongitud.max} caracteres
Estructura: emoji + acción 15-60 segundos

PROCESO:
→ Identifica metáforas, situaciones, momentos ESPECÍFICOS del libro, relacionados a su respectiva palabra de COMPONENTE 1
→ Traduce esas situaciones a acciones o micro-acciones ejecutables ahora. Relacionados a su respectiva palabra de COMPONENTE 1
→ Emoji debe reflejar tono emocional de esa parte del libro. Relacionados a su respectiva palabra de COMPONENTE 1
→ Cada acción debe ser ÚNICAMENTE aplicable a este libro. Relacionados a su respectiva palabra de COMPONENTE 1

NEUROBIOLOGÍA:
→ Emoji = spike dopamina (recompensa visual)
→ Acción <60seg = dopamina anticipatoria (alcanzable)
→ Conexión al libro = oxitocina (pertenencia)

PROHIBIDO ABSOLUTO:
❌ Acciones genéricas aplicables a cualquier libro
❌ Acciones sin tiempo específico
❌ Acciones desconectadas del contenido del libro

COMPONENTE 3 - COLORES (${CFG.colores.cantidad}):
Formato: hex completo

PROCESO NEUROBIOLÓGICO RIGUROSO:
→ Investiga atmósfera emocional ESPECÍFICA del libro
→ Determina si es oscuro, luminoso, esperanzador, sombrío, transformacional, introspectivo
→ Mapea esa atmósfera a activación dopaminérgica requerida

PRINCIPIOS NEUROBIOLÓGICOS:
→ Temperatura color (cálido/frío) determina tipo activación
→ Saturación determina intensidad dopaminérgica
→ Luminosidad ajusta según hora del día y energía usuario

MAPEO RIGUROSO ATMÓSFERA → NEUROBIOLOGÍA:
→ Atmósfera oscura existencial: fríos saturados para elevar manteniendo tono
→ Atmósfera cálida esperanzadora: cálidos saturados para amplificar
→ Atmósfera transformacional: contraste cálido-frío para impulso
→ Atmósfera introspectiva: fríos medios para profundizar sin agitar

AJUSTE CRONOBIOLÓGICO OBLIGATORIO:
→ Energía usuario: ${Math.round(ctx.energia * 100)}%
→ Si <60%: incrementa saturación para compensar
→ Si >100%: puedes reducir saturación
→ Hora ${ctx.franja}: ajusta luminosidad según momento del día

PROHIBIDO ABSOLUTO:
❌ Colores aleatorios sin investigación del libro
❌ Ignorar energía del usuario
❌ Ignorar hora del día
❌ Grises, pasteles débiles, neones estridentes
❌ Colores que no reflejen atmósfera del libro

CRITERIO FINAL:
→ ¿Refleja atmósfera del libro? NO = descarta
→ ¿Activa dopamina según energía/hora? NO = descarta
→ ¿Es único a este libro? NO = descarta

COMPONENTE 4 - FONDO (1):
Rango: ${CFG.darkMode.paperMin} a ${CFG.darkMode.paperMax}

Elige tono dentro del rango que complemente tu paleta.
Neurobiología: reduce fatiga visual, prolonga estado alfa.

═══════════════════════════════════════════════════════════════
📤 OUTPUT:
═══════════════════════════════════════════════════════════════

{
  "dimension": "Bienestar|Prosperidad|Conexión",
  "punto": "Cero|Creativo|Activo|Máximo",
  "palabras": ["palabra_hawkins_del_libro", "palabra_hawkins_del_libro", "palabra_hawkins_del_libro", "palabra_hawkins_del_libro"],
  "frases": [
    "emoji Acción relacionada al libro 15-60seg",
    "emoji Acción relacionada al libro 15-60seg",
    "emoji Acción relacionada al libro 15-60seg",
    "emoji Acción relacionada al libro 15-60seg"
  ],
  "colores": ["#hex", "#hex", "#hex", "#hex"],
  "fondo": "#hex"
}

VERIFICACIÓN ANTES DE RESPONDER:
✓ ¿Investigué el libro?
✓ ¿Palabras aparecen en contenido del libro?
✓ ¿Frases conectan con libro específico?
✓ ¿Colores reflejan atmósfera + cronobiología?
✓ ¿Puedo usar esto para otro libro? SI = REGENERA TODO

SOLO JSON.`,

    tarjeta: base + `
${extra ? `
═══════════════════════════════════════════════════════════════
🔗 JOURNEY PREVIO:
═══════════════════════════════════════════════════════════════
Emociones: ${extra.palabras.join(", ")}
Acciones:
${extra.frases.map((f, i) => `${i + 1}. ${f}`).join("\n")}

CONTINÚA este journey emocional.
═══════════════════════════════════════════════════════════════
` : ""}

═══════════════════════════════════════════════════════════════
🎯 GENERAR: Tarjeta editorial "${libro.titulo}"
═══════════════════════════════════════════════════════════════

Eres Badir Nakid. 21 años leyendo diario a las 4 AM. Ingeniero de sistemas con MBA.
Escribes como persona real: sobrio, claro, directo, cálido. Cero adornos.

INVESTIGA el libro ANTES de escribir. No inventes datos. Resume en tus palabras.

4 COMPONENTES (esto es una tarjeta editorial coleccionable, NO un tweet):

LÍNEA 1 — TÍTULO (~${CFG.tarjeta.tituloGuia} chars):
→ Concepto ÚNICO que solo aparece en este libro
→ Concreto, sin adornos, IMPOSIBLE de usar en otro libro
→ NO es el título del libro. NO es el autor. Es un concepto que intriga.

LÍNEA 2 — PÁRRAFO (~${CFG.tarjeta.parrafo1Guia} chars, ~40-50 palabras):
→ Escrito en primera persona. Sobrio, claro, directo, cálido.
→ Incluye mención NATURAL del libro y autor donde fluya mejor.
→ Un dato real, un concepto útil, un mecanismo ESPECÍFICO del libro.
→ Marca con [H]...[/H] la frase más transformadora del párrafo.
→ Que la persona que lea se quede con algo ÚTIL DE VERDAD, no relleno.
→ Varía radicalmente el inicio — nunca "He aprendido que...", nunca "Me hizo pensar..."
→ Busca armonía visual en la longitud de las líneas.

LÍNEA 3 — SUBTÍTULO (~${CFG.tarjeta.subtituloGuia} chars):
→ Frase poderosa O pregunta provocadora — varía, no siempre pregunta
→ Basada en tema CENTRAL del libro
→ Mueve de emociones bajas a altas

LÍNEA 4 — PÁRRAFO (~${CFG.tarjeta.parrafo2Guia} chars, ~40-50 palabras):
→ Acción concreta ${CFG.tarjeta.accionMin}-${CFG.tarjeta.accionMax} segundos con tiempo explícito.
→ Inspirada en metáfora/situación/dato ESPECÍFICO del libro.
→ Marca con [H]...[/H] la frase más importante de este párrafo.
→ Referencia SUTIL a micro-acciones del journey previo.
→ Que después de leer esto, sepa QUÉ DEBE HACER. Su verdadero siguiente paso.

PROHIBIDO ABSOLUTO:
❌ Títulos genéricos aplicables a otros libros
❌ Párrafos de menos de 30 palabras (son tarjetas editoriales, no tweets)
❌ Insights no relacionados al libro
❌ Acciones vagas sin tiempo
❌ Metadata, corchetes, markdown, HTML, rótulos ("Título:", "Párrafo:")
❌ Emojis ni símbolos decorativos
❌ Muletillas: "reflexionar", "resuena", "me hizo pensar", "genuino", "profundo"
❌ Siempre la misma estructura — varía RADICALMENTE inicio, desarrollo y cierre

VARIACIÓN OBLIGATORIA:
→ Cada tarjeta la escribe una persona distinta un día distinto.
→ Si detectas que vas a repetir un patrón, CÁMBIALO antes de escribir.
→ Piensa: "¿Cómo puedo decir esto de otra manera única, fresca y natural?" Y hazlo.

═══════════════════════════════════════════════════════════════
📤 OUTPUT (4 líneas limpias, SIN labels, con [H]...[/H]):
═══════════════════════════════════════════════════════════════

Concepto único del libro
Párrafo editorial en primera persona con dato real del libro y mención natural de título/autor. [H]La frase más transformadora del párrafo.[/H] Continúa con insight conectado al journey emocional previo.
Frase poderosa o pregunta provocadora del tema central
Acción concreta con tiempo explícito inspirada en el libro. [H]La frase más importante que active al lector.[/H] Referencia sutil a acciones previas y cierre que deje pensando.

VERIFICACIÓN:
✓ ¿Investigué enseñanza central?
✓ ¿Título único a este libro?
✓ ¿Párrafos de ~40-50 palabras cada uno?
✓ ¿Hay [H]...[/H] en cada párrafo?
✓ ¿Menciona libro y autor naturalmente?
✓ ¿Acción con tiempo del libro?
✓ ¿Puedo usar en otro libro? SI = REGENERA

4 LÍNEAS LIMPIAS.`,

    estilo: base + `
═══════════════════════════════════════════════════════════════
🎯 GENERAR: Dark mode "${libro.titulo}"
═══════════════════════════════════════════════════════════════

INVESTIGACIÓN EMOCIONAL OBLIGATORIA:
→ ¿Atmósfera emocional del libro?
→ ¿Oscuro o luminoso?
→ ¿Sombrío o esperanzador?
→ ¿Introspectivo o extrovertido?
→ ¿Qué sensación queda tras leerlo?

COMPONENTES:

ACCENT:
→ Color que REPRESENTE atmósfera específica del libro
→ Ajustado a energía usuario (${Math.round(ctx.energia * 100)}%) y hora (${ctx.franja})
→ Debe activar dopamina apropiada sin romper inmersión

Proceso:
1. Determina atmósfera del libro
2. Mapea a temperatura de color (cálido/frío)
3. Ajusta saturación según energía usuario
4. Ajusta luminosidad según hora

INK:
→ Rango: ${CFG.darkMode.inkMin} a ${CFG.darkMode.inkMax}
→ Claro, legible, sin esfuerzo cognitivo

PAPER:
→ Rango: ${CFG.darkMode.paperMin} a ${CFG.darkMode.paperMax}
→ Oscuro profundo
→ Complementa accent

BORDER:
→ Oscuro sutil, apenas perceptible
→ No rompe inmersión

Neurobiología: alto contraste = menos esfuerzo, fondo oscuro = alfa prolongado, accent = dopamina visual

═══════════════════════════════════════════════════════════════
📤 OUTPUT:
═══════════════════════════════════════════════════════════════

{
  "accent": "#hex",
  "ink": "#hex",
  "paper": "#hex",
  "border": "#hex"
}

VERIFICACIÓN:
✓ ¿Investigué atmósfera del libro?
✓ ¿Accent refleja libro?
✓ ¿Ajustado a energía/hora?
✓ ¿Paper oscuro rango correcto?
✓ ¿Ink claro rango correcto?

SOLO JSON.`
  };
  
  return prompts[tipo];
}

/* ═══════════════════════════════════════════════════════════════
   ✅ VERIFICACIÓN AUTOMÁTICA (v9.1 — pregunta ya no obligatoria)
═══════════════════════════════════════════════════════════════ */

const VERIFICADOR = {
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
  
  // v9.1: verificación tarjeta con contenido RICO
  tarjeta: (texto) => {
    const lineas = texto.split("\n").filter(l => l.trim().length > CFG.tarjeta.longitudMinLinea);
    
    const checks = {
      tiene4Lineas: lineas.length >= 4,
      sinMetadata: !/\[|\]|TÍTULO:|PÁRRAFO:|SUBTÍTULO:/i.test(texto),
      sinMarkdown: !/\*\*|__|```/g.test(texto),
      primeraPersona: /\b(yo|he|mi|descubrí|aprendí|sentido|reconozco|noté|encontré|comprendí)\b/i.test(texto),
      tieneAccion: /\d+\s*(seg|segundo|minuto|min|paso)/i.test(texto),
      tieneHighlights: /\[H\]/i.test(texto),
      parrafosRicos: lineas.length >= 4 && lineas[1]?.length >= 100 && lineas[3]?.length >= 100
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
      
      // VERIFICACIÓN v9.1
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

// ─── MODO SINGLE (workflow_dispatch) ──────────────────────────
if (process.env.SINGLE_MODE === "true") {
  const bookJSON = process.env.SINGLE_BOOK;
  if (!bookJSON) { console.error("❌ SINGLE_BOOK vacío"); process.exit(1); }

  const bookData = JSON.parse(bookJSON);

  console.log("╔═══════════════════════════════════════════════╗");
  console.log("║   TRIGGUI v9.1 — MODO SINGLE (1 libro)       ║");
  console.log("╚═══════════════════════════════════════════════╝\n");
  console.log(`📖 ${bookData.titulo} — ${bookData.autor}`);
  console.log(`🤖 ${CFG.model} | 🌡️  ${ctx.tempDinamica.toFixed(2)}\n`);

  const libroSingle = {
    titulo: bookData.titulo,
    autor: bookData.autor,
    portada: bookData.portada || "",
    tagline: bookData.tagline || "",
    isbn: bookData.isbn || ""
  };

  const enriched = await enrich(libroSingle, openai, ctx);

  let existing = { libros: [] };
  try {
    const raw = await fs.readFile(CFG.out, "utf8");
    existing = JSON.parse(raw);
  } catch { }

  existing.libros.unshift(enriched);
  await fs.writeFile(CFG.out, JSON.stringify(existing, null, 2));

  console.log("\n✅ Modo SINGLE completado");
  console.log(`📚 ${CFG.out} actualizado — "${bookData.titulo}" en posición [0]`);
  process.exit(0);
}
// ─── FIN MODO SINGLE ──────────────────────────────────────────


console.log("╔═══════════════════════════════════════════════╗");
console.log("║   TRIGGUI v9.1 NIVEL DIOS - EDITORIAL UNIF.  ║");
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
   📖 GUÍA v9.1 NIVEL DIOS
   
   🔥 CAMBIOS v9.0 → v9.1:
   ✅ Tarjeta con contenido RICO (~250 chars por párrafo)
   ✅ Prompt tarjeta fusionado con esencia del prompt sagrado de Apps Script
   ✅ [H]...[/H] highlights generados desde aquí (una sola fuente)
   ✅ Verificador: pregunta opcional, párrafos ricos obligatorios
   ✅ contenido.json alimenta: tarjeta PNG + edición viva + correo
   
   FILOSOFÍA v9.1:
   - Una sola fuente de contenido para tres salidas
   - Contenido editorial rico (no tweets para app)
   - Prompt tarjeta = fusión de lo mejor de Apps Script + build-contenido
   - Apps Script lee contenido.json en vez de llamar a GPT
   
═══════════════════════════════════════════════════════════════ */
