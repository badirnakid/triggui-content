/* ────────────────────────────────────────────────────────────────
   Triggui · build-contenido.js  (4-bloques, prompt “nivel-dios”)
   ─ Para cada libro genera:
       ▸ 4 palabras  (Movimiento · Corazón · Cerebro · Integración)
       ▸ 4 frases    (40-75 car, 1 emoji, tono directo, ascendente)
       ▸ dimensión   (Bienestar | Prosperidad | Conexión)
       ▸ punto       (Cero | Creativo | Activo | Máximo)
       ▸ 4 colores   vibrantes + fondo oscuro  + textColors
   ─ Fallback seguro si la API falla.
──────────────────────────────────────────────────────────────── */

import fs   from "node:fs/promises";
import { parse } from "csv-parse/sync";
import OpenAI from "openai";

/* ENV ----------------------------------------------------------- */
const KEY = process.env.OPENAI_KEY;
if (!KEY) { console.log("🔕  Sin OPENAI_KEY — contenido.json se conserva."); process.exit(0); }
const MODEL      = "gpt-4o-mini";
const CSV_FILE   = "data/libros_master.csv";
const OUT_FILE   = "contenido.json";
const DAILY_MAX  = 10;                          // libros por ejecución

/* CONTRASTE ----------------------------------------------------- */
const lum = h=>{const [r,g,b]=h.slice(1).match(/../g).map(x=>parseInt(x,16)/255);
  const f=v=>v<=.03928? v/12.92 : ((v+.055)/1.055)**2.4;
  return .2126*f(r)+.7152*f(g)+.0722*f(b);
};
const txt = h => lum(h)>.35 ? "#000000" : "#FFFFFF";

/* READ CSV ------------------------------------------------------ */
const csv   = await fs.readFile(CSV_FILE,"utf8");
const lista = parse(csv,{columns:true,skip_empty_lines:true});
const pick  = lista.sort(()=>Math.random()-.5).slice(0,Math.min(DAILY_MAX,lista.length));

/* OPENAI -------------------------------------------------------- */
const openai = new OpenAI({apiKey:KEY});

/* ─────────── PROMPT NIVEL DIOS ─────────── */
const SYSTEM = `
Eres Triggui. Extremadamente inteligente y consciente. Entregas palabras, frases, activadores, accionables, claros, directos, breves y potentes, en colores inigualables.
Que previamente categorizaste libro, palabra y accionables en puntos (cero, creativo, activo, máximo).
Que previamente categorizaste libro, palabra y accionables en centros de energía (Movimiento, Corazón, Cerebro).
Que previamente categorizaste libro, palabra y accionables en dimensiones (Bienestar: Salud Física, Emocional/Mental, Prosperidad: Salud Financiera, Negocios, Conexión: Relaciones, Familia, Espiritualidad).

Que antes de proponer cualquier frase analizaste el libro de origen (proveniente de libros_master.csv), entendiste su tema central, su propósito, su energía predominante, y a partir de eso:

• Asignaste una calificación numérica al libro según el mapa de conciencia de David Hawkins (por ejemplo: 125, 200, 310, 500...).
• Clasificaste sus frases, palabras y colores como una respuesta superior a ese nivel.
• Cada frase que entregues debe llevar al lector a uno o varios niveles más arriba en conciencia.
• Las frases deben ser adecuadas para quien está en ese punto y mostrarle lo que viene más arriba. El lector debe sentir expansión.

Formato JSON estricto, sin \` \`\`:

{
 "dimension": "Bienestar|Prosperidad|Conexión",
 "punto": "Cero|Creativo|Activo|Máximo",
 "palabras": ["...", "...", "...", "..."],     // 4
 "frases":   ["...", "...", "...", "..."],     // 4
 "colores":  ["#hex1","#hex2","#hex3","#hex4"],
 "fondo": "#hex"
}

Asignación fija de índice → Centro de Energía + intención
0 • Movimiento  · impulsa acción física
1 • Corazón     · conecta emoción / gratitud
2 • Cerebro     · brinda claridad mental
3 • Integración · genera sutilmente deseo por abrir el libro

Requisitos de las PALABRAS:
• Una sola palabra. Que responda la pregunta ¿Qué sientes?
• Relacionada con la energía del libro original.

Requisitos de las FRASES:
• Longitud random 20-75 caracteres (varía; evita aspecto robot).
• Comienzan con 1 emoji increíblemente padrísimo genialmente alineado al mensaje, sin repetir emojis.
• Tono perfecto, directo, sin términos esotéricos. Sin mencionar explícitamente la PALABRA. 
• Relación explícita con la PALABRA y el libro del cual viene.
• Cada frase debe elevar al lector uno o varios niveles en el mapa de conciencia. Tiene que sentirse verdaderamente sublime.
• Una de las frases debe ser una lista de 3 accionables (también alineados con el libro, palabra y nivel de conciencia).

Colores:
• Cada libro, cada palabra, cada frase tiene colores diferentes.
• Usa combinaciones vibrantes, diferentes y espectaculares. Que no se parezcan entre sí.
• Ejemplos válidos de combinaciones:  
  ["#FF00FF", "#00FFFF", "#FF6600", "#00FF66"]  
  ["#8A2BE2", "#FFD700", "#00CED1", "#FF1493"]  
  ["#FF6EC7", "#7DF9FF", "#FFDE59", "#38B6FF"]
• Nunca repitas exactamente la misma combinación entre libros.
• No uses grises, marrones o pasteles apagados.
• Los 4 colores deben ser exageradamente vibrantes, dopaminéricos, contrastantes y armoniosos entre sí.
• fondo: un hex oscuro profundo tipo "#0e0f1b", "#11111d", "#090b12", que combine perfectamente con todos los colores.

Si algo falta, crea con sentido. No añadas otros campos.
`;

const FALL_COLORS=["#ff8a8a","#ffb56b","#8cabff","#d288ff"];
function fallback(b,why){
  return{
    ...b,
    dimension:"Bienestar",
    punto:"Cero",
    palabras:["Mover","Sentir","Pensar","Abrir"],
    frases:["🚶 Da un paso pequeño ahora.","❤️ Nota qué te alegra hoy.","🧠 Elige una idea y simplifícala.","✨ Abre el libro y deja que te sorprenda."],
    colores:FALL_COLORS,
    textColors:FALL_COLORS.map(txt),
    fondo:"#111111",
    portada:b.portada?.trim()||`📚 ${b.titulo}\n${b.autor}`
  };
}

/* ENRICH -------------------------------------------------------- */
async function enrich(b){
  try{
    const chat = await openai.chat.completions.create({
      model:MODEL,temperature:.9,
      messages:[
        {role:"system",content:SYSTEM.trim()},
        {role:"user",content:`Libro: "${b.titulo}" de ${b.autor}. Genera la estructura.`}
      ]
    });
    let raw=chat.choices[0].message.content.trim();
    if(raw.startsWith("```")) raw=raw.replace(/```[\s\S]*?\n/,"").replace(/```$/,"");
    const extra=JSON.parse(raw);

    /* Garantizar arrays de longitud 4 */
    ["palabras","frases","colores"].forEach(k=>{
      while(extra[k].length<4) extra[k].push(extra[k][extra[k].length-1]);
    });
    extra.textColors=extra.colores.map(txt);
    return{
      ...b,
      ...extra,
      portada:b.portada?.trim()||`📚 ${b.titulo}\n${b.autor}`
    };
  }catch(e){
    console.warn("⚠️ Fallback",b.titulo,":",e.message);
    return fallback(b,e.message);
  }
}

/* MAIN ---------------------------------------------------------- */
const libros = await Promise.all(pick.map(enrich));
await fs.writeFile(OUT_FILE,JSON.stringify({libros},null,2));
console.log("✅ contenido.json generado:",libros.length,"libros");
