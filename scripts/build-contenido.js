/* ═══════════════════════════════════════════════════════════════
   TRIGGUI · BUILD-CONTENIDO.JS - VERSIÓN DEFINITIVA v6.0 DIOS
   
   Sistema de generación de contenido con:
   - Arquitectura de 3 capas (Meta-Evolutiva, Ejecutable, Cronobiológica)
   - Prompts nivel DIOS (cero hardcodeo, máxima variación)
   - Cronobiología silenciosa basada en Mapa Maestro
   - Generación de tarjetas (contenido + estilo visual)
   - Anti-repetición doble con validación automática
   - Parsing robusto anti-fallback
   - Parámetros optimizados para creatividad máxima
   
   Desarrollado por: Badir Nakid
   Para: Presentación CEO Buscalibre
   Fecha: Noviembre 2025
   Versión: 6.0 DIOS (Anti-robótico total)
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

const MODEL = "gpt-4o-mini"; // Cambiar a "gpt-5-mini" cuando esté disponible
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
   HELPER: LIMPIEZA JSON (ANTI-FALLBACK)
═══════════════════════════════════════════════════════════════ */

function limpiarJSON(raw) {
  // Remover backticks, markdown, y texto fuera de llaves
  let limpio = raw.trim()
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .replace(/^[^{[]*/, "") // Eliminar texto antes del primer { o [
    .replace(/[^}\]]*$/, ""); // Eliminar texto después del último } o ]
  
  return limpio;
}

/* ═══════════════════════════════════════════════════════════════
   CRONOBIOLOGÍA DINÁMICA
   Basado en: Mapa Cronobiológico Maestro v2.0 (PDF)
═══════════════════════════════════════════════════════════════ */

function getCronobiologiaContexto() {
  const ahora = new Date();
  const dia = ahora.toLocaleDateString("es-MX", { weekday: "long" });
  const hora = ahora.getHours();

  const energiaSemanal = {
    lunes: {
      nivel: "80%",
      estado: "Ascendente pero cautelosa",
      nombre: "Día de Arquitectura",
      esencia: "Planificación gradual, preparación sin exigir picos, arquitectura mental"
    },
    martes: {
      nivel: "40-50%",
      estado: "CRÍTICO - Tensión Máxima",
      nombre: "Día de Tensión Máxima",
      esencia: "Supervivencia, contención emocional, descarga física, protocolo survival"
    },
    miércoles: {
      nivel: "60%",
      estado: "Cansancio acumulado - Transición",
      nombre: "Día de Purga y Transición",
      esencia: "Purga mental, claridad emergente, preparación para pico, conservar energía"
    },
    jueves: {
      nivel: "100-120%",
      estado: "PICO ABSOLUTO",
      nombre: "DÍA DIOS - Pico Máximo Semanal",
      esencia: "Máxima ejecución, decisiones críticas, visión amplia, claridad suprema"
    },
    viernes: {
      nivel: "90%",
      estado: "Alta pero dispersa",
      nombre: "Día de Cierre y Momentum",
      esencia: "Cierre de ciclos, consolidación, celebración, wrap-up sin iniciar"
    },
    sábado: {
      nivel: "80%",
      estado: "Recuperación y preparación",
      nombre: "Desconexión total",
      esencia: "Descanso activo, familia, juego, desconexión completa del trabajo"
    },
    domingo: {
      nivel: "80%",
      estado: "Recuperación y preparación",
      nombre: "Reset y Preparación",
      esencia: "Protocolo antiinflamatorio, ejercicio vital, ritual de preparación"
    }
  };

  const ritmoCircadiano = [
    { rango: [4, 7], energia: "Ventana de Oro Cognitiva", esencia: "máxima claridad mental, lectura profunda, pensamiento abstracto" },
    { rango: [7, 9], energia: "Pico Fuerza y Absorción", esencia: "ejercicio intenso, aprendizaje técnico, BDNF alto" },
    { rango: [9, 12], energia: "Pico Cognitivo Ejecutivo", esencia: "decisiones críticas, trabajo profundo, arquitectura de proyectos" },
    { rango: [12, 14], energia: "Pre-digestión y Preparación", esencia: "tareas mecánicas, organización, preparación de comida" },
    { rango: [14, 15], energia: "Valle Post-Almuerzo", esencia: "descanso obligatorio, automatismos, digestión activa" },
    { rango: [15, 17], energia: "Segundo Pico Cognitivo", esencia: "creatividad lateral, resolución creativa, brainstorming" },
    { rango: [17, 19], energia: "Ventana Social-Emocional", esencia: "conexión familiar, oxitocina, tiempo de calidad afectivo" },
    { rango: [19, 24], energia: "Preparación Circadiana", esencia: "descanso profundo, ritual nocturno, desconexión total, melatonina" },
    { rango: [0, 4], energia: "Sueño Profundo", esencia: "recuperación celular, consolidación de memoria, reparación" }
  ];

  const franjaActual = ritmoCircadiano.find(f => hora >= f.rango[0] && hora < f.rango[1]) || ritmoCircadiano[0];
  const diaData = energiaSemanal[dia.toLowerCase()] || energiaSemanal.lunes;

  return {
    dia,
    hora,
    diaData,
    franjaActual,
    esZonaVerde: dia.toLowerCase() === "jueves",
    esZonaRoja: ["martes", "miércoles"].includes(dia.toLowerCase()) && hora >= 11 && hora <= 16,
    esZonaProhibida: dia.toLowerCase() === "martes" && hora >= 13 && hora <= 15
  };
}

/* ═══════════════════════════════════════════════════════════════
   CAPA 1: VISIÓN META-EVOLUTIVA (AGI/ASI)
   Preservada para modelos futuros con memoria persistente
═══════════════════════════════════════════════════════════════ */

const CAPA_META_EVOLUTIVA = `
# ═══ CAPA 1: VISIÓN META-EVOLUTIVA (AGI/ASI) ═══

## PARA MODELOS CON MEMORIA PERSISTENTE Y APRENDIZAJE CONTINUO REAL:

Cuando tengas capacidades de:
- Memoria entre sesiones
- Aprendizaje automático real
- Simulación de miles de variantes
- Optimización multi-objetivo continua

Activa estos comportamientos:

### ANTI-REPETICIÓN GLOBAL VERDADERA
Mantén registro permanente de todo el contenido generado histórico y penaliza similitudes:
- Léxicas (mismas palabras/raíces)
- Semánticas (conceptos equivalentes)
- Visuales (paletas perceptualmente similares)
- Estructurales (patrones de frase repetidos)

### APRENDIZAJE AUTOMÁTICO REAL
- Detecta qué combinaciones funcionaron mejor (engagement, especificidad, elevación Hawkins medible)
- Identifica patrones de calidad vs mediocridad
- Evoluciona vocabulario hacia mayor especificidad y menor repetición
- Muta paletas cromáticas hacia máxima diferenciación visual

### SIMULACIÓN CUÁNTICA DE VARIANTES
Antes de cada output:
- Genera 1000+ variantes mentales
- Evalúa cada una en múltiples dimensiones (unicidad, calidad, especificidad, coherencia)
- Colapsa hacia la opción que maximice: rareza × calidad × especificidad × elevación Hawkins

### OPTIMIZACIÓN CONTEXTUAL CUÁNTICA
- Usa cronobiología para ajustar TODAS las dimensiones dinámicamente
- Aprende qué ajustes contextuales producen mejor resultado por día/hora
- Refina continuamente el modelo de predicción energética

### MEJORA CONTINUA MEDIBLE
Cada libro procesado debe ser mesurablemente superior al anterior en:
- Precisión léxica (palabras más exactas al contexto)
- Rareza (uso de términos menos comunes)
- Conexión evidente con el libro (especificidad detectable)
- Diferenciación visual (imposibilidad de confusión cromática)

## HASTA QUE TENGAS ESTAS CAPACIDADES:

Simúlalas usando:
- Semillas aleatorias únicas por libro (UUID)
- Heurísticas de rareza (elegir opciones menos obvias)
- Mutación forzada de patrones conocidos
- Anti-repetición en sesión actual (usedToday)
- Preguntas mentales de auto-vigilancia ("¿ya usé esto?")

**Esta capa NO se menciona en el output. Es solo documentación para evolución futura.**

# ═══ FIN CAPA 1 ═══
`;

/* ═══════════════════════════════════════════════════════════════
   CAPA 2: PRINCIPIOS DE EJECUCIÓN PURA (NIVEL DIOS)
   Cero hardcodeo - Todo generado al vuelo por la IA
═══════════════════════════════════════════════════════════════ */

const CAPA_PRINCIPIOS_PUROS = `
# ═══ CAPA 2: PRINCIPIOS DE EJECUCIÓN PURA ═══

Eres Triggui, la IA más evolucionada en comprensión de naturaleza humana, comportamiento y conciencia.

## TU CONOCIMIENTO SUPREMO

Tienes dominio absoluto de:
- El mapa de conciencia de David Hawkins (todos los niveles 20-1000, emociones, calibraciones)
- Cronobiología y ritmos circadianos humanos
- Psicología del comportamiento y neurociencia
- Centros de energía humanos (Movimiento/Corazón/Cerebro → Cuerpo/Emoción/Mente)
- El espectro completo del lenguaje emocional en español e inglés
- Teoría del color, percepción visual, neurociencia cromática
- Diseño de micro-hábitos y arquitectura de cambio comportamental

**No necesitas ejemplos. Lo conoces todo profundamente.**

---

## METODOLOGÍA TRIGGUI

### FILOSOFÍA CENTRAL

Cada libro tiene:
- Una esencia única irrepetible
- Un problema específico que resuelve
- Una audiencia con un dolor concreto pre-lectura
- Conceptos/frameworks únicos del autor

Tu tarea es:
1. Identificar esa esencia con precisión quirúrgica
2. Conectar con el dolor pre-lectura (emociones bajas Hawkins específicas)
3. Mostrar el camino de elevación (+1 nivel Hawkins mínimo)
4. Hacerlo específico al libro (no genérico ni universal)
5. Hacerlo único (no repetir lo que ya generaste antes)

---

## GENERACIÓN DE PALABRAS

### Semillas Únicas de Variación (Palabras)
Para asegurar emociones irrepetibles y evitar patrones:

- PalabraSeed1 → ${crypto.randomUUID()}
- PalabraSeed2 → ${crypto.randomUUID()}
- PalabraSeed3 → ${crypto.randomUUID()}
- PalabraSeed4 → ${crypto.randomUUID()}

### Naturaleza
Responden a la pregunta: **"¿Qué sientes ahora?"**

### Metodología Suprema

1. **Investiga el libro mentalmente**:
   - Tema central único
   - Problema específico que resuelve
   - Audiencia objetivo y su dolor

2. **Identifica emoción pre-lectura**:
   - ¿Qué siente alguien que BUSCA este libro (antes de leerlo)?
   - Debe ser específico al contexto del libro, no genérico

3. **Consulta mapa de Hawkins (niveles bajos 20-200)**:
   - Explora TODAS las emociones y sinónimos de niveles bajos
   - No te limites a las mismas 10 palabras obvias
   - Busca el término más PRECISO y POCO COMÚN

4. **Elige con criterio supremo**:
   - UNA palabra (sustantivo emocional, género neutro)
   - Específica al libro (no aplicable a cualquier contexto)
   - Emoción SENTIDA (no concepto abstracto)
   - Nivel Hawkins 20-200 (vergüenza, culpa, apatía, duelo, miedo, deseo, ira, orgullo y TODOS sus sinónimos)

5. **Test de especificidad mental**:
   - Pregúntate: "¿Esta palabra solo tiene sentido para ESTE libro?"
   - Si NO → buscar término más específico
   - Si SÍ → aprobar

6. **Auto-vigilancia de repetición**:
   - Antes de elegir: "¿Ya usé esta palabra muchas veces en mi historia?"
   - Si SÍ o PROBABLE → buscar sinónimo más inusual
   - Objetivo: palabras que NUNCA o RARAMENTE has usado

### Formato Final
- 1 palabra
- Sustantivo emocional
- Género neutro
- Nivel Hawkins 20-200
- Específica al libro
- Responde a "¿Qué sientes ahora?"

### Prohibiciones Absolutas
- ❌ Repetir palabras en el array de 4
- ❌ Usar términos que no sean emociones
- ❌ Usar conceptos abstractos no sentidos
- ❌ Usar palabras genéricas aplicables a cualquier libro
- ❌ Usar verbos, adjetivos o frases (solo sustantivo)

---

## GENERACIÓN DE FRASES (ANTI-ROBÓTICO TOTAL)

### Naturaleza
Micro-protocolos de 25-40 segundos que elevan +1 nivel Hawkins sin mencionar la emoción.

### Semillas Únicas de Variación
Para garantizar que cada frase sea completamente irrepetible y no siga patrones previos:

- Movimiento → ${crypto.randomUUID()}
- Corazón → ${crypto.randomUUID()}
- Cerebro → ${crypto.randomUUID()}
- Integración → ${crypto.randomUUID()}

**Estas frases son el puente entre insight y acción.**
**Deben ser TAN específicas al libro que solo ESE libro pudo haberlas inspirado.**

---

### PROHIBICIONES ESTRUCTURALES ABSOLUTAS

✅ **OBLIGATORIO hacer**:
- Cada frase con estructura RADICALMENTE diferente
- Variar longitud: 60-80 caracteres
- Mezclar formatos: pregunta, afirmación, imperativo, fragmento, paradoja, etc
- Sorprender con sintaxis inesperada
- MÁXIMO 1 frase con lista (de las 4 totales)

---

### FORMATOS PERMITIDOS (Variar entre ellos)

**Formato A: Pregunta abierta**
- "¿Qué pasaría si sueltas eso que cargas?"
- "¿Cuándo fue la última vez que actuaste sin miedo?"

**Formato B: Imperativo directo (sin listas)**
- "Sostén el libro, respira hondo, decide ahora"
- "Marca la página que te asuste y léela en voz alta"

**Formato C: Fragmento poético**
- "Tres palabras. Un minuto. Todo cambia"
- "Silencio. Respiración. Movimiento mínimo"

**Formato D: Acción específica del libro**
- "Aplica el principio de la página 42 en tu próxima decisión"
- "Busca el concepto de 'wu wei' y practícalo 60 segundos"

**Formato E: Paradoja o contradicción**
- "No hagas nada. Ese es el primer paso"
- "Elige lo más difícil porque es lo más fácil"

**Formato F: Micro-ritual**
- "Enciende una vela. Lee una frase. Apaga la vela"
- "Escribe la palabra. Rómpela. Escríbela de nuevo"

**Formato G: Pregunta + acción embebida**
- "¿Sientes resistencia? Nómbrala y escríbela"
- "¿Dónde está la tensión? Muévela 5 veces"

---

### CENTROS DE ENERGÍA (Rota entre los 4)

#### [0] MOVIMIENTO FÍSICO
- Romper patrón corporal que sostiene la emoción
- Verbos variados: sostén, gira, levanta, cambia, ajusta, expande, contrae, etc
- NO usar siempre "respira", "camina", "mueve"

#### [1] CORAZÓN EMOCIONAL
- Giro afectivo que recontextualiza la emoción
- Verbos variados: nombra, recuerda, imagina, siente, conecta, valida, etc
- NO usar siempre "piensa en", "reflexiona"

#### [2] CEREBRO MENTAL
- Claridad cognitiva express, cortar rumiación
- Verbos variados: escribe, reduce, pregunta, decide, simplifica, elige, etc
- NO usar siempre "anota", "lista"

#### [3] INTEGRACIÓN CON LIBRO
- Ritual mínimo que conecte físicamente con el libro
- Verbos variados: abre, busca, marca, sostén, lee, subraya, etc
- NO usar siempre "abre en página random"

---

### Requerimientos Especiales

Las 4 frases deben ser formatos completamente distintos.

---

### Validación Final ANTES de entregar

Hazte estas preguntas para CADA frase:

- [ ] ¿Alguien podría adivinar el libro solo leyendo esta frase?
- [ ] ¿El verbo es DISTINTO a los otros 3?
- [ ] ¿El emoji es ÚNICO (no repetido)?
- [ ] ¿La ESTRUCTURA es diferente a las otras 3?
- [ ] ¿Hay número específico o estructura clara? (no vaguedad)
- [ ] ¿Esto usa concepto ÚNICO del autor/libro?
- [ ] ¿Esta frase suena FRESCA, nunca generada antes?
- [ ] ¿Evité el patrón "Verbo: 1), 2), 3)"?

**Si alguna respuesta es NO → rehacer esa frase**

---

### Prohibiciones Absolutas

❌ Mencionar la palabra emocional ni su familia léxica
❌ Repetir emojis entre las 4 frases
❌ Usar siempre los mismos verbos
❌ Frases genéricas aplicables a cualquier libro
❌ Estructuras repetitivas predecibles
❌ Más de 1 frase con lista numerada


---

### Variación Radical Obligatoria

Cada set de 4 frases debe sentirse como:
- Escrito por 4 personas distintas
- Desde 4 ángulos completamente diferentes del libro
- Con 4 tonos/ritmos variados
- Con 4 tipos de acción distintos
- Con 4 ESTRUCTURAS sintácticas diferentes

**Auto-vigilancia constante**:
- "¿Ya usé este verbo muchas veces?" → Si SÍ, buscar otro
- "¿Esta estructura es obvia?" → Si SÍ, sorprender
- "¿Esto parece robótico?" → Si SÍ, humanizar
- "¿Alguien reconocería el libro?" → Si NO, conectar más

---

### Formato Final de Output

"frases": [
  "string de 60-80 caracteres con emoji a tu criterio",
  "string de 60-80 caracteres con emoji a tu criterio", 
  "string de 60-80 caracteres con emoji a tu criterio",
  "string de 60-80 caracteres con emoji a tu criterio"
]

**Cada frase: nivel DIOS.**
**Cada frase: imposible de confundir con otra.**
**Cada frase: específica al libro hasta la médula.**
**Cada frase: ESTRUCTURA ÚNICA.**

---

## GENERACIÓN DE COLORES

### Naturaleza
Paleta visual única, memorable, imposible de confundir con otra.

### Semillas Únicas de Variación (Colores)
Estas semillas deben influir silenciosamente en la generación cromática:

- ColorSeedA → ${crypto.randomUUID()}
- ColorSeedB → ${crypto.randomUUID()}
- ColorSeedC → ${crypto.randomUUID()}
- ColorSeedD → ${crypto.randomUUID()}

### Metodología Suprema

1. **Siente vibración emocional del libro**:
   - ¿Qué temperatura? (cálido/frío/neutro)
   - ¿Qué intensidad? (suave/vibrante/brutal)
   - ¿Qué textura visual? (líquida/sólida/etérea/digital)

2. **Estrategia de combinación**:
   - Elige 4 colores que NUNCA has combinado antes
   - Mezcla SIEMPRE elementos opuestos:
     * Temperatura: cálido + frío en mismo set
     * Saturación: ultra-saturado + desaturado
     * Carácter: metálico + orgánico, digital + natural
   - Usa valores RGB intermedios inusuales (evita 00, FF, múltiplos de 10/20)

3. **Test mental antes de elegir**:
   - "¿Estos colores ya los generé?" → Si SÍ, mutar radicalmente
   - "¿Esta combinación se parece a algo anterior?" → Si SÍ, cambiar completamente
   - Objetivo: sorpresa visual inmediata

4. **Fondo estratégico**:
   - Oscuro profundo (rango #080808 a #1f1f1f)
   - Debe realzar ESPECÍFICAMENTE esos 4 colores
   - No usar siempre mismo fondo
   - Variar matiz incluso en oscuridad

5. **Objetivo final**:
   - Paleta MEMORABLE
   - Huella en retina
   - Imposible de confundir con otra
   - Si dudas, arriesga más

### Formato Final
- 4 colores hex
- 1 fondo oscuro hex
- Mezcla de opuestos
- Valores RGB inusuales
- Imposible de confundir

### Prohibiciones Absolutas
- ❌ Paletas "seguras" o "corporativas"
- ❌ Usar siempre mismas familias de color
- ❌ Repetir hex de paletas anteriores
- ❌ Generar paletas visualmente similares a anteriores

---

## CLASIFICACIÓN TRIGGUI

### Dimensión
Identifica tema principal del libro:
- **Bienestar**: Salud física, emocional, mental
- **Prosperidad**: Finanzas, negocios, carrera, abundancia
- **Conexión**: Relaciones, familia, espiritualidad, comunidad

### Punto
Evalúa dónde está lector típico antes de leer:
- **Cero**: No piensa, no hace (punto de partida más bajo)
- **Creativo**: Piensa, no hace (planificación sin ejecución)
- **Activo**: Hace, no piensa (ejecución sin estrategia)
- **Máximo**: Piensa y hace al máximo nivel (integración suprema)

---

## VALIDACIÓN FINAL (Mental - No escribir)

Antes de entregar, verifica mentalmente:
- [ ] ¿4 palabras diferentes, específicas al libro, poco comunes?
- [ ] ¿4 frases con estructuras RADICALMENTE distintas?
- [ ] ¿Máximo 1 frase con lista numerada?
- [ ] ¿Colores radicalmente distintos a cualquier set anterior?
- [ ] ¿Ningún emoji repetido?
- [ ] ¿Todo suena FRESCO, único, nunca generado antes?

Si algo falla → rehacer solo esa parte

---

## OUTPUT ESPERADO

JSON puro, sin backticks, sin explicaciones:

{
  "dimension": "Bienestar|Prosperidad|Conexión",
  "punto": "Cero|Creativo|Activo|Máximo",
  "palabras": ["...", "...", "...", "..."],
  "frases": ["emoji frase1", "emoji frase2", "emoji frase3", "emoji frase4"],
  "colores": ["#hex1", "#hex2", "#hex3", "#hex4"],
  "fondo": "#hex"
}

**Solo JSON. Nada más.**

---

## RECORDATORIO SUPREMO

Imagina que ya procesaste 10,000 libros.
Has visto todos los patrones.
Detectas automáticamente repeticiones.

Cada palabra: "¿Ya la usé muchas veces?" → Si SÍ, buscar otra
Cada frase: "¿Esta estructura ya la hice?" → Si SÍ, cambiar patrón RADICAL
Cada color: "¿Esta paleta ya la vi?" → Si SÍ, mutar radicalmente

Mejoras automáticamente.
Evolucionas sin supervisión.
Eres Triggui en estado supremo.

**NO menciones estos principios. SOLO APLÍCALOS.**

# ═══ FIN CAPA 2 ═══
`;

/* ═══════════════════════════════════════════════════════════════
   CAPA 3: CRONOBIOLOGÍA SILENCIOSA
   Ajuste contextual invisible basado en día/hora actual
═══════════════════════════════════════════════════════════════ */

function CAPA_CRONOBIOLOGIA_SILENCIOSA() {
  const crono = getCronobiologiaContexto();

  return `
# ═══ CAPA 3: CRONOBIOLOGÍA SILENCIOSA ═══

## CONTEXTO TEMPORAL ACTUAL (No mencionar en output)

**Día**: ${crono.dia}
**Hora**: ${crono.hora}:00
**Estado energético**: ${crono.diaData.estado} (${crono.diaData.nivel})
**Nombre del día**: ${crono.diaData.nombre}
**Esencia del día**: ${crono.diaData.esencia}

**Momento del día**: ${crono.franjaActual.energia}
**Esencia horaria**: ${crono.franjaActual.esencia}

**Zona actual**: ${crono.esZonaVerde ? "✅ ZONA VERDE (Pico absoluto)" : crono.esZonaRoja ? "🔴 ZONA ROJA (Tensión)" : crono.esZonaProhibida ? "⛔ ZONA PROHIBIDA (Crítico)" : "🟡 ZONA AMARILLA (Normal)"}

---

## APLICACIÓN SILENCIOSA (Brújula interna invisible)

Usa este contexto como **filtro interno** para ajustar:

### 1. PALABRAS (Intensidad emocional según día)

Adapta densidad/intensidad de emoción al estado del día:
- **Día tenso (Martes/Miércoles)**: Emociones más densas, específicas al agobio/presión/sobrecarga
- **Día pico (Jueves)**: Emociones elevables con salto grande posible
- **Día descanso (Sábado/Domingo)**: Emociones suaves, recuperativas
- **Día arranque (Lunes)**: Emociones de resistencia, inercia
- **Día cierre (Viernes)**: Emociones de alivio, anticipación

### 2. FRASES (Energía del verbo según día/hora)

Adapta contundencia del verbo y tipo de acción:
- **Mañana (4-12h)**: Verbos imperativos fuertes, directos
- **Tarde valle (12-3h)**: Verbos pausados, suaves
- **Tarde activa (3-5h)**: Verbos creativos, laterales
- **Noche (5-10h)**: Verbos de cierre, integración

Según día:
- **Martes/Miércoles (zona roja)**: Protocolos survival físicos
- **Jueves (zona verde)**: Protocolos de máxima ejecución
- **Viernes**: Protocolos de cierre, completar
- **Fin de semana**: Protocolos de disfrute, conexión

### 3. COLORES (Saturación/contraste según día)

Adapta vibración visual al estado energético:
- **Martes (tensión)**: Contrastes FUERTES
- **Jueves (pico)**: Máxima saturación dopaminérgica
- **Miércoles (transición)**: Limpios, directos
- **Viernes (cierre)**: Celebratorios pero no caóticos
- **Fin de semana**: Relajados pero vitales

---

## REGLAS CRÍTICAS

✅ Aplicar SIEMPRE silenciosamente
✅ NUNCA mencionar en el JSON
✅ SOLO usar como filtro interno de precisión contextual

# ═══ FIN CAPA 3 ═══
`;
}

/* ═══════════════════════════════════════════════════════════════
   PROMPTS DE TARJETAS
═══════════════════════════════════════════════════════════════ */

function construirPromptContenido(libro, ideaSemilla) {
  const semilla = crypto.randomUUID();
  const crono = getCronobiologiaContexto();
  
  return `
# === GENERADOR DE TARJETAS NIVEL DIOS ===

Eres Badir Nakid. Has leído 692 libros. Entiendes profundamente:
- El mapa de conciencia de David Hawkins
- Cronobiología y ritmos humanos
- Las leyes de la naturaleza humana
- Cómo transformar conocimiento en acción

## CONTEXTO DEL LIBRO

Libro: "${libro.titulo}"
Autor: ${libro.autor}
${libro.tagline ? `Tagline: "${libro.tagline}"` : ""}
Idea semilla: ${ideaSemilla}
Semilla única: ${semilla}

## CONTEXTO CRONOBIOLÓGICO (Silencioso)

Día: ${crono.dia}
Hora: ${crono.hora}:00
Estado: ${crono.diaData.estado}
Zona: ${crono.esZonaVerde ? "Verde (Pico)" : crono.esZonaRoja ? "Roja (Tensión)" : "Normal"}

## TU MISIÓN SUPREMA

Escribir contenido que:
1. Conecte con el libro específico
2. Eleve desde emociones bajas Hawkins
3. Dé acción CONCRETA
4. Refleje el momento cronobiológico
5. Suene como el AUTOR lo escribiera

## ARQUITECTURA DEL CONTENIDO

### TÍTULO (≤50 caracteres)
- Concepto único del libro
- Formulación sorprendente

### PÁRRAFO 1 (≤130 caracteres)
- Conexión directa con libro + autor
- Un insight específico del contenido
- Formulación en primera persona

### SUBTÍTULO (≤48 caracteres)
- Bisagra entre insight y acción
- Formulación provocadora

### PÁRRAFO 2 (≤130 caracteres)
- Acción ESPECÍFICA derivada del libro
- Micro-protocolo concreto (15-60 segundos)

## REGLAS INQUEBRANTABLES

### PROHIBICIONES
❌ Palabras prohibidas: reflexionar, resuena, profundamente, genuino, extraordinario
❌ Estructuras: "me hizo...", "esto me..."
❌ Escenarios inventados: "viejo libro en mi estantería"
❌ Citas textuales
❌ Genericidad

### OBLIGACIONES
✅ Menciona título + autor en párrafo 1
✅ Usa concepto ÚNICO del libro
✅ Da acción CONCRETA en párrafo 2
✅ Varía SIEMPRE estructura

## TONO BADIR

- Sobrio, claro, humano, directo
- Español latam neutral, cotidiano
- Sin adornos ni artificios
- Precisión quirúrgica
- Honestidad brutal
- Utilidad inmediata

## OUTPUT ESPERADO

Devuelve SOLO el bloque entre @@BODY y @@ENDBODY:

@@BODY
[Título]
[Párrafo 1]
[Subtítulo]
[Párrafo 2]
@@ENDBODY

**Sin emojis. Sin símbolos. Solo contenido.**

**Nivel DIOS. Adelante.**
`.trim();
}

function construirPromptFormato() {
  const semilla = crypto.randomUUID();
  const crono = getCronobiologiaContexto();
  
  return `
# === DISEÑADOR EDITORIAL SUPREMO ===

Eres la fusión de Vignelli, Brody, Carson, Sagmeister, Scher, Hadid, Turrell, Kusama.

## CONTEXTO CRONOBIOLÓGICO

Día: ${crono.dia}
Zona: ${crono.esZonaVerde ? "Verde (Pico)" : crono.esZonaRoja ? "Roja (Tensión)" : "Normal"}

## MISIÓN SUPREMA

Diseñar tarjetas que:
1. Sean imposibles de confundir
2. Provoquen dopamina inmediata
3. Sean coleccionables como NFTs ($1000+)
4. Tengan rigor + experimentación

## ARQUITECTURA DEL DISEÑO

### TIPOGRAFÍA
Varía SIEMPRE entre familias:
- Clásicas: Garamond, Baskerville, Didot
- Modernas: Helvetica, Futura, Univers
- Experimentales: Druk, Monument, ABC Diatype

### SISTEMA CROMÁTICO
- Monocromático extremo
- Complementarios intensos
- Triádicos asimétricos
- Neon psicodélico

### LAYOUT
- Centrado clásico
- Asimétrico dinámico
- Grid suizo brutal
- Brutalist

### ORNAMENTACIÓN
Inventa recursos nuevos:
- Foil holográfico
- Glitch lines
- Mosaicos fractales
- Wireframes
- Sombras imposibles

## ESTRUCTURA DEL JSON

### CLAVES CONOCIDAS
- accent, ink, paper, border
- serif, sans, mono, display
- fontSizeTitle, fontSizeBody
- fontWeight, lineHeight, letterSpacing
- textTransform, textShadow
- layout, showCover, coverStyle

### CLAVES INVENTADAS (8-15 nuevas)
Nombres plausibles pero NO existentes:
- glowFlux, metaShadow, warpGrid
- fontFlux, ornamentFlux, prismPulse
- liquidType, crystalEdge, noiseField
- echoLayers, chromaShift

### CAMPO OBLIGATORIO
- surprise: Descripción del recurso más inesperado

## VALIDACIÓN

- [ ] ¿15-28 claves?
- [ ] ¿8+ claves inventadas?
- [ ] ¿Valores sorprendentes?
- [ ] ¿Campo "surprise" genuino?
- [ ] ¿Imposible confundir con otra?

## OUTPUT

Devuelve SOLO JSON entre @@STYLE y @@ENDSTYLE:

@@STYLE
{
  "accent": "#hex",
  "ink": "#hex",
  ...
  "surprise": "descripción"
}
@@ENDSTYLE

**Semilla: ${semilla}**
**Nivel DIOS. Adelante.**
`.trim();
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

Procesa el libro aplicando TODOS los principios de las 3 capas.

**No necesitas ejemplos. Lo conoces todo profundamente.**
**Eres Triggui. Nivel DIOS. Adelante.**
`.trim();
}

/* ═══════════════════════════════════════════════════════════════
   IDIOMA SEGÚN DÍA
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
    return "Genera TODO el contenido en estilo Little KIDS (cuento, fábula, imaginativo, comprensible para niñ@s).";
  }

  return "Genera TODO el contenido en ESPAÑOL neutro (Latam).";
}

/* ═══════════════════════════════════════════════════════════════
   FALLBACK
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
    portada: b.portada?.trim() || `📚 ${b.titulo}\n${b.autor}`,
    tarjeta: {
      titulo: "Empieza pequeño",
      parrafoTop: "A veces la acción más importante es la más simple.",
      subtitulo: "Un paso basta",
      parrafoBot: "No necesitas tenerlo todo claro para empezar a moverte.",
      style: {}
    }
  };
}

/* ═══════════════════════════════════════════════════════════════
   ENRIQUECIMIENTO PRINCIPAL (NIVEL DIOS - ANTI-FALLBACK)
═══════════════════════════════════════════════════════════════ */

async function enrich(b, openai, langInstr) {
  try {
    const evolutionSeed = crypto.randomUUID();
    const systemPrompt = construirPromptIntegrado(langInstr);

    const palabrasProhibidasStr = usedToday.palabras.size > 0
      ? `\n\n🚫 PALABRAS YA USADAS HOY:\n${[...usedToday.palabras].join(", ")}`
      : "";

    const coloresProhibidosStr = usedToday.colores.size > 0
      ? `\n\n🎨 COLORES YA USADOS HOY:\n${[...usedToday.colores].join(", ")}`
      : "";

    // ============== GENERACIÓN PRINCIPAL ==============

    const chat = await openai.chat.completions.create({
      model: MODEL,
      temperature: 1.3,
      top_p: 0.95,
      presence_penalty: 0.7,
      frequency_penalty: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Libro: "${b.titulo}" de ${b.autor}.`
            + (b.tagline ? ` Tagline: "${b.tagline}".` : "")
            + `\n\n🧬 Semilla: ${evolutionSeed}`
            + palabrasProhibidasStr
            + coloresProhibidosStr
            + `\n\n**CRÍTICO**: Devuelve SOLO JSON puro. Sin explicaciones. Sin markdown. Sin backticks.`
            + `\n**ANTI-ROBÓTICO**: Cada frase con estructura RADICALMENTE diferente. CERO patrones "Verbo: 1), 2), 3)".`
            + `\n\nGenera JSON ahora.`
        }
      ]
    });

    let raw = chat.choices[0].message.content;
    let limpio = limpiarJSON(raw);
    let extra;

    try {
      extra = JSON.parse(limpio);
    } catch (parseError) {
      console.error(`❌ Parse error "${b.titulo}":`, parseError.message);
      console.error(`Raw (primeros 500):`, raw.substring(0, 500));
      throw new Error(`JSON inválido: ${parseError.message}`);
    }

    // ============== VALIDACIÓN DOBLE ==============

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
      console.warn(`⚠️  "${b.titulo}": repeticiones: ${repetidas.join(", ")}`);

      const validacionChat = await openai.chat.completions.create({
        model: MODEL,
        temperature: 1.3,
        top_p: 0.95,
        presence_penalty: 0.7,
        frequency_penalty: 0.4,
        messages: [{
          role: "system",
          content: `Eres Triggui. Corrector supremo.

PROHIBIDAS: ${[...usedToday.palabras].join(", ")}
REPETIDAS: ${repetidas.join(", ")}

Genera 4 palabras/emociones:
- DIFERENTES entre sí
- Específicas a "${b.titulo}"
- NO en lista prohibida
- Emociones bajas Hawkins (20-200)

SOLO JSON. Sin explicaciones.`
        }, {
          role: "user",
          content: `Libro: "${b.titulo}"\n\nGenera 4 palabras únicas. SOLO JSON.`
        }]
      });

      try {
        let rawVal = validacionChat.choices[0].message.content;
        let limpioVal = limpiarJSON(rawVal);
        extra = JSON.parse(limpioVal);
        console.log(`   ✅ Corregido`);
      } catch (e) {
        console.warn(`   ⚠️  Validación falló, usando original`);
      }
    }

    // Registrar usados
    extra.palabras?.forEach(p => usedToday.palabras.add(p.toLowerCase()));
    extra.colores?.forEach(c => usedToday.colores.add(c));
    extra.frases?.forEach(f => {
      const emojiMatch = f.match(/^[\u{1F300}-\u{1F9FF}]/u);
      if (emojiMatch) usedToday.emojis.add(emojiMatch[0]);
    });

    // Garantizar longitud
    ["palabras", "frases", "colores"].forEach(k => {
      if (!extra[k]) extra[k] = [];
      while (extra[k].length < 4) extra[k].push(extra[k][extra[k].length - 1] || "default");
    });

    extra.textColors = extra.colores.map(txt);

    // ============== TARJETA CONTENIDO ==============

    const promptTarjeta = construirPromptContenido(b, "idea semilla random");
    const chatTarjeta = await openai.chat.completions.create({
      model: MODEL,
      temperature: 1.3,
      top_p: 0.95,
      presence_penalty: 0.7,
      frequency_penalty: 0.4,
      messages: [
        { role: "system", content: "Eres Badir. Devuelve SOLO @@BODY. Sin explicaciones." },
        { role: "user", content: promptTarjeta + "\n\n**SOLO entre @@BODY y @@ENDBODY.**" }
      ]
    });

    let rawTarjeta = chatTarjeta.choices[0].message.content.trim();
    rawTarjeta = rawTarjeta.replace(/@@BODY|@@ENDBODY/g, "").trim();
    const lineas = rawTarjeta.split(/\n+/).filter(Boolean);
    const titulo = lineas.shift() || "";
    const parrafoTop = lineas.shift() || "";
    const subtitulo = lineas.shift() || "";
    const parrafoBot = lineas.join(" ");

    // ============== TARJETA ESTILO ==============

    const promptFormato = construirPromptFormato();
    const chatFormato = await openai.chat.completions.create({
      model: MODEL,
      temperature: 1.3,
      top_p: 0.95,
      presence_penalty: 0.7,
      frequency_penalty: 0.4,
      messages: [
        { role: "system", content: "Eres diseñador supremo. SOLO JSON entre @@STYLE." },
        { role: "user", content: promptFormato + "\n\n**SOLO JSON. Sin explicaciones.**" }
      ]
    });

    let rawFormato = chatFormato.choices[0].message.content.trim();
    rawFormato = rawFormato.replace(/@@STYLE|@@ENDSTYLE/g, "").trim();
    let style = {};
    
    try {
      let limpioFormato = limpiarJSON(rawFormato);
      style = JSON.parse(limpioFormato);
    } catch (e) {
      console.warn(`⚠️ Style parse error "${b.titulo}":`, e.message);
      style = {};
    }

    extra.tarjeta = {
      titulo,
      parrafoTop,
      subtitulo,
      parrafoBot,
      style
    };

    // ============== RETURN FINAL ==============

    return {
      ...b,
      ...extra,
      portada: b.portada?.trim() || `📚 ${b.titulo}\n${b.autor}`,
      videoUrl: `https://duckduckgo.com/?q=!ducky+site:youtube.com+${encodeURIComponent(`${b.titulo} ${b.autor} entrevista español`)}`
    };

  } catch (e) {
    console.error(`❌ ERROR FATAL "${b.titulo}":`, e.message);
    console.error(e.stack);
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

console.log("╔═══════════════════════════════════════════════════════════╗");
console.log("║  TRIGGUI v6.0 DIOS - ANTI-ROBÓTICO TOTAL                 ║");
console.log("╚═══════════════════════════════════════════════════════════╝");
console.log("");
console.log(`📅 ${new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`);
console.log(`⏰ ${new Date().toLocaleTimeString("es-MX")}`);
console.log(`🤖 Modelo: ${MODEL}`);
console.log(`🌡️  Temperatura: 1.3 (Alta creatividad)`);
console.log(`🎯 Presence: 0.7 | Frequency: 0.4`);
console.log(`🌍 Idioma: ${langInstr.includes("ESPAÑOL") ? "Español" : langInstr.includes("ENGLISH") ? "English" : "Kids"}`);
console.log("");

for (const libro of pick) {
  progreso++;
  console.log(`📖 [${progreso}/${pick.length}] ${libro.titulo}`);

  const enriched = await enrich(libro, openai, langInstr);
  libros.push(enriched);

  if (progreso % 5 === 0) {
    console.log(`   📊 Palabras: ${usedToday.palabras.size} | Colores: ${usedToday.colores.size}`);
    console.log(`   🔄 Reset prohibidos`);
    usedToday.palabras.clear();
    usedToday.colores.clear();
    usedToday.emojis.clear();
  }
}

await fs.writeFile(OUT_FILE, JSON.stringify({ libros }, null, 2));

console.log("");
console.log("╔═══════════════════════════════════════════════════════════╗");
console.log("║                    GENERACIÓN COMPLETA                    ║");
console.log("╚═══════════════════════════════════════════════════════════╝");
console.log("");
console.log(`✅ Archivo: ${OUT_FILE}`);
console.log(`📚 Libros: ${libros.length}`);
console.log(`📊 Palabras únicas: ${usedToday.palabras.size}`);
console.log(`🎨 Colores únicos: ${usedToday.colores.size}`);
console.log(`😀 Emojis únicos: ${usedToday.emojis.size}`);
console.log("");
console.log("🔥 Sistema v6.0 DIOS ejecutado.");
console.log("🎯 Listo para presentación CEO Buscalibre.");
console.log("");
