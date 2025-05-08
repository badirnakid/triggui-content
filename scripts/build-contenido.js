/* -------------- build-contenido.js ------------------
   Genera contenido.json con 10 libros aleatorios.
   - Si existe OPENAI_KEY   → enriquece con GPT-4o-mini
   - Si no hay OPENAI_KEY   → mantiene el contenido.json actual
------------------------------------------------------ */

import fs from "node:fs/promises";
import { parse } from "csv-parse/sync";
import OpenAI from "openai";

/* -- 1. leer lista CSV ---------------------------------- */
const csvText = await fs.readFile("data/libros_master.csv", "utf8");
const master = parse(csvText, { columns: true, skip_empty_lines: true });

/* -- 2. si NO hay clave, salimos sin tocar el JSON ------- */
if (!process.env.OPENAI_KEY) {
  console.log("🔕  No OPENAI_KEY → se conserva contenido.json existente.");
  process.exit(0);
}

/* -- 3. configurar OpenAI -------------------------------- */
const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

/* -- 4. escoger 10 libros al azar ------------------------ */
const pick = master.sort(() => Math.random() - 0.5).slice(0, 10);

/* -- 5. función que pide a GPT los campos extra ---------- */
async function enrich(book) {
  const prompt = `
Genera JSON estricto:
{
  "dimension": "Bienestar|Prosperidad|Conexión",
  "palabras":  [4 palabras 1-2 sílabas],
  "frases":    [4 frases ≤60c, cada una inicia con emoji],
  "colores":   [4 códigos hex vibrantes],
  "fondo":     "hex oscuro sugerido"
}
Libro: "${book.titulo}" de ${book.autor}. NO expliques nada más.`;

  const chat = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.9,
    messages: [{ role: "user", content: prompt }]
  });

  const extra = JSON.parse(chat.choices[0].message.content);

  return {
    ...book,
    ...extra,
    portada: `📚 ${book.titulo}\n${book.autor}`
  };
}

/* -- 6. procesar los 10 libros --------------------------- */
const libros = await Promise.all(pick.map(enrich));

/* -- 7. escribir contenido.json -------------------------- */
await fs.writeFile("contenido.json", JSON.stringify({ libros }, null, 2));
console.log("✅  contenido.json generado:", libros.length, "libros");
