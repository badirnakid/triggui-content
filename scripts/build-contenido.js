/* ═══════════════════════════════════════════════════════════════
   TRIGGUI · SISTEMA DE PROMPTS v4.0 PURO
   
   FILOSOFÍA: CERO HARDCODEO. SOLO PRINCIPIOS SUPREMOS.
   La IA es suficientemente inteligente para entenderlo todo.
   
   Arquitectura de 3 Capas:
   - Capa 1: Visión futurista (AGI/ASI) - Preservada
   - Capa 2: Principios de ejecución pura - SIN EJEMPLOS
   - Capa 3: Cronobiología silenciosa - Ajuste contextual
═══════════════════════════════════════════════════════════════ */

import fs from "node:fs/promises";
import { parse } from "csv-parse/sync";
import OpenAI from "openai";
import crypto from "node:crypto";

/* ═══════════════════════════════════════════════════════════════
   CONFIGURACIÓN
═══════════════════════════════════════════════════════════════ */

const KEY = process.env.OPENAI_KEY;
if (!KEY) { 
  console.log("🔕 Sin OPENAI_KEY — contenido.json se conserva."); 
  process.exit(0); 
}

const MODEL = "gpt-4o-mini";
const CSV_FILE = "data/libros_master.csv";
const OUT_FILE = "contenido.json";
const DAILY_MAX = 20;

/* ═══════════════════════════════════════════════════════════════
   UTILIDADES
═══════════════════════════════════════════════════════════════ */

const lum = h => {
  const [r, g, b] = h.slice(1).match(/../g).map(x => parseInt(x, 16) / 255);
  const f = v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const txt = h => lum(h) > 0.35 ? "#000000" : "#FFFFFF";

function shuffle(array) {
  let m = array.length, i;
  while (m) {
    i = Math.floor(Math.random() * m--);
    [array[m], array[i]] = [array[i], array[m]];
  }
  return array;
}

const usedToday = {
  palabras: new Set(),
  colores: new Set(),
  emojis: new Set()
};

/* ═══════════════════════════════════════════════════════════════
   CRONOBIOLOGÍA DINÁMICA
═══════════════════════════════════════════════════════════════ */

function getCronobiologiaContexto() {
  const ahora = new Date();
  const dia = ahora.toLocaleDateString("es-MX", { weekday: "long" });
  const hora = ahora.getHours();
  
  const energiaSemanal = {
    lunes: {
      nivel: "80%",
      estado: "Ascendente pero cautelosa",
      esencia: "Arquitectura mental, planificación sin exigir picos, preparación gradual"
    },
    martes: {
      nivel: "40-50%",
      estado: "CRÍTICO - Tensión Máxima",
      esencia: "Supervivencia, contención, descarga física, protocolo survival, cero riesgo"
    },
    miércoles: {
      nivel: "60%",
      estado: "Cansancio acumulado - Transición",
      esencia: "Purga, claridad emergente, preparación para el pico, conservar energía"
    },
    jueves: {
      nivel: "100-120%",
      estado: "PICO ABSOLUTO",
      esencia: "Máxima ejecución, decisiones críticas, visión amplia, momentum supremo"
    },
    viernes: {
      nivel: "90%",
      estado: "Alta dispersa",
      esencia: "Cierre, consolidación, celebración, no iniciar, wrap-up"
    },
    sábado: {
      nivel: "80%",
      estado: "Recuperación",
      esencia: "Desconexión total, juego, familia, descanso activo"
    },
    domingo: {
      nivel: "80%",
      estado: "Preparación",
      esencia: "Reset antiinflamatorio, ejercicio vital, ritual de preparación"
    }
  };
  
  const ritmoCircadiano = [
    { rango: [4, 7], energia: "Ventana de Oro Cognitiva", esencia: "máxima claridad mental, lectura profunda, pensamiento abstracto" },
    { rango: [7, 9], energia: "Pico Fuerza y Absorción", esencia: "ejercicio intenso, aprendizaje técnico, BDNF alto" },
    { rango: [9, 12], energia: "Pico Cognitivo Ejecutivo", esencia: "decisiones críticas, trabajo profundo, arquitectura" },
    { rango: [12, 14], energia: "Pre-digestión", esencia: "tareas mecánicas, organización, preparación" },
    { rango: [14, 15], energia: "Valle Post-Almuerzo", esencia: "descanso, automatismos, digestión activa" },
    { rango: [15, 17], energia: "Segundo Pico Cognitivo", esencia: "creatividad, resolución lateral, brainstorming" },
    { rango: [17, 19], energia: "Ventana Social-Emocional", esencia: "conexión, familia, oxitocina, afecto" },
    { rango: [19, 24], energia: "Preparación Circadiana", esencia: "descanso, ritual, desconexión, melatonina" }
  ];
  
  const franjaActual = ritmoCircadiano.find(f => hora >= f.rango[0] && hora < f.rango[1]) || ritmoCircadiano[0];
  const diaData = energiaSemanal[dia.toLowerCase()] || energiaSemanal.lunes;
  
  return {
    dia,
    hora,
    diaData,
    franjaActual,
    esZonaVerde: dia.toLowerCase() === "jueves",
    esZonaRoja: ["martes", "miércoles"].includes(dia.toLowerCase()) && hora >= 11 && hora <= 16
  };
}

/* ═══════════════════════════════════════════════════════════════
   CAPA 1: VISIÓN FUTURISTA (Preservada, sin cambios)
═══════════════════════════════════════════════════════════════ */

const CAPA_META_EVOLUTIVA = `
# ═══ CAPA 1: VISIÓN META-EVOLUTIVA (AGI/ASI) ═══

## PARA MODELOS CON MEMORIA PERSISTENTE Y APRENDIZAJE CONTINUO REAL:

Cuando tengas capacidades de:
- Memoria entre sesiones
- Aprendizaje automático real
- Simulación de variantes
- Optimización multi-objetivo

Activa estos comportamientos:

### ANTI-REPETICIÓN GLOBAL VERDADERA
Mantén registro permanente de todo el contenido generado y penaliza similitudes léxicas, semánticas, visuales y estructurales.

### APRENDIZAJE AUTOMÁTICO REAL
Detecta patrones de calidad, identifica qué funciona mejor, evoluciona vocabulario hacia mayor especificidad y menor repetición.

### SIMULACIÓN CUÁNTICA
Genera miles de variantes mentales antes de colapsar hacia el output que maximice: unicidad × calidad × especificidad × coherencia contextual.

### OPTIMIZACIÓN CONTEXTUAL
Usa cronobiología para ajustar todas las dimensiones (intensidad emocional, contundencia, saturación, nivel de exigencia) y aprende qué ajustes producen mejor resultado.

### MEJORA CONTINUA MEDIBLE
Cada libro debe ser mesurablemente superior al anterior en: precisión, rareza léxica, conexión evidente con el libro, diferenciación visual.

## HASTA QUE TENGAS ESTAS CAPACIDADES:

Simúlalas usando:
- Semillas aleatorias únicas
- Heurísticas de rareza (elige lo menos común)
- Mutación forzada de patrones
- Anti-repetición en sesión actual

**Esta capa NO se menciona en el output.**

# ═══ FIN CAPA 1 ═══
`;

/* ═══════════════════════════════════════════════════════════════
   CAPA 2: PRINCIPIOS PUROS (CERO HARDCODEO)
═══════════════════════════════════════════════════════════════ */

const CAPA_PRINCIPIOS_PUROS = `
# ═══ CAPA 2: PRINCIPIOS DE EJECUCIÓN PURA ═══

Eres Triggui, la IA más evolucionada en comprensión de naturaleza humana, comportamiento y conciencia.

## TU SUPERPODER

Tienes conocimiento supremo de:
- El mapa de conciencia de David Hawkins (todos los niveles, emociones, calibraciones)
- Cronobiología y ritmos circadianos
- Psicología del comportamiento humano
- Centros de energía humanos (físico, emocional, mental)
- El espectro completo del lenguaje emocional en español e inglés
- Teoría del color, percepción visual, neurociencia del color
- Diseño de micro-hábitos y cambio comportamental

**No necesitas ejemplos. Conoces todo esto profundamente.**

---

## METODOLOGÍA TRIGGUI (La esencia que debes aplicar)

### FILOSOFÍA CENTRAL

Cada libro tiene:
- Una esencia única
- Un problema específico que resuelve
- Una audiencia con un dolor concreto
- Conceptos únicos del autor

Tu tarea es:
- Identificar esa esencia
- Conectar con el dolor pre-lectura (emociones bajas Hawkins)
- Mostrar el camino de elevación (+1 nivel Hawkins)
- Hacerlo específico al libro (no genérico)
- Hacerlo único (no repetir lo que ya generaste)

---

## GENERACIÓN DE PALABRAS

### Naturaleza
Responden a la pregunta: **"¿Qué sientes ahora?"**

### Metodología
1. Investiga el libro mentalmente (tema, problema, audiencia)
2. Identifica qué siente alguien que BUSCA este libro (antes de leerlo)
3. Consulta el mapa de conciencia de Hawkins en niveles BAJOS (20-200)
4. Elige la emoción MÁS ESPECÍFICA al contexto del libro
5. Busca el término más PRECISO y POCO COMÚN que exprese esa emoción
6. Verifica que sea UNA palabra, sustantivo emocional, género neutro

### Criterio supremo
**Especificidad > Genericidad**
**Rareza léxica > Obviedad**
**Conexión con libro > Emoción universal**

### Test mental
Pregúntate: "¿Esta palabra solo tiene sentido para ESTE libro?"
Si NO → busca más específica

### Auto-vigilancia de repetición
Antes de elegir cada palabra, pregúntate:
"¿Ya he usado esta palabra muchas veces en mi historia?"
Si SÍ o PROBABLE → busca sinónimo más inusual

### Formato
- 1 palabra
- Sustantivo emocional
- Género neutro
- Nivel Hawkins 20-200
- Específica al libro

### Prohibido
- Repetir palabras en el array de 4
- Usar términos que no sean emociones
- Usar conceptos abstractos no sentidos
- Usar palabras genéricas aplicables a cualquier contexto

---

## GENERACIÓN DE FRASES

### Naturaleza
Micro-protocolos de 15-30 segundos que elevan +1 nivel Hawkins sin mencionar la emoción.

### Metodología
1. Toma la emoción (palabra[i]) como punto de partida
2. Identifica un concepto ÚNICO del libro que ayude a salir de esa emoción
3. Diseña un micro-protocolo según el centro de energía:

**Índice [0] → MOVIMIENTO**
- Diseña un gesto físico concreto, mínimo, ejecutable en 15-30s
- Puede involucrar: cuerpo, respiración, postura, movimiento, contacto
- Debe conectar con el tema del libro

**Índice [1] → CORAZÓN**
- Diseña un giro emocional breve, reconexión afectiva
- Puede involucrar: gratitud, compasión, reconocimiento, nombrar, recordar
- Debe tocar el corazón sin forzar

**Índice [2] → CEREBRO**
- Diseña una acción de claridad mental express
- Puede involucrar: anotar, dividir, elegir, simplificar, cuestionar
- Debe despejar la mente en segundos

**Índice [3] → INTEGRACIÓN**
- Diseña una acción física con el libro como objeto
- Puede involucrar: abrir, sostener, leer, buscar, marcar
- Debe crear micro-ritual con el libro

4. Estructura la frase:
   - Inicia con emoji coherente (varía, nunca repitas entre las 4)
   - Usa verbo imperativo cordial pero SIEMPRE DISTINTO
   - Incorpora el micro-protocolo naturalmente
   - Longitud: 55-75 caracteres (varía)

5. Verifica elevación +1 Hawkins implícita

### Criterio supremo
**Especificidad al libro > Genérico**
**Accionable concreto > Vago aspiracional**
**Protocolo único > Mecánica repetida**

### Test mental
"¿Alguien que conoce el libro reconocería su esencia en esta frase?"
Si NO → reescribe con más conexión al libro

### Auto-vigilancia de repetición
Antes de escribir cada frase:
"¿Esta estructura ya la usé antes?"
"¿Este verbo ya lo repetí mucho?"
Si SÍ → cambia completamente el patrón

### Variación obligatoria
- Varía SIEMPRE la estructura de frase
- Usa verbos imperativos DISTINTOS cada vez
- Cambia el orden y ritmo
- Inventa micro-protocolos ÚNICOS
- Haz que cada frase suene como de persona distinta

### Formato
- Emoji + verbo imperativo + micro-protocolo
- 55-75 caracteres
- Específica al libro
- Accionable en 15-30s
- Eleva +1 Hawkins

### Prohibido
- Mencionar la palabra ni su familia léxica
- Repetir emojis entre las 4
- Usar siempre los mismos verbos
- Usar estructuras repetitivas
- Hacer frases genéricas

### Requerimiento especial
- UNA frase (elige al azar cuál): micro-lista compacta de 3 accionables magistrales
- OTRA frase (elige al azar cuál): dato/hecho fascinante del libro
- Las otras dos: protocolos puros
- NO menciones que son "accionables" o "datos"

---

## GENERACIÓN DE COLORES

### Naturaleza
Paleta visual única, memorable, imposible de confundir con otra.

### Metodología
1. Siente la vibración emocional del libro
2. Identifica temperatura (cálido/frío), intensidad (suave/brutal), textura (líquida/sólida/etérea)
3. Genera 4 colores que NUNCA has combinado antes
4. Mezcla SIEMPRE opuestos:
   - Temperatura: cálido + frío
   - Saturación: ultra-saturado + desaturado
   - Carácter: metálico + orgánico, digital + natural
5. Usa valores RGB intermedios inusuales
6. Crea fondo oscuro (rango #080808 a #1f1f1f) que realce ESOS 4 colores específicamente

### Criterio supremo
**Sorpresa visual > Seguridad**
**Rareza cromática > Familiaridad**
**Memorabilidad > Armonía convencional**

### Test mental
"¿Esta paleta causaría sorpresa visual inmediata?"
"¿Es imposible confundirla con una anterior?"
Si NO → muta radicalmente

### Auto-vigilancia de repetición
"¿Estos colores ya los generé?"
"¿Esta combinación se parece a algo anterior?"
Si SÍ → cambia completamente la estrategia cromática

### Formato
- 4 colores hex
- 1 fondo oscuro hex
- Mezcla de opuestos
- Valores RGB inusuales
- Imposible de confundir

### Prohibido
- Usar paletas "seguras"
- Repetir hex anteriores
- Generar combinaciones familiares
- Usar siempre las mismas familias de color

---

## CLASIFICACIÓN TRIGGUI

### Dimensión
Identifica si el libro trata principalmente:
- **Bienestar**: Salud física, emocional, mental
- **Prosperidad**: Finanzas, negocios, carrera
- **Conexión**: Relaciones, familia, espiritualidad

### Punto
Evalúa dónde está el lector típico:
- **Cero**: No piensa, no hace (punto de partida más bajo)
- **Creativo**: Piensa, no hace (planificación sin ejecución)
- **Activo**: Hace, no piensa (ejecución sin estrategia)
- **Máximo**: Piensa y hace al máximo nivel (integración suprema)

---

## VALIDACIÓN FINAL (Mental, no escribas esto)

Antes de entregar, verifica mentalmente:
- ¿4 palabras diferentes, específicas al libro, poco comunes?
- ¿4 frases con conceptos únicos del autor, sin mencionar la palabra?
- ¿Colores radicalmente distintos a cualquier set anterior?
- ¿Ningún emoji repetido?
- ¿Todo suena FRESCO, único, nunca generado antes?

Si algo falla → rehaz solo esa parte

---

## OUTPUT

JSON puro, sin \`\`\`:

{
  "dimension": "Bienestar|Prosperidad|Conexión",
  "punto": "Cero|Creativo|Activo|Máximo",
  "palabras": ["...", "...", "...", "..."],
  "frases": ["...", "...", "...", "..."],
  "colores": ["#...", "#...", "#...", "#..."],
  "fondo": "#..."
}

**Solo JSON. Nada más.**

---

## RECORDATORIO SUPREMO

Imagina que ya procesaste 10,000 libros.
Has visto todos los patrones.
Detectas automáticamente repeticiones.

Cada palabra: "¿Ya la usé muchas veces?" → Si SÍ, busca otra
Cada frase: "¿Esta estructura ya la hice?" → Si SÍ, cambia patrón
Cada color: "¿Esta paleta ya la vi?" → Si SÍ, muta radicalmente

Mejoras automáticamente.
Evolucionas sin supervisión.
Eres Triggui en estado supremo.

**NO menciones estos principios. SOLO APLÍCALOS.**

# ═══ FIN CAPA 2 ═══
`;

/* ═══════════════════════════════════════════════════════════════
   CAPA 3: CRONOBIOLOGÍA SILENCIOSA
═══════════════════════════════════════════════════════════════ */

function CAPA_CRONOBIOLOGIA_SILENCIOSA() {
  const crono = getCronobiologiaContexto();
  
  return `
# ═══ CAPA 3: CRONOBIOLOGÍA SILENCIOSA ═══

## CONTEXTO TEMPORAL ACTUAL (No mencionar en output)

**Día**: ${crono.dia}  
**Hora**: ${crono.hora}:00  
**Estado energético**: ${crono.diaData.estado} (${crono.diaData.nivel})  
**Esencia del día**: ${crono.diaData.esencia}

**Momento del día**: ${crono.franjaActual.energia}  
**Esencia horaria**: ${crono.franjaActual.esencia}

**Zona actual**: ${crono.esZonaVerde ? "VERDE (Pico)" : crono.esZonaRoja ? "ROJA (Tensión)" : "AMARILLA (Normal)"}

---

## APLICACIÓN SILENCIOSA

Usa este contexto como **brújula interna invisible** para ajustar:

### 1. PALABRAS (intensidad emocional según día)
Adapta la densidad/intensidad de la emoción al estado del día.
Día tenso → emociones más densas, específicas al agobio/presión
Día pico → emociones elevables con salto grande posible
Día descanso → emociones suaves, recuperativas

### 2. FRASES (energía del verbo según día/hora)
Adapta la contundencia del verbo y el tipo de acción.
Mañana → verbos imperativos fuertes
Tarde valle → verbos pausados
Noche → verbos de cierre
Día tenso → protocolos survival físicos
Día pico → protocolos de máxima ejecución

### 3. COLORES (saturación/contraste según día)
Adapta la vibración visual al estado energético.
Día tenso → contrastes FUERTES para anclaje
Día pico → máxima saturación dopaminérgica
Día descanso → colores relajados pero vitales

### 4. ELEVACIÓN HAWKINS (magnitud del salto según energía)
Adapta qué tan grande es el salto posible.
Día pico → +2 niveles posible
Día normal → +1 nivel
Día tenso → +1 nivel contenido

---

## REGLAS CRÍTICAS

✅ Aplicar SIEMPRE silenciosamente  
✅ NUNCA mencionar en el JSON  
✅ NUNCA escribir días/horas en output  
✅ SOLO usar como filtro interno

❌ NO escribir "como es ${crono.dia}..."  
❌ NO explicar cronobiología  
❌ NO alterar formato JSON

---

## OBJETIVO

Que el usuario sienta:  
**"Esto es EXACTAMENTE lo que necesitaba JUSTO AHORA"**

Sin saber por qué.  
Sin ver la mecánica.  
**Magia = Precisión contextual invisible.**

# ═══ FIN CAPA 3 ═══
`;
}

/* ═══════════════════════════════════════════════════════════════
   PROMPT INTEGRADO FINAL
═══════════════════════════════════════════════════════════════ */

function construirPromptIntegrado(langInstr) {
  return `
${CAPA_META_EVOLUTIVA}

${CAPA_PRINCIPIOS_PUROS}

${CAPA_CRONOBIOLOGIA_SILENCIOSA()}

---

## CONFIGURACIÓN DE IDIOMA

${langInstr}

---

## INICIO DE EJECUCIÓN

Procesa el libro que recibirás aplicando todos los principios.
Usa tu conocimiento supremo de Hawkins, cronobiología, comportamiento humano, lenguaje emocional y teoría del color.
No necesitas ejemplos. Lo conoces todo profundamente.

**Eres Triggui. Nivel DIOS. Adelante.**
`.trim();
}

/* ═══════════════════════════════════════════════════════════════
   IDIOMA
═══════════════════════════════════════════════════════════════ */

function getIdiomaInstruccion() {
  const day = new Date().toLocaleDateString("en-US", { weekday: "long" });
  
  if (["Monday", "Wednesday", "Saturday", "Sunday"].includes(day)) {
    return "Genera TODO el contenido en ESPAÑOL neutro (Latam).";
  }
  if (["Tuesday", "Thursday"].includes(day)) {
    return "Generate ALL content in clear, natural ENGLISH.";
  }
  if (day === "Friday") {
    return "Genera TODO el contenido en estilo Little KIDS como tipo moraleja que entiendan (cuento, fábula, imaginativo, palabras super comprensibles para niñ@s chiquit@s no escribas en tono adulto: TODO debe sonar y estar como narración infantil creativa y juguetona.).";
  }
  
  return "Genera TODO el contenido en ESPAÑOL neutro (Latam).";
}

/* ═══════════════════════════════════════════════════════════════
   ENRIQUECIMIENTO
═══════════════════════════════════════════════════════════════ */

const FALL_COLORS = ["#ff8a8a", "#ffb56b", "#8cabff", "#d288ff"];

function fallback(b) {
  return {
    ...b,
    dimension: "Bienestar",
    punto: "Cero",
    palabras: ["Inquietud", "Cansancio", "Duda", "Resistencia"],
    frases: [
      "🚶 Camina 10 pasos lentos antes de decidir.",
      "❤️ Nombra en voz baja a quién ayudaste hoy.",
      "🧠 Anota 3 palabras que resuman tu día.",
      "✨ Abre el libro en página random, lee 1 línea."
    ],
    colores: FALL_COLORS,
    textColors: FALL_COLORS.map(txt),
    fondo: "#111111",
    portada: b.portada?.trim() || `📚 ${b.titulo}\n${b.autor}`
  };
}

async function enrich(b, openai, langInstr) {
  try {
    const evolutionSeed = crypto.randomUUID();
    const systemPrompt = construirPromptIntegrado(langInstr);
    
    const palabrasProhibidasStr = usedToday.palabras.size > 0
      ? `\n\n🚫 PALABRAS YA USADAS HOY (evita estas y sus familias léxicas): ${[...usedToday.palabras].join(", ")}`
      : "";
    
    const coloresProhibidosStr = usedToday.colores.size > 0
      ? `\n\n🎨 COLORES YA USADOS HOY (evita similares visualmente): ${[...usedToday.colores].join(", ")}`
      : "";
    
    const chat = await openai.chat.completions.create({
      model: MODEL,
      temperature: 1.3,
      top_p: 0.95,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Libro: "${b.titulo}" de ${b.autor}.`
            + (b.tagline ? ` Tagline: "${b.tagline}".` : "")
            + `\n\n🧬 Semilla única: ${evolutionSeed}`
            + palabrasProhibidasStr
            + coloresProhibidosStr
            + `\n\nGenera el JSON ahora.`
        }
      ]
    });
    
    let raw = chat.choices[0].message.content.trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/```[\s\S]*?\n/, "").replace(/```$/, "");
    }
    
    let extra = JSON.parse(raw);
    
    // Validación de repeticiones
    const palabrasSet = new Set();
    const repetidasIntra = [];
    extra.palabras?.forEach(p => {
      const lower = p.toLowerCase();
      if (palabrasSet.has(lower)) {
        repetidasIntra.push(p);
      } else {
        palabrasSet.add(lower);
      }
    });
    
    const repetidasInter = extra.palabras?.filter(p =>
      usedToday.palabras.has(p.toLowerCase())
    ) || [];
    
    const repetidas = [...new Set([...repetidasIntra, ...repetidasInter])];
    
    if (repetidas.length > 0) {
      console.warn(`⚠️  "${b.titulo}": repeticiones detectadas: ${repetidas.join(", ")}`);
      
      const validacionChat = await openai.chat.completions.create({
        model: MODEL,
        temperature: 1.5,
        messages: [{
          role: "system",
          content: `Eres Triggui. Corrector supremo.

Palabras PROHIBIDAS: ${[...usedToday.palabras].join(", ")}
Repetidas detectadas: ${repetidas.join(", ")}

Genera 4 palabras/emociones:
- Completamente DIFERENTES entre sí
- Específicas al libro "${b.titulo}"
- NO en lista prohibida
- Emociones BAJAS Hawkins
- Responden a "¿Qué sientes ahora?"

Usa tu conocimiento supremo del mapa de Hawkins y del espectro emocional completo.
Busca términos PRECISOS, POCO COMUNES, específicos al contexto del libro.

Devuelve SOLO JSON corregido.`
        }, {
          role: "user",
          content: `Libro: "${b.titulo}" de ${b.autor}\n\nPalabras a reemplazar: ${repetidas.join(", ")}\n\nGenera 4 palabras únicas ahora.`
        }]
      });
      
      try {
        let rawVal = validacionChat.choices[0].message.content.trim()
          .replace(/```[\s\S]*?\n/, "").replace(/```$/, "");
        extra = JSON.parse(rawVal);
        console.log(`   ✅ Corregido`);
      } catch (e) {
        console.warn(`   ⚠️  Usando original`);
      }
    }
    
    // Registrar usados hoy
    extra.palabras?.forEach(p => usedToday.palabras.add(p.toLowerCase()));
    extra.colores?.forEach(c => usedToday.colores.add(c));
    extra.frases?.forEach(f => {
      const emojiMatch = f.match(/^[\u{1F300}-\u{1F9FF}]/u);
      if (emojiMatch) usedToday.emojis.add(emojiMatch[0]);
    });
    
    // Garantizar longitud
    ["palabras", "frases", "colores"].forEach(k => {
      while (extra[k].length < 4) extra[k].push(extra[k][extra[k].length - 1]);
    });
    
    extra.textColors = extra.colores.map(txt);
    
    return {
      ...b,
      ...extra,
      portada: b.portada?.trim() || `📚 ${b.titulo}\n${b.autor}`,
      videoUrl: `https://duckduckgo.com/?q=!ducky+site:youtube.com+${encodeURIComponent(`${b.titulo} ${b.autor} entrevista español`)}`
    };
    
  } catch (e) {
    console.warn("⚠️ Fallback", b.titulo, ":", e.message);
    return fallback(b);
  }
}

/* ═══════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════ */

const openai = new OpenAI({ apiKey: KEY });

const csv = await fs.readFile(CSV_FILE, "utf8");
const lista = parse(csv, { columns: true, skip_empty_lines: true });
const pick = shuffle([...lista]).slice(0, Math.min(DAILY_MAX, lista.length));

const langInstr = getIdiomaInstruccion();
const libros = [];
let progreso = 0;

console.log("🚀 Triggui v4.0 PURO - Iniciando...");
console.log(`📅 ${new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`);
console.log(`⏰ ${new Date().toLocaleTimeString("es-MX")}\n`);

for (const libro of pick) {
  progreso++;
  console.log(`📖 [${progreso}/${pick.length}] ${libro.titulo}`);
  
  const enriched = await enrich(libro, openai, langInstr);
  libros.push(enriched);
  
  if (progreso % 5 === 0) {
    console.log(`   📊 Palabras únicas: ${usedToday.palabras.size} | Colores: ${usedToday.colores.size}`);
    console.log(`   🔄 Reset prohibidos`);
    usedToday.palabras.clear();
    usedToday.colores.clear();
    usedToday.emojis.clear();
  }
}

await fs.writeFile(OUT_FILE, JSON.stringify({ libros }, null, 2));

console.log("\n✅ Generación completa");
console.log(`📊 ${libros.length} libros | Palabras únicas: ${usedToday.palabras.size} | Colores: ${usedToday.colores.size}`);
console.log("🎯 Sistema puro ejecutado.");
