/* ───────────── Triggui · build-contenido.js (v Dios) ──────────────
   - GPT-4o-mini recibe contexto rico + ejemplo + reglas duras.
   - Detecta dimensión, crea palabras emocionales, frases elevadoras,
     colores vibrantes y fondo oscuro.
   - Portada: usa URL si existe en CSV, si no crea texto estético.
   - Autodepuración de JSON + fallback garantizado.
────────────────────────────────────────────────────────────────── */

import fs from "node:fs/promises";
import { parse } from "csv-parse/sync";
import OpenAI from "openai";

const KEY = process.env.OPENAI_KEY;

/* 1 ▸ leer CSV -------------------------------------------------- */
const csv = await fs.readFile("data/libros_master.csv", "utf8");
const master = parse(csv, { columns: true, skip_empty_lines: true });

/* 2 ▸ salir si no hay clave ------------------------------------ */
if (!KEY) {
  console.log("🔕  Sin OPENAI_KEY → contenido.json queda intacto.");
  process.exit(0);
}

const openai = new OpenAI({ apiKey: KEY });

/* utils -------------------------------------------------------- */
const pick10 = master.sort(() => Math.random() - 0.5).slice(0, 10);
const lum = h => {
  const [r, g, b] = h.replace("#", "").match(/.{2}/g).map(x => parseInt(x, 16) / 255);
  const a = [r, g, b].map(v => (v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4));
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
};
const textColor = bg => (lum(bg) > 0.35 ? "#000000" : "#FFFFFF");

/* fallback ----------------------------------------------------- */
function fallback(b, cause) {
  console.warn(`⚠️  Fallback «${b.titulo}»:`, cause);
  const col = ["#FF7F50", "#FFB347", "#FFCC33", "#FF6666"];
  return {
    ...b,
    dimension: "Bienestar",
    palabras: ["Lectura", "Pausa", "Pulso", "Luz"],
    frases: [
      "📖 Abre y despierta.",
      "🌱 Una línea nutre.",
      "💫 Pulso de papel real.",
      "🔑 La luz está adentro."
    ],
    colores: col,
    textColors: col.map(textColor),
    fondo: "#111111",
    portada: b.portada?.trim() ? b.portada.trim() : `📚 ${b.titulo}\n${b.autor}`
  };
}

/* prompt base -------------------------------------------------- */
const SYSTEM = `
Eres Triggui: una chispa que impulsa a abrir un libro físico.
Tu salida SIEMPRE es JSON estricto, sin \`\`\` ni texto extra.
Reglas:
• Elige dimensión correcta:
    – Bienestar  = cuerpo, mente, hábitos, salud interior.
    – Prosperidad = dinero, negocio, talento productivo.
    – Conexión   = vínculos, familia, espiritualidad, empatía.
• "palabras": 4 emociones breves (1–2 sílabas) que el lector SENTIRÁ.
• "frases": 4 frases ≤60c, cada una con emoji único; elevan energía (mapa Hawkins) pero sin nombrarlo.
• "colores": 4 hex vibrantes (sin repetir).
• "fondo": un hex oscuro que combine.
Ejemplo válido:
{
 "dimension":"Prosperidad",
 "palabras":["Ritmo","Brillo","Pulso","Foco"],
 "frases":["🚀 El ritmo fabrica grandeza."],
 "colores":["#FF0066","#00D9FF","#7C4DFF","#FFC300"],
 "fondo":"#10102A"
}
`;

async function enrich(b) {
  const USER = `Libro: "${b.titulo}" de ${b.autor} → genera el JSON.`;
  try {
    const chat = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [
        { role: "system", content: SYSTEM.trim() },
        { role: "user",   content: USER }
      ]
    });

    /* limpiar posible envoltorio ```json ... ``` */
    let raw = chat.choices[0].message.content.trim();
    if (raw.startsWith("```")) raw = raw.replace(/```[\s\S]*?\n/, "").replace(/```$/, "");

    /* autodepuración rudimentaria de comas finales / quotes simples */
    raw = raw.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/'/g, '"');

    const extra = JSON.parse(raw);
    extra.textColors = extra.colores.map(textColor);
    return {
      ...b,
      ...extra,
      portada: b.portada?.trim() ? b.portada.trim() : `📚 ${b.titulo}\n${b.autor}`
    };
  } catch (err) {
    return fallback(b, err.code || err.message);
  }
}

/* procesar ----------------------------------------------------- */
const libros = await Promise.all(pick10.map(enrich));
await fs.writeFile("contenido.json", JSON.stringify({ libros }, null, 2));
console.log("✅ contenido.json generado:", libros.length, "libros");
