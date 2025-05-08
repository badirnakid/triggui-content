/* -------------- build-contenido.js ---------------------------------
   Genera contenido.json con 10 libros aleatorios desde un CSV simple.
   - Si OPENAI_KEY no existe → conserva el JSON anterior (sale OK).
   - Si existe pero OpenAI responde error → usa fallback y continúa.
--------------------------------------------------------------------- */

import fs from "node:fs/promises";
import { parse } from "csv-parse/sync";
import OpenAI from "openai";

const OPENAI_KEY = process.env.OPENAI_KEY;

/* -- 1. Leer lista CSV -------------------------------------------- */
const csvText = await fs.readFile("data/libros_master.csv", "utf8");
const master = parse(csvText, { columns: true, skip_empty_lines: true });

/* -- 2. Si no hay clave IA → salir sin tocar JSON ----------------- */
if (!OPENAI_KEY) {
  console.log("🔕  No OPENAI_KEY → se conserva contenido.json existente.");
  process.exit(0);
}

const openai = new OpenAI({ apiKey: OPENAI_KEY });

/* -- 3. Elegir hasta 10 libros al azar ---------------------------- */
const pick = master.sort(() => Math.random() - 0.5).slice(0, 10);

/* -- 4. Función fallback genérica --------------------------------- */
function fallback(book, reason) {
  console.warn("⚠️  Fallback:", reason);
  return {
    ...book,
    dimension: "Bienestar",
    palabras: ["Lectura", "Impulso", "Página", "Acción"],
    frases: [
      "📖 Una línea basta para empezar.",
      "🚀 Abre y todo comienza.",
      "✨ La página correcta es la que toques.",
      "⏳ Un minuto real de lectura."
    ],
    colores: ["#ff9a9e", "#fad0c4", "#a18cd1", "#fbc2eb"],
    fondo: "#111111",
    portada: `📚 ${book.titulo}\n${book.autor}`
  };
}

/* -- 5. Enriquecer cada libro con IA ------------------------------ */
async function enrich(book) {
  const prompt = `
Genera JSON estricto:
{
  "dimension": "Bienestar|Prosperidad|Conexión",
  "palabras":  [4 palabras 1-2 sílabas],
  "frases":    [4 frases ≤60c, cada una inicia con emoji],
  "colores":   [4 hex vibrantes],
  "fondo":     "hex oscuro sugerido"
}
Libro: "${book.titulo}" de ${book.autor}. NO expliques nada.`;

  try {
    const chat = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [{ role: "user", content: prompt }]
    });

    /* limpiar posibles ```json … ``` envoltorios */
    let raw = chat.choices[0].message.content.trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/```[\s\S]*?\n/, "").replace(/```$/, "");
    }
    const extra = JSON.parse(raw);

    return {
      ...book,
      ...extra,
      portada: `📚 ${book.titulo}\n${book.autor}`
    };
  } catch (err) {
    return fallback(book, err.code || err.message);
  }
}

/* -- 6. Procesar la lista ---------------------------------------- */
const libros = await Promise.all(pick.map(enrich));

/* -- 7. Guardar contenido.json ------------------------------------ */
await fs.writeFile("contenido.json", JSON.stringify({ libros }, null, 2));
console.log("✅  contenido.json generado:", libros.length, "libros");
