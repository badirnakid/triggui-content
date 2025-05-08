import fs from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { Configuration, OpenAIApi } from "openai";

const OPENAI_KEY = process.env.OPENAI_KEY;               // puede faltar
const csv = await fs.readFile("data/libros_master.csv", "utf8");
const master = parse(csv, { columns: true, skip_empty_lines: true });

/* ---- Si no hay clave IA → no hacer nada ---- */
if (!OPENAI_KEY) {
  console.log("🔕  No OPENAI_KEY → se conserva contenido.json existente.");
  process.exit(0);           // workflow pasa en verde sin cambios
}

/* ---- Elegir 10 libros al azar ---- */
const pick = master.sort(() => Math.random() - 0.5).slice(0, 10);
const openai = new OpenAIApi(new Configuration({ apiKey: OPENAI_KEY }));

async function enrich(b) {
  const prompt = `
Genera JSON estricto:
{
 "dimension":"Bienestar|Prosperidad|Conexión",
 "palabras":[4 palabras 1-2 sílabas],
 "frases":[4 frases ≤60c, cada una inicia con emoji],
 "colores":[4 hex vibrantes],
 "fondo":"hex oscuro sugerido"
}
Libro:"${b.titulo}" de ${b.autor}`;
  const { choices } = await openai.createChatCompletion({
    model: "gpt-4o-mini",
    temperature: 0.9,
    messages: [{ role: "user", content: prompt }]
  });
  const extra = JSON.parse(choices[0].message.content);
  return {
    ...b,
    ...extra,
    portada: `📚 ${b.titulo}\n${b.autor}`
  };
}

const libros = await Promise.all(pick.map(enrich));
await fs.writeFile("contenido.json", JSON.stringify({ libros }, null, 2));
console.log("✅  contenido.json generado:", libros.length);
