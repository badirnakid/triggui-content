/* ═══════════════════════════════════════════════════════════════════════════════
   TRIGGUI v9.2 NIVEL DIOS - CONTENIDO EDITORIAL UNIFICADO
   
   CAMBIOS v9.1 → v9.2:
   ✅ Fix crítico: Limpieza de regex ya no destruye las etiquetas [H]...[/H]
   ✅ Cero primera persona: Voz universal/observacional ("me checa 100%")
   ✅ Verificador estricto: penaliza uso de "yo", "descubrí", "aprendí"
   ✅ Fix Verificador: sinMetadata ignora [H] y [/H] para no causar falsos positivos
   
   AUTOR: Badir Nakid | FECHA: Abr 2026 | VERSIÓN: 9.2
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
    tituloGuia: 50,       
    parrafo1Guia: 250,    
    subtituloGuia: 70,    
    parrafo2Guia: 250     
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
  
  // ─── Verificación ───
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
   🧠 NEUROBIOLOGÍA - SISTEMA DE VARIABLES
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
        metodo: "Voz universal identificable, verdades absolutas",
        verificacion: "Usuario siente que lo describen al 100%"
      }
    }
  }
};

/* ═══════════════════════════════════════════════════════════════
   🧙‍♂️ SISTEMA DE PROMPTS v9.2 (VOZ UNIVERSAL "ME CHECA 100%")
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
${extra ?
`
═══════════════════════════════════════════════════════════════
🔗 JOURNEY PREVIO:
═══════════════════════════════════════════════════════════════
Emociones: ${extra.palabras.join(", ")}
Acciones:
${extra.frases.map((f, i) => `${i + 1}. ${f}`).join("\n")}

CONTINÚA este journey emocional.
═══════════════════════════════════════════════════════════════
` : ""}

[Eres Badir. Escribe sobrio, claro, directo. Voz universal y altamente observacional. Sin emojis.] 
Semilla interna (no mostrar): ${Math.random().toString(36).substring(2, 15)} 
Libro: "${libro.titulo}" de ${libro.autor} 
Idea semilla (no tan literal, NO tanto citar, NO usar comillas): ${extra && extra.frases ? extra.frases.join(" | ") : (libro.tagline || libro.titulo)}

REALMENTE QUIERO QUE DIGA ALGO IMPORTANTE, dale peso a valores y virtudes, esencia, cimientos sólidos, fundamentos.
QUE LA PERSONA QUE LEA SIENTA UNA IDENTIFICACIÓN TOTAL. DEBE PENSAR: "ME CHECA, ESTO ME DESCRIBE AL 100%". 
Escribe verdades absolutas, observaciones precisas sobre la naturaleza humana o el mundo, extraídas del libro.

ESTRICTAMENTE PROHIBIDO usar primera persona. 
NUNCA uses: "yo", "mi", "me", "he", "descubrí", "aprendí", "nos", "nuestro". 
Habla directo a la experiencia humana. Describe cómo funciona la mente, la realidad, el miedo, el tiempo, la inercia. Que sea universal.

QUE DESPUES DE LEER ESO SEPA QUE DEBE DE HACER. SU VERDADERO SIGUIENTE PASO. 
QUE SIENTA ESA LLAMA QUE SE PRENDIÓ QUE SEA ÚTIL DE VERDAD NO SOLO RELLENO.
AQUELLO QUE YA HAYAS ELEGIDO PARA DAR COMO RESULTADO HAZLE UN SCRAMBLE REVUELVELO PARA ASEGURAR QUE DE MANERA ALEATORIA NO REPITES.
SIEMPRE DUDA DE QUE SEGURAMENTE YA LA USASTE MUCHO Y CAMBIA.

⚡ Instrucción extra: 
Debes elegir exactamente frases completas, breves y poderosas, las más cruciales y transformadoras de todo el texto.
Usa el formato [H]…[/H] para rodear esas frases.
No uses jamás formatos como **negritas**, _cursivas_, <b>, <i> u otras etiquetas.
Solo [H] y [/H]. 
Está absolutamente prohibido devolver etiquetas HTML, CSS, estilos inline, atributos style, colores.
Solo devuelve texto plano con las marcas [H] y [/H].
Piensa como si tuvieras que escoger el único fragmento que hará que el lector cambie su forma de pensar o actuar, que lo deje pensando para bien. 
No marques palabras aisladas, nunca.
No marques adornos. Solo subraya una frase completa que sea un verdadero game changer.

PROHIBIDO caer en muletillas de reflexión. 
Cada mensaje debe sonar atemporal, como una máxima filosófica útil y contemporánea.

Objetivo: Tarjeta breve, clara, directa y cruda. Con un hecho o concepto del libro, y un accionable.
Que transmita algo IMPRESIONANTEMENTE VALIOSO, sublime, megaútil.
Cero frases hechas. Cero "marketing". Precisión y honestidad absoluta. 

Reglas críticas para NO inducir a error: 
- La "idea semilla" NO es una cita textual. Trátala como inspiración.
- NO escribas "la frase…", "según el libro…", "dice…", "como cita…".
- NO uses comillas alrededor de la idea semilla ni la presentes como cita literal.
- MENCIONA EL LIBRO Y EL AUTOR en alguna parte del texto, pero integrado de forma observacional y natural.

Guía de estilo: 
- Español latam neutro, cotidiano. Sin adornos ni palabras rimbombantes (p.ej. profundamente, genuino, ligero, extraordinario, entrañable, vibrante, radiante).
- No adornes el origen. Escribe la verdad dura y útil.
- Varía SIEMPRE todo. 

Estructura: 
1) Una línea de título: Breve, un concepto, sin metadata.
2) Un párrafo breve: La observación universal que hace que el lector diga "me checa 100%". Integra autor y libro.
3) Un subtítulo: Breve pero perfecto, bisagra emocional.
4) Un párrafo breve: Acción concreta de 15-60 segundos relacionada al concepto.

Reglas duras: 
- Extensión total: 3–5 líneas.
- Sin emojis ni símbolos raros. 
- Sonido: sobrio, observacional, crudo, útil.
- Varía la forma de iniciar SIEMPRE.
- La extensión total del texto debe adaptarse al espacio visual (máximo 50–60 palabras).
- Busca balance visual en el texto.
- El texto debe sonar atemporal y universal, nunca localista.

⚠️ Reglas críticas adicionales: 
- Debes insertar OBLIGATORIAMENTE 2 o 3 marcas [H]...[/H] en el texto.
- Nunca devuelvas el bloque sin al menos esas [H]...[/H]. Una en el primer párrafo y otra en el segundo, las mas relevantes.
- Debes variar el subrayado siempre.

@@BODY
(Instrucción estricta: Imprime SOLO las 4 líneas limpias. ESTÁ PROHIBIDO escribir rótulos como "1)", "2)", "Título:", "Párrafo:", o usar viñetas. Solo escribe el texto directo).
[Línea 1 del título aquí]
[Línea 2 del primer párrafo aquí]
[Línea 3 del subtítulo aquí]
[Línea 4 del segundo párrafo aquí]
@@ENDBODY`,

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
   ✅ VERIFICACIÓN AUTOMÁTICA
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
  
  // v9.2: verificación con CERO primera persona y regex ignorando [H]
  tarjeta: (texto) => {
    const lineas = texto.split("\n").filter(l => l.trim().length > CFG.tarjeta.longitudMinLinea);
    const checks = {
      tiene4Lineas: lineas.length >= 4,
      // CIRUGÍA: Reemplaza temporalmente [H] y [/H] por vacío SOLO para evaluar esta regla
      sinMetadata: !/\[|\]|TÍTULO:|PÁRRAFO:|SUBTÍTULO:/i.test(texto.replace(/\[\/?H\]/gi, "")),
      sinMarkdown: !/\*\*|__|```/g.test(texto),
      // Se penaliza fuertemente el uso de primera persona
      sinPrimeraPersona: !/\b(yo|descubrí|aprendí|reconozco|noté|encontré|comprendí|hemos|nuestro)\b/i.test(texto),
      tieneAccion: /\d+\s*(seg|segundo|minuto|min|paso)/i.test(texto),
      tieneHighlights: /\[H\]/i.test(texto),
      parrafosRicos: lineas.length >= 4 && lineas[1]?.length >= 80 && lineas[3]?.length >= 80
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
      
      // Limpieza PERFECTA v9.2 - Ya NO destruye las [H] al inicio/fin
      const lineas = rawT.split(/\n+/).filter(Boolean).map(l => {
        return l
          .replace(/\[Título\]|\[Párrafo.*?\]|\[Subtítulo\]|\[Acción.*?\]|\[línea.*?\]/gi, "")
          .replace(/^(TÍTULO|PÁRRAFO\s*\d*|SUBTÍTULO|ACCIÓN)[:.\s]*/gi, "")
          .replace(/^(Concepto único|Insight específico|Bisagra provocadora|Reflexión activa|Pregunta provocadora)[:.\s]*/gi, "")
          .replace(/^\d+[\)\.]\s*(?:Una línea de título|Un párrafo breve|Un subtítulo|Párrafo)?[:.\s]*/gi, "")
          .replace(/^\*{1,3}|\*{1,3}$/g, "")
          .replace(/^_{1,3}|_{1,3}$/g, "")
          .trim();
      }).filter(l => l.length > CFG.tarjeta.longitudMinLinea);

      const textoLimpio = lineas.join("\n");

      // VERIFICACIÓN v9.2 - Cero primera persona
      if (CFG.verificacion.activa) {
        const v = VERIFICADOR.tarjeta(textoLimpio);
        if (CFG.verificacion.logNivelBajo && v.score < 0.8) {
          console.log(`   ⚠️  Verificación tarjeta: ${v.nivel} (${(v.score * 100).toFixed(0)}%)`);
          console.log(`      Checks fallidos:`, Object.entries(v.checks).filter(([k,v]) => !v).map(([k]) => k));
        }
        
        if (CFG.verificacion.reintentoSiBajo && !v.aprobado) {
          throw new Error(`Verificación tarjeta falló: score ${v.score.toFixed(2)}`);
        }
      }
      
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
  
  // Fallback Universal (v9.2)
  return {
    ...libro,
    dimension: "Bienestar",
    punto: "Cero",
    palabras: ["inercia", "estancamiento", "claridad", "foco"],
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
      titulo: "El poder de la inacción consciente",
      parrafoTop: "La mente humana está diseñada para el movimiento perpetuo. Sin embargo, [H]el verdadero impacto nace en las pausas estructuradas[/H].",
      subtitulo: "¿Qué sucede cuando el ruido se apaga?",
      parrafoBot: "Toma el control inmediato del ritmo. [H]Detén cualquier actividad durante 15 segundos exactos[/H] y observa qué pensamiento domina el silencio.",
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
  console.log("║   TRIGGUI v9.2 — MODO SINGLE (1 libro)       ║");
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
console.log("║   TRIGGUI v9.2 NIVEL DIOS - EDITORIAL UNIF.  ║");
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
   📖 GUÍA v9.2 NIVEL DIOS
   
   🔥 CAMBIOS v9.1 → v9.2:
   ✅ Fix agresivo regex (preserva [H])
   ✅ Cero primera persona, puro "me checa 100%" universal
   ✅ Fix Verificador: sinMetadata ignora [H] y [/H] para no causar falsos positivos
   
   FILOSOFÍA v9.2:
   - Una sola fuente de contenido para tres salidas
   - Contenido editorial rico (no tweets para app)
   - Prompt tarjeta = fusión de lo mejor de Apps Script + build-contenido
   
═══════════════════════════════════════════════════════════════ */
