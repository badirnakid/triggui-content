/* ══════════════════════════════════════════════════════════════════════════
   TRIGGUI · GOD MODE BUILDER v7.0
   Concepto: Minimalismo Radical + Contexto Denso
   Autor: Badir Nakid (Refactorizado por Gemini)
   ══════════════════════════════════════════════════════════════════════════ */

import fs from "node:fs/promises";
import { parse } from "csv-parse/sync";
import OpenAI from "openai";
import crypto from "node:crypto";

// --- CONFIGURACIÓN & ESTADO GLOBAL ---
const CONFIG = {
  apiKey: process.env.OPENAI_KEY,
  model: "gpt-4o-mini",
  fileIn: "data/libros_master.csv",
  fileOut: "contenido.json",
  limit: 20, // Cantidad de libros a procesar
  temp: 1.1  // Creatividad controlada
};

// Estado en memoria para evitar repeticiones en la ejecución actual
const sessionState = { words: new Set(), colors: new Set(), emojis: new Set() };

if (!CONFIG.apiKey) { console.error("❌ Falta OPENAI_KEY"); process.exit(1); }
const openai = new OpenAI({ apiKey: CONFIG.apiKey });

// --- UTILIDADES (MATH & HELPERS) ---
const utils = {
  // Calcula luminancia para determinar color de texto (Blanco/Negro)
  txtColor: (hex) => {
    const rgb = hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255);
    const lum = rgb.map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const L = 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2];
    return L > 0.35 ? "#000000" : "#FFFFFF";
  },
  shuffle: (arr) => arr.sort(() => Math.random() - 0.5),
  cleanJson: (str) => str.replace(/```json|```/g, "").trim(),
  
  // Lógica Cronobiológica Condensada
  getContexto: () => {
    const date = new Date();
    const h = date.getHours();
    const days = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    const dayName = days[date.getDay()];
    
    // Mapa de energía
    const energyMap = {
      lunes: "Ascendente (Arquitectura)", martes: "Tensión (Survival)", miércoles: "Transición (Purga)",
      jueves: "PICO MÁXIMO (Dios)", viernes: "Cierre (Flow)", sábado: "Desconexión", domingo: "Reset"
    };
    
    // Mapa horario
    let timeEnergy = "Sueño";
    if (h >= 4 && h < 9) timeEnergy = "Claridad de Oro";
    else if (h >= 9 && h < 14) timeEnergy = "Ejecución Crítica";
    else if (h >= 14 && h < 19) timeEnergy = "Creatividad/Conexión";
    else if (h >= 19) timeEnergy = "Cierre/Melatonina";

    return { day: dayName, energy: energyMap[dayName], timeZone: timeEnergy };
  },

  // Genera URL de búsqueda de video
  getVideoUrl: (book, author) => 
    `https://duckduckgo.com/?q=!ducky+site:youtube.com+${encodeURIComponent(`${book} ${author} entrevista español`)}`
};

// --- EL CEREBRO (PROMPT ENGINEERING) ---
const buildSystemPrompt = (crono) => `
ERES TRIGGUI: IA Editorial Nivel Dios. Tu objetivo es transformar libros en experiencias viscerales.
CONTEXTO ACTUAL: Día: ${crono.day} | Energía: ${crono.energy} | Momento: ${crono.timeZone}.
IDIOMA: Español Neutro (Latam).

TUS REGLAS INQUEBRANTABLES (Lógica Interna):
1. HAWKINS: Las 'palabras' deben ser emociones de nivel bajo (20-200: Miedo, Deseo, Ira, Orgullo) que el libro resuelve.
2. CRONOBIOLOGÍA: Ajusta la intensidad de las frases a la energía de hoy (${crono.energy}).
3. ANTI-ROBOT: Variación sintáctica total. Prohibido repetir estructuras "Verbo + objeto".
4. DISEÑO: Genera una paleta de 4 colores + fondo que sea visualmente impactante y única.

FORMATO DE SALIDA (JSON estricto, sin markdown):
{
  "dimension": "Bienestar | Prosperidad | Conexión",
  "punto": "Cero (Inmóvil) | Creativo (Ideas) | Activo (Ejecución) | Máximo (Flow)",
  "palabras": ["Sustantivo1", "Sustantivo2", "Sustantivo3", "Sustantivo4"],
  "frases": ["Emoji Frase1 (Acción/Pregunta)", "Emoji Frase2 (Ritual)", "Emoji Frase3 (Paradoja)", "Emoji Frase4 (Insight)"],
  "colores": ["#hex1", "#hex2", "#hex3", "#hex4"],
  "fondo": "#hexDark",
  "tarjeta": {
    "titulo": "Concepto único (Max 50 chars)",
    "parrafoTop": "Insight del libro en 1a persona (Max 130 chars)",
    "subtitulo": "Call to action provocador (Max 48 chars)",
    "parrafoBot": "Micro-acción de 30seg (Max 130 chars)",
    "style": { "description": "JSON libre con claves de diseño editorial (font, layout, effects)" }
  }
}`;

// --- CORE: PROCESAMIENTO DE LIBRO ---
async function processBook(book) {
  const crono = utils.getContexto();
  const seed = crypto.randomUUID().split('-')[0]; // Semilla corta para variedad
  
  // Lista negra dinámica para evitar repeticiones en esta sesión
  const bannedWords = Array.from(sessionState.words).slice(-20).join(", "); 
  const bannedColors = Array.from(sessionState.colors).slice(-10).join(", ");

  const prompt = `
  LIBRO: "${book.titulo}" de ${book.autor}. ${book.tagline || ""}
  SEMILLA: ${seed}
  
  ⛔ PROHIBIDO USAR ESTAS PALABRAS (Ya usadas hoy): ${bannedWords || "Ninguna"}
  ⛔ PROHIBIDO USAR ESTOS COLORES: ${bannedColors || "Ninguno"}
  
  Genera el JSON definitivo.`;

  try {
    const completion = await openai.chat.completions.create({
      model: CONFIG.model,
      temperature: CONFIG.temp,
      response_format: { type: "json_object" }, // Forzamos JSON válido nativo
      messages: [
        { role: "system", content: buildSystemPrompt(crono) },
        { role: "user", content: prompt }
      ]
    });

    // Parsing y Post-Procesamiento
    const rawData = JSON.parse(completion.choices[0].message.content);
    
    // Calcular colores de texto automáticos
    const textColors = rawData.colores.map(c => utils.txtColor(c));
    
    // Registrar usados para la siguiente iteración (Anti-repeteción viva)
    rawData.palabras.forEach(w => sessionState.words.add(w.toLowerCase()));
    rawData.colores.forEach(c => sessionState.colors.add(c));

    return {
      titulo: book.titulo,
      autor: book.autor,
      portada: book.portada || "https://via.placeholder.com/626x1000",
      tagline: book.tagline,
      ...rawData,
      textColors, // Calculado aquí, no gastamos tokens de IA
      videoUrl: utils.getVideoUrl(book.titulo, book.autor)
    };

  } catch (error) {
    console.error(`⚠️ Error con "${book.titulo}":`, error.message);
    // Fallback minimalista en caso de error de API
    return {
      titulo: book.titulo,
      autor: book.autor,
      error: true,
      fallback: "Reintentar manual"
    };
  }
}

// --- MAIN LOOP ---
(async () => {
  console.log(`🚀 TRIGGUI v7.0 START | ${utils.getContexto().day.toUpperCase()}`);
  
  try {
    const csvData = await fs.readFile(CONFIG.fileIn, "utf8");
    const books = utils.shuffle(parse(csvData, { columns: true })).slice(0, CONFIG.limit);
    
    const resultados = [];
    
    // Procesamos en serie para mantener el contexto de "no repetir" vivo y actualizado
    for (const [i, book] of books.entries()) {
      process.stdout.write(`📚 [${i + 1}/${books.length}] Procesando: ${book.titulo.substring(0, 20)}... `);
      const result = await processBook(book);
      resultados.push(result);
      console.log(result.error ? "❌" : "✅");
    }

    await fs.writeFile(CONFIG.fileOut, JSON.stringify({ libros: resultados }, null, 2));
    console.log(`\n✨ Éxito Total. Archivo ${CONFIG.fileOut} generado.`);
    
  } catch (e) {
    console.error("\n💥 Error Fatal:", e);
  }
})();
