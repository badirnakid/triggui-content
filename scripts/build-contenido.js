/* ════════════════════════════════════════════════════════════════
   Triggui · build-contenido.js  (versión “Centros & Hawkins”)
   ----------------------------------------------------------------
   – Por cada libro entrega un activador de 3 pasos:
       1. Movimiento   (cuerpo)   · palabra₁ + frase₁
       2. Corazón      (emoción)  · palabra₂ + frase₂
       3. Cerebro      (mente)    · palabra₃ + frase₃
     Cada paso sube en el mapa de Hawkins y está ligado a la
     Dimensión (Bienestar / Prosperidad / Conexión).
   – Campos extra: punto (Cero|Creativo|Activo|Máximo),
     4 colores vibrantes, fondo oscuro y textColors auto-calculado.
   – Todo lenguaje cotidiano, 0 misticismo.
════════════════════════════════════════════════════════════════ */

import fs   from "node:fs/promises";
import { parse } from "csv-parse/sync";
import OpenAI from "openai";

/* ENV & CONST --------------------------------------------------- */
const OPENAI_KEY = process.env.OPENAI_KEY;
if(!OPENAI_KEY){
  console.log("🔕  Sin OPENAI_KEY — contenido.json se conserva.");
  process.exit(0);
}

const CSV_FILE   = "data/libros_master.csv";
const OUT_JSON   = "contenido.json";
const DAILY_MAX  = 10;              // libros procesados por ejecución
const MODEL      = "gpt-4o-mini";

/* UTILS --------------------------------------------------------- */
const luma  = h=>{const [r,g,b]=h.slice(1).match(/../g).map(x=>parseInt(x,16)/255);
  const a=v=>v<=.03928? v/12.92 : ((v+.055)/1.055)**2.4;
  const [R,G,B]=[a(r),a(g),a(b)];
  return .2126*R + .7152*G + .0722*B;
};
const txtColor = h => luma(h)>.35 ? "#000000" : "#FFFFFF";

/* READ CSV ------------------------------------------------------ */
const csv   = await fs.readFile(CSV_FILE,"utf8");
const lista = parse(csv,{columns:true,skip_empty_lines:true});
const pick  = lista.sort(()=>Math.random()-.5).slice(0,Math.min(lista.length,DAILY_MAX));

/* OPENAI -------------------------------------------------------- */
const openai = new OpenAI({apiKey:OPENAI_KEY});

/* ── PROMPT NIVEL DIOS ────────────────────────────────────────── */
const SYSTEM = `
Eres Triggui, impulso mínimo para abrir un libro físico.
Entrega JSON estricto (sin \`\`\`), exactamente con estas claves:
{
  "dimension": "Bienestar|Prosperidad|Conexión",
  "punto": "Cero|Creativo|Activo|Máximo",
  "palabras": ["...", "...", "..."],
  "frases":   ["...", "...", "..."],
  "colores":  ["#hex1","#hex2","#hex3","#hex4"],
  "fondo": "#hex"
}

Reglas vitales:
• Cada índice i (0,1,2) corresponde:
    0 → Centro de Energía Movimiento   (cuerpo, acción)
    1 → Centro de Energía Corazón      (emoción, sentimiento)
    2 → Centro de Energía Cerebro      (claridad, mente)
• Las 3 frases forman una secuencia LÓGICA y ASCENDENTE en Hawkins:
    Movimiento (Impulso) → Corazón (Apertura) → Cerebro (Claridad)
• Cada frase:
    – ≤ 60 caracteres
    – Empieza con 1 emoji relacionado
    – Lenguaje cotidiano, directo, sin “universo/energía/vibrar”
    – Relacionada con la palabra y el libro
• "dimension": usa 1 de estas guías rápidas
    Bienestar  → cuerpo / hábitos / mente
    Prosperidad→ dinero / proyecto / talento
    Conexión   → vínculos / servicio / propósito
• "punto" define la intensidad del mensaje:
    Cero (pausa) · Creativo (idea) · Activo (acción) · Máximo (expansión)
• "colores": 4 hex vibrantes distintos.
  color[0] → bloque 0 (Movimiento) ... color[2] → bloque 2, color[3] → portada
• "fondo": un hex oscuro que haga contraste.
• Si no sabes un dato, inventa con sentido.
Ejemplo breve válido:
{
 "dimension":"Prosperidad",
 "punto":"Creativo",
 "palabras":["Ritmo","Pulso","Foco"],
 "frases":["🚶 Da un paso ya.","❤️ Siente el logro.","🧠 Piensa en simple."],
 "colores":["#FF007A","#FF9B42","#40F99B","#5126FF"],
 "fondo":"#101019"
}
`;

function fallback(b,msg){
  const base=["#ff8a8a","#ffd56b","#8affc1","#6a8dff"];
  return{
    ...b,
    dimension:"Bienestar",
    punto:"Cero",
    palabras:["Mover","Sentir","Pensar"],
    frases:["🚶 Camina un minuto.","❤️ Nota tu pulso.","🧠 Respira y aclara."],
    colores:base,
    textColors:base.map(txtColor),
    fondo:"#111111",
    portada:b.portada?.trim() || `📚 ${b.titulo}\n${b.autor}`
  };
}

/* ENRICH -------------------------------------------------------- */
async function enrich(book){
  const USER=`Libro: "${book.titulo}" de ${book.autor}\nGenera estructura.`;
  try{
    const resp=await openai.chat.completions.create({
      model:MODEL,
      temperature:.9,
      messages:[
        {role:"system",content:SYSTEM.trim()},
        {role:"user",content:USER.trim()}
      ]
    });
    let raw=resp.choices[0].message.content.trim();
    if(raw.startsWith("```")) raw=raw.replace(/```[\s\S]*?\n/,"").replace(/```$/,"");
    const extra=JSON.parse(raw);
    extra.textColors=extra.colores.map(txtColor);
    return {...book,...extra,portada:book.portada?.trim()||`📚 ${book.titulo}\n${book.autor}`};
  }catch(e){
    console.warn("⚠️ Fallback:",book.titulo,e.message||e.code);
    return fallback(book,e.message);
  }
}

/* MAIN ---------------------------------------------------------- */
const libros = await Promise.all(pick.map(enrich));
await fs.writeFile(OUT_JSON,JSON.stringify({libros},null,2));
console.log("✅ contenido.json generado:",libros.length,"libros");
