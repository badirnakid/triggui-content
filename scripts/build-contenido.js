/* ────────────────────────────────────────────────────────────────
   Genera contenido.json con 10 libros elegidos al azar.
   - GPT-4o-mini deduce dimensión, palabras, frases y colores.
   - Calcula textColor (#000/#FFF) para legibilidad en cada bloque.
   - Si la IA falla (rate-limit, quota, etc.) aplica fallback digno.
   by Triggui · La chispa que inicia la lectura
───────────────────────────────────────────────────────────────── */

import fs from "node:fs/promises";
import { parse } from "csv-parse/sync";
import OpenAI from "openai";

/* 1. Leer CSV   ------------------------------------------------- */
const csv = await fs.readFile("data/libros_master.csv", "utf8");
const books = parse(csv, { columns: true, skip_empty_lines: true });

/* 2. Salir si no hay OPENAI_KEY   ------------------------------ */
if (!process.env.OPENAI_KEY) {
  console.log("🔕  Sin OPENAI_KEY → se conserva contenido.json existente.");
  process.exit(0);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

/* 3. Utils – contrast textColor (#fff / #000) ------------------- */
function luminance(hex) {
  const rgb = hex.replace("#", "").match(/.{2}/g).map(x => parseInt(x, 16) / 255);
  const a = rgb.map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
function textColor(bg) {
  return luminance(bg) > 0.35 ? "#000000" : "#FFFFFF";
}

/* 4. Prompt & enriquecimiento ---------------------------------- */
async function enrich(b) {
  const prompt = `
Eres Triggui, generador de activadores de lectura.
Devuelve SOLO el JSON solicitado, sin backticks ni comentario.

Libro: "${b.titulo}" de ${b.autor}

{
 "dimension":                // Bienestar, Prosperidad o Conexión
 "palabras":  [              // 4 palabras (1-2 sílabas máx.) que respondan “¿Qué sientes?” y se relacionen con el libro
 ],
 "frases":    [              // 4 frases ≤60 caracteres, cada una comienza con un emoji distinto. Energéticamente suben al usuario en el mapa Hawkins.
 ],
 "colores":   [              // 4 códigos hex vibrantes (uno por bloque)
 ],
 "fondo":     "#000000-#222222"   // hex oscuro que combine
}
`;
  try {
    const chat = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [{ role: "user", content: prompt }]
    });

    /* limpiar posible ```json ... ``` */
    let raw = chat.choices[0].message.content.trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/```[\s\S]*?\n/, "").replace(/```$/, "");
    }
    const extra = JSON.parse(raw);

    /* añadir textColor para cada bloque */
    extra.textColors = extra.colores.map(c => textColor(c));
    return {
      ...b,
      ...extra,
      portada: `📚 ${b.titulo}\n${b.autor}`
    };
  } catch (err) {
    console.warn(`⚠️  Fallback ${b.titulo}:`, err.code || err.message);
    return fallback(b);
  }
}

/* 5. Fallback simplificado ------------------------------------- */
function fallback(book) {
  const baseCols = ["#ff9a9e", "#fad0c4", "#a18cd1", "#fbc2eb"];
  return {
    ...book,
    dimension: "Bienestar",
    palabras: ["Lectura", "Impulso", "Página", "Acción"],
    frases: [
      "📖 Una línea y empieza todo.",
      "🚀 Abre y respira papel.",
      "✨ Toca la página correcta.",
      "⏳ El tiempo es ahora."
    ],
    colores: baseCols,
    textColors: baseCols.map(textColor),
    fondo: "#111111",
    portada: `📚 ${book.titulo}\n${book.autor}`
  };
}

/* 6. Elegir 10 y procesar -------------------------------------- */
const pick = books.sort(() => Math.random() - 0.5).slice(0, 10);
const libros = await Promise.all(pick.map(enrich));

await fs.writeFile("contenido.json", JSON.stringify({ libros }, null, 2));
console.log("✅ contenido.json generado:", libros.length, "libros");
