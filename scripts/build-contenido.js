// TRIGGUI · MOTOR MINIMALISTA v1.0 — Badir Edition
import fs from "node:fs/promises";
import { parse } from "csv-parse/sync";
import OpenAI from "openai";
import crypto from "node:crypto";

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });
const CSV = "data/libros_master.csv";
const OUT = "contenido.json";
const MODEL = "gpt-4o-mini";

const used = { palabras: new Set(), colores: new Set(), emojis: new Set() };
const lum = h => {
  const [r, g, b] = h.slice(1).match(/../g).map(v => parseInt(v,16)/255);
  const f = v => v <= .039 ? v/12.92 : ((v+.055)/1.055)**2.4;
  return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b);
};
const txt = h => lum(h) > 0.35 ? "#000" : "#FFF";
const clean = t => t.trim().replace(/```json|```/g,"").replace(/^[^{[]*/,"").replace(/[^}\]]*$/,"");

const cronobio = () => {
  const d = new Date();
  const dia = d.toLocaleDateString("es-MX",{weekday:"long"}).toLowerCase();
  const hora = d.getHours();
  return { dia, hora };
};

const promptPrincipal = (b, lang) => `
Genera JSON puro sin backticks.

Libro: "${b.titulo}" de ${b.autor}
Tagline: ${b.tagline||""}

Debes generar:
- 4 palabras emocionales bajas Hawkins (únicas, específicas del libro)
- 4 frases totalmente distintas (60-80 chars, 1 emoji cada una)
- 4 colores únicos (hex)
- un fondo oscuro
- dimensión (Bienestar/Prosperidad/Conexión)
- punto (Cero/Creativo/Activo/Máximo)

Reglas:
- Palabras prohibidas: ${[...used.palabras].join(", ") || "ninguna"}
- Colores prohibidos: ${[...used.colores].join(", ") || "ninguno"}
- Emojis no repetidos
- Cero listas repetitivas ("1) 2) 3)")
- Cero patrones obvios
- Todo específico a ESTE libro

Idioma: ${lang}

Devuelve solo JSON con:
{
 "dimension": "",
 "punto": "",
 "palabras": [],
 "frases": [],
 "colores": [],
 "fondo": ""
}
`;

const promptTarjeta = b => `
@@BODY
Título (50 chars)
Párrafo 1 (130 chars): menciona "${b.titulo}" y ${b.autor}
Subtítulo (48 chars)
Párrafo 2 (130 chars): acción concreta del libro
@@ENDBODY
`;

const promptStyle = () => `
@@STYLE
{
 "accent": "#random",
 "ink": "#000",
 "paper": "#FFF",
 "surprise": "Efecto inesperado basado en ${crypto.randomUUID()}"
}
@@ENDSTYLE
`;

async function generar(b, lang) {
  try {
    // 1. PRINCIPAL
    const chat = await openai.chat.completions.create({
      model: MODEL,
      temperature: 1.3,
      messages: [{ role:"user", content: promptPrincipal(b, lang) }]
    });

    let extra = JSON.parse(clean(chat.choices[0].message.content));

    // registrar repetición
    extra.palabras.forEach(p => used.palabras.add(p.toLowerCase()));
    extra.colores.forEach(c => used.colores.add(c));

    // 2. TARJETA
    const t = await openai.chat.completions.create({
      model: MODEL,
      temperature: 1.2,
      messages: [{ role:"user", content: promptTarjeta(b) }]
    });
    const body = clean(t.choices[0].message.content).split("\n").filter(Boolean);
    const [titulo, pTop, subt, ...rest] = body;

    // 3. ESTILO
    const s = await openai.chat.completions.create({
      model: MODEL,
      temperature: 1.2,
      messages: [{ role:"user", content: promptStyle() }]
    });
    let style = JSON.parse(clean(s.choices[0].message.content));

    return {
      ...b,
      ...extra,
      textColors: extra.colores.map(txt),
      tarjeta: {
        titulo,
        parrafoTop: pTop,
        subtitulo: subt,
        parrafoBot: rest.join(" "),
        style
      },
      videoUrl: `https://duckduckgo.com/?q=!ducky+site:youtube.com+${encodeURIComponent(b.titulo+" "+b.autor)}`
    };
  } catch (e) {
    return { ...b, palabras:["default","default","default","default"] };
  }
}

(async () => {
  const csv = await fs.readFile(CSV,"utf8");
  const rows = parse(csv,{columns:true});
  const lang = "Español Latam";
  const libros = [];

  for (const b of rows.slice(0,20)) {
    const enriched = await generar(b, lang);
    libros.push(enriched);
  }

  await fs.writeFile(OUT, JSON.stringify({ libros }, null, 2));
})();
