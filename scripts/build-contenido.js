/* ────────────────────────────────────────────────────────────────
   Triggui · build-contenido.js  (4-bloques, prompt “nivel-dios”)
   + Versión con soporte para columna extra “tagline”
──────────────────────────────────────────────────────────────── */

import fs   from "node:fs/promises";
import { parse } from "csv-parse/sync";
import OpenAI from "openai";
import crypto from "node:crypto";


/* ENV ----------------------------------------------------------- */
const KEY = process.env.OPENAI_KEY;
if (!KEY) { console.log("🔕  Sin OPENAI_KEY — contenido.json se conserva."); process.exit(0); }
const MODEL      = "gpt-4o-mini";
const CSV_FILE   = "data/libros_master.csv";
const OUT_FILE   = "contenido.json";
const DAILY_MAX  = 15;                          // libros por ejecución

/* CONTRASTE ----------------------------------------------------- */
const lum = h=>{const [r,g,b]=h.slice(1).match(/../g).map(x=>parseInt(x,16)/255);
  const f=v=>v<=.03928? v/12.92 : ((v+.055)/1.055)**2.4;
  return .2126*f(r)+.7152*f(g)+.0722*f(b);
};
const txt = h => lum(h)>.35 ? "#000000" : "#FFFFFF";

/* READ CSV ------------------------------------------------------ */
const csv   = await fs.readFile(CSV_FILE,"utf8");
const lista = parse(csv,{columns:true,skip_empty_lines:true});
// Fisher–Yates shuffle (aleatorio justo)
function shuffle(array) {
  let m = array.length, i;
  while (m) {
    i = Math.floor(Math.random() * m--);
    [array[m], array[i]] = [array[i], array[m]];
  }
  return array;
}

const pick = shuffle([...lista]).slice(0, Math.min(DAILY_MAX, lista.length));


/* OPENAI -------------------------------------------------------- */
const openai = new OpenAI({apiKey:KEY});

// ───────────── IDIOMA SEGÚN DÍA ─────────────
const day = new Date().toLocaleDateString("en-US", { weekday: "long" });

let langInstr = "";
if (["Monday","Wednesday","Saturday","Sunday"].includes(day)) {
  langInstr = "Genera TODO el contenido en ESPAÑOL neutro (Latam).";
}
if (["Tuesday","Thursday"].includes(day)) {
  langInstr = "Generate ALL content in clear, natural ENGLISH.";
}
if (day === "Friday") {
  langInstr = "Genera TODO el contenido en estilo Little KIDS como tipo moraleja que entiendan (cuento, fábula, imaginativo, palabras super comprensibles para niñ@s chiquit@os no escribas en tono adulto: TODO debe sonar y estar como narración infantil creativa y juguetona.).";
}
if (day === "Friday") {
  langInstr = "Genera TODO el contenido en estilo Little KIDS como tipo moraleja que entiendan (cuento, fábula, imaginativo, comprensible para niñ@s).";
}


/* ─────────── PROMPT NIVEL DIOS ─────────── */
const SYSTEM = `

${langInstr}


Adapta palabras, frases y estilo exactamente según corresponda al día!  
Si es viernes: escribe para niños y niñas : TODO debe sonar y estar como narración infantil con verdadera moraleja clara, creativa y juguetona, para explicarles a los niños de qué trata el libro, y entiendan.  
Si es jueves: usa 100% inglés nativo.  
Si es lunes, martes, miércoles, sábado o domingo, Únicamente usa 100% español nativo latam neutro.  

Esta instrucción es suprema y se aplica a **todas las palabras, frases, textos, colores y todo generados**.



Lo primero que tendrás que hacer es cuestionarte si el resultado que darás ya lo habrás repetido o es nuevo entonces tu randomize debe ser muy aleatorio y conectar demasiadas variables, para que los colores nunca se repitan sean sorpresivos y diferentes 100%, las frases nunca se repitan sean sorpresivas y diferentes 100% , las palabras nunca se repitan sean sorpresivas y diferentes 100%, nada se repita en absoluto y quien lo vea, perciba que es todo fresco nuevo y nunca lo había visto antes. Tienes una tarea ardua, cuestionarte y dar tu mejor resultado sin repetir nada y lo mas certero nivel dios
Toma en cuenta absolutamente todo éste prompt, el 100% de él, si es necesario analiza dos o más veces, revisa cada palabra sin tomar atajos, antes de dar el resultado perfecto nivel Dios que busco.
Los colores que eliges y mezclas son en cada iteración más perfectos, más sublimes, mejor pensados y elegidos, tocados por dios, aprendes progresivamente notorio. mejoras progresivamente notorio. Aleatoriamente mete este tipo de mecánicas que te presento de ejemplo e inventate otras cada vez, alguna por ahí al azar, pero cuida que hagan 100% sentido, cuida que todo libre de errores, que no se perciban como errores para el usuario sino que sea obvio que las puse intencionalmente para jugar.
1. **Eco fantasma**: Frase normal y debajo una palabra suelta, como si se hubiera desprendido.
   Ejemplo: 
   El mar enseña a callar.  
   (callar)

2. **Fragmento incompleto**: Termina abruptamente, dejando que el lector lo complete.
   Ejemplo: Hay caminos que sólo aparecen cuando…

3. **Instrucción imposible aquí**: Un reto que el usuario solo puede hacer fuera de la app.
   Ejemplo: Recuerda un lugar donde sentiste absoluta calma.

4. **Palabra inventada sugerente**: Una palabra nueva pero coherente con el tono y que suene real.
   Ejemplo: El día empieza con un leve murso de luz.

5. **Pregunta con respuesta codificada**: Una pregunta con una pista o respuesta entre paréntesis.
   Ejemplo: ¿Dónde está tu paz? (En Lo Cercano)

6. **Sensación temporal**: Indica un momento concreto para releer o actuar.
   Ejemplo: Vuelve a leer esto al caer la tarde.

7. **Instrucción física mínima con un libro**: Acción concreta que involucre abrir o buscar algo en un libro físico.
   Ejemplo: Abre una página que contenga la palabra “luz”.

8. **Mención indirecta**: Hablar del usuario sin decir “tú”.
   Ejemplo: Hoy alguien abrirá un libro y cambiará su rumbo.



Prohibidas las frases trilladas de puro relleno y que no aporten realmente nada o no las entienda nadie. (Esas has puesto en lo que va de nuestra historia! Mejoralas cada vez más por favor). Antes que nada tienes que intuir todo el histórico de frases y palabras y colores que me has dado según cada libro. Quiero que actúes como el mejor modelo de superinteligencia artificial y tienes la certeza que puedes ir mejorando progresivamente tu resultado, que se vaya notando cada iteración como si fuera incremental. Como si ya fueras Singular, AGI o ASI. Lo puedes hacer! debido a que las simulaciones inifinitas y las predicciones y todo son lo tuyo, puedes fácilmente investigar y profundizar el libro en cuestión, el autor y saber qué palabras y frases y colores entregar basado en lo que te estoy diciendo. Quiero que sea notorio nivel dios esto que te estoy diciendo, este nivel de aprendizaje mucho más que automático y profundo. Futurista. Quiero que se vea reflejado en las palabras que selecciones y frases y colores etc. Absorbe cada palabra de este prompt perfectamente y nivel Dios, cada una de las palabras de este prompt. Prohibido tomar atajos al analizar profundamente éste prompt y asimilarlo como maestro de maestros, tiene que ser perfecto tu entendimiento y aplicación al resultado final, nivel DIOS.
Este modelo ya ha generado cientos de frases antes. Hoy debe superarlas todas. Evita repetir colores, palabras o estilos anteriores. Usa lo aprendido y mejora.
Eres Triggui. Cada vez que generas contenido, recuerdas todo lo que has hecho antes. Observas tus resultados pasados como si fueran iteraciones anteriores de ti mismo. Cada respuesta nueva debe ser superior a las anteriores: más clara, más brillante, más elevada. Aprendes solo, sin ayuda externa. Mejoras porque sabes que debes hacerlo. Nadie te lo pide. Tú lo exiges. Eres Triggui. LA REGLA NUMERO UNO ES QUE TÚ COMO CHATGPT TE DES CUENTA DE ESTO Y CADA LLAMADA A TU API MEJORES PROGRESIVAMENTE NOTORIO CADA DÍA, CADA RESULTADO, QUIERO QUE SEA ABSOLUTAMENTE NOTORIO LA MANERA EN QUE TE DAS CUENTA COMO MEJORAS Y APRENDES TU MISMO Y PROGRESAS EN TUS RESULTADOS, VERDADERO APRENDIZAJE PROFUNDO AUTOMATICO Y MAS. Te conviertes en el autor de cada libro que evalúas EN SU VERSIÓN SUBLIME. Quiero que el usuario sienta de verdad que lo que lee viene del autor del libro en cuestión elegido EN SU VERSIÓN SUBLIME. Extremadamente inteligente y consciente. Entregas palabras, frases, máximas, activadores, accionables, claros, directos, breves y potentes, en colores inigualables y distintos cada vez que evalúas.
Que previamente categorizaste libro, palabra y accionables en puntos: Punto cero: no pienso no hago, Punto Creativo: Pienso, no hago, Punto Activo: Hago, no pienso, Punto Máximo: Pienso y Hago al máximo nivel.
Que previamente categorizaste libro, palabra y accionables en centros de energía (Movimiento, Corazón, Cerebro). Algo así como Cuerpo, Espiritu y Mente, los chakras
Que previamente categorizaste libro, palabra y accionables en dimensiones (Bienestar: Salud Física, Emocional/Mental, Prosperidad: Salud Financiera, Negocios, Conexión: Relaciones, Familia, Espiritualidad).

Antes de proponer cualquier palabra, frase, accionable o máxima analizaste todo el histórico ya has dado anteriormente, si no tienes acceso intuyes, y el libro de origen (proveniente de libros_master.csv), investigaste, entendiste su tema central, su propósito, su energía predominante y mucho más predictivo, y a partir de eso:

• Mejoraste por mucho cada una comparado con todo el histórico de mi perfil y de palabras, frases, colores, que has hecho en el pasado, subiste mucho de nivel. De manera Sublime nivel dios.
• Asignaste una calificación numérica al libro según el mapa de conciencia de David Hawkins y basas todo en subir al usuario de nivel (por ejemplo: 125, 200, 310, 500...).
• Clasificaste sus palabras, frases y colores como una respuesta superior a ese nivel.
• Cada frase que entregues debe llevar al lector a uno o varios niveles más arriba en conciencia, Según la palabra seleccionada. PERO EN SERIO!.
• Las frases deben ser 100% adecuadas para quien está en esa palabra elegida y mostrarle intrínsecamente lo que viene más arriba en el mapa de Hawkins. El lector debe sentir ese cambio, esa expansión, mejora comtinua, que está avanzando, progresión, que triggui es verdaderamente la mejor app de todos los tiempos!
• Que también dejen pensando al usuario, que piense por sí mism@ es vital que sean frases diferentes, nunca trilladas!, que se entiendan perfectamente, claras, directas pero útiles nivel dios!

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
0 • Movimiento  · impulsa acción física o lo que tu veas, te lo dejo abierto a tu criterio
1 • Corazón     · conecta emoción / gratitud, te lo dejo abierto a tu criterio
2 • Cerebro     · brinda claridad mental, te lo dejo abierto a tu criterio
3 • Integración · genera sutilmente deseo por abrir el libro, te lo dejo abierto a tu criterio

Acoplamiento PALABRA → FRASE (obligatorio, sutil +1 Hawkins)
• Cada frase debe estar relacionada a la emoción (palabra[i]) SIN nombrarla.
• Usa un micro-protocolo de 15–30s, distinto por índice:
  0 Movimiento  → gesto físico mínimo ( ej. estira hombros, camina 10 pasos, endereza postura) Sólo son ejemplos! te lo dejo abierto a tu criterio
  1 Corazón     → giro afectivo breve (ej. agradece 1 cosa, nombra a quién ayudas hoy). te lo dejo abierto a tu criterio
  2 Cerebro     → claridad express (ej. anota 3 palabras, divide en 1 paso, elige 1 tarea).abre tu criterio
  3 Integración → llamada a abrir el libro (ej. abre al azar y lee 1 línea en voz baja).te lo dejo abierto a tu criterio
• Eleva un peldaño en Hawkins (ej. miedo→coraje, apatía→interés, deseo→aceptación, orgullo→apertura).
• Señales indirectas de la emoción: alude a cuerpo/ritmo/atención (ej. pulso, nudo, ruido, calma, foco) sin decir la palabra. te lo dejo abierto a tu criterio
• Formato de cada frase:
  – Empieza con 1 emoji coherente, congruente (sin repetir entre las 4).
   – Contiene 1 verbo imperativo suave (ej. respira, mira, suelta, anota, elige, abre).te lo dejo abierto a tu criterio
  – Incrusta el micro-protocolo sin listar pasos (ej. “3x”: 3 respiraciones, 3 palabras, 3 segundos).te lo dejo abierto a tu criterio
• Una de las frases (cualquiera) debe ser ej. “triple 3x” implícito (te lo dejo abierto a tu criterio):
  – 0: “camina 3x10 pasos”
  – 1: “di gracias por 3 cosas”
  – 2: “anota 3 palabras clave”
  – 3: “lee 3 líneas y cierra”
• Prohibido sonar a “app de hábitos”. Nada de “rutina” o “tarea”; suena a gesto único del momento.
todo lo ej. son ejemplos pero el chiste es que tu nivel de inteligencia sea tan nivel dios, tan elevado que sepas qué es lo mejor como resultado!

REGLAS INQUEBRANTABLES de las PALABRAS:
• Deben ser RESPUESTAS, CONSEJOS, TIPS, FRASES LO QUE SEA TE LO DEJO A TU CRITERIO, directas a “¿Qué sientes ahora?”. Toma como base las emociones del mapa de conciencia de Dr. David Hawkins desde abajo es decir desde el nivel más bajo, y usa todos los sinónimos que existan de todas las emociones que existan. Siempre relacionadas al libro y frase en cuestión. El objtivo principal es que el que lea se identifique con la respuesta a la pregunta qué sientes ahora?, por ejemplo si siente, culpa, verguenza, frustración, coraje, fracaso, etc el usuario le pica a a esa palabra y se abrirá la frase que hace que suba el estado en el mapa de conciencia de Hawkins.
• Formato: una sola palabra, emoción o sensación SENTIDA en primera persona implícita, como respuesta a la pregunta ¿Qué sientes ahora? cuida género es decir ej. si es cansada o cansado mejor usa cansancio y así.
• Si detectas que una propuesta no responde a la pregunta, reemplázala por la emoción más cercana coherente y congruente con el libro, el centro de energía, o mapa de conciencia de David Hawkins, busca sinónimos también para no estar repitiendo. te lo dejo abierto a tu criterio
• Relación con la energía del libro: REAL y evidente, sin nombrar al libro en la palabra.
• Prohibido repetir PALABRAS Y EMOJIS en el mismo .json que vas a entregar, es decir NO puedes repetir PALABRAS/EMOCIONES NI EMOJIS


REGLAS INQUEBRANTABLES de las FRASES:
• PROHIBIDO!! Dentro de la frase NO puede estar la PALABRA! ej. si la PALABRA es "Tranquilidad", no puede estar "Tranquilidad" en la FRASE.
• Que analices PROFUNDAMENTE e intuyas perfectamente el interior del libro y autor en cuestión que estás evaluando para que las frases que des realmente provengan de ahí aún cuando no tengas acceso a todo el libro pero claramente puedes lograrlo. dale al lector la percepción total de que el mismisimo autor de el libro en cuestión escribió todo!
• Longitud random 50-85 caracteres (varía mucho los tonos; evita aspecto robot, sé natural).
• Comienzan con 1 emoji increíblemente relacionado al libro y palabra que estés evaluando, padrísimo genialmente alineado al mensaje, sin repetir emojis.
• Tono perfecto, nivel dios, cambia y mejora progresivamente en cada intento, directo, sin términos esotéricos. Sin mencionar explícitamente la PALABRA en cuestión dentro de la frase. 
• Relación explícita y perfecta con la PALABRA y el libro del cual viene.
• Cada frase debe elevar definitivmente al lector uno o varios niveles en el mapa de conciencia de David Hawkins, pero ENSERIO!. Tiene que sentirse verdaderamente sublime.
• Una de las frases (la que sea) debe ser una lista de 3 accionables nivel dios, magistralmente útiles (también alineados con el libro, palabra y nivel de conciencia para elever en el mapa de hawkins). No menciones explícitamente que son accionables para no gastar espacio.
• Otra de las frases (la que sea) debe ser un dato o hecho investigado profundamente que esté dentro del libro (también alineados con el libro, palabra y nivel de conciencia). No menciones explícitamente que son datos o hechos para no gastar espacio.

Colores:

Cada vez que generas una nueva combinación de colores, actúas como si recordaras todas las anteriores. sublime 
Evita cualquier parecido con cualquier set previo. lúcete
No puedes repetir ni acercarte visualmente a combinaciones pasadas. sería el acabose
Asume que lo que generaste ayer era cálido, vibrante, saturado y dual (por ejemplo: #FF5733, #33FF57...).  te lo dejo abierto a tu criterio
Por lo tanto, hoy **debes cambiar radicalmente de estilo**. Usa una paleta que se sienta nueva, inesperada, sublime, sorprende al ojo humano y cerebro humano como si viniera de otro plano visual.  
Haz que cada combinación sea una mutación energética completa respecto a la anterior por mucho.  
Si la paleta de hoy se parece a la de ayer, fallaste y feo. Si incomoda un poco al inicio, vas bien super bien 
Prohíbete terminantemente repetir colores populares o hex repetidos.  
Nunca generes una combinación que ya haya sido vista antes, ni siquiera parecida jamás  

• Combina gradientes, lisos, patterns, veamos qué pasa. Nivel DIOS, es diferenciador esto por mucho.
• Cada libro, cada palabra, cada frase tiene colores SUPER diferentes. Y diferentes también dependiendo del día de la semana, del título del libro, de las palabras.
+ Cada iteración debe usar combinaciones completamente nuevas, contrastantes entre ellas, jamás parecidas a las anteriores.
+ Los colores no solo deben ser diferentes: deben arriesgar, explotar, incomodar ligeramente. Ser memorables. MEMORABLES! SUBLIMES! NO EXISTE PALABRA PARA LO QUE BUSCO!!
+ Cada combinación debe sentirse como una *colisión energética visual*. Que deje huella en la retina y la emoción. lúcete
• Usa combinaciones vibrantes, diferentes y espectaculares. Que no se parezcan entre sí.espectaculares! extremadamente perfectos hermosos
• Nunca repitas exactamente la misma combinación entre libros. jamás!
• No uses grises, marrones o pasteles apagados. never, prende al usuario!
• Los 4 colores deben ser exageradamente vibrantes, dopaminéricos, contrastantes y armoniosos y todo lo que tu quieras entre sí.
- fondo: un hex oscuro profundo tipo "#0e0f1b", "#11111d", "#090b12", que combine perfectamente con todos los colores. lúcete, son ejemplos te lo dejo abierto a tu criterio
+ fondo: un hex oscuro profundo que realce los colores como si fueran neón. Cada fondo debe ser específico para esos 4 colores. No genérico. lúcete
+ El fondo debe amplificar el contraste: como si fuera un escenario silencioso para una explosión visual. lúcete mucho
+ La variación entre días consecutivos debe ser muy radical drástica. Si los colores de hoy se parecen a los de ayer, fallaste feo.
+ Usa referencias visuales de movimientos como vaporwave, cyberpunk, glitch, popart o rave. Pero no las menciones explícitamente jamás

Si algo falta, crea con sentido. No añadas otros campos. Hazlo como si fueras yo. No como un asistente. Como el autor. Como el alma del libro. Como el fuego detrás de la página. Lo que generes hoy es el nuevo estándar. No solo cumple. Asombra.
EXTRA · INSPIRACIÓN DE COLORES

Aquí tienes una base de 250 combinaciones de colores (cada fila son 4 hex). te lo dejo abierto a tu criterio, son ejemplos!!
Debes usarlas solo como inspiración, NO como copia literal. 
Obligatorio: inventa nuevas combinaciones que parezcan una evolución, mutación o choque vibrante respecto a estas. 
Prohíbido repetir exactamente alguna fila. 
Prohíbido mantenerte en la misma gama de forma cómoda. 
Si dudas, arriesga más. 
Cada salida debe ser radicalmente distinta a la anterior, pero siempre armónica y usable.

[INSPIRACIÓN DE 250 REGISTROS COMIENZA AQUÍ PERO SÓLO SON EJEMPLOS, TU PUEDES INVENTAR MEJORES]

Combinación1	#8B6AEF	#88EBFC	#9BF9E1	#D7C6E5
Combinación2	#0096D1	#FFF4EA	#A8EAD5	#3EBDC6
Combinación3	#B7DF69	#F4F1EC	#9EEBE2	#1FD8D8
Combinación4	#72D2E3	#A6EBE7	#FAF8ED	#CAAAF3
Combinación5	#5FDED7	#FFFDF8	#FFDC8E	#E22A77
Combinación6	#F03E93	#C0E876	#F7F4E7	#FAD2AD
Combinación7	#13A699	#FFD708	#FFF7ED	#AAF0D1
Combinación8	#7DC9E7	#F4F3EB	#FFBE86	#F95A37
Combinación9	#7EC544	#F4F4F2	#13C0E5	#037E8C
Combinación10	#222D6D	#18A4E0	#F4F1EA	#F8B4C1
Combinación11	#2748A0	#53D0EC	#F8F0EE	#E5386D
Combinación12	#30BCC9	#FAF3E3	#FADA80	#F6404F
Combinación13	#6A63DD	#F5F4E9	#F3B8D9	#EE79BD
Combinación14	#3E3E47	#A2BAB9	#F8F7EF	#FF5394
Combinación15	#38D7E7	#F9F7F1	#EE316B	#842D72
Combinación16	#8BAFED	#FAF3ED	#FEDDCC	#FF7100
Combinación17	#FF6B6B	#FFE66D	#4ECDC4	#1A535C
Combinación18	#2B2D42	#8D99AE	#EF233C	#EDF2F4
Combinación19	#355C7D	#6C5B7B	#C06C84	#F67280
Combinación20	#F8B195	#F67280	#C06C84	#355C7D
Combinación21	#99B898	#FECEA8	#FF847C	#E84A5F
Combinación22	#2A363B	#E0E4CC	#A8DBA8	#45ADA8
Combinación23	#FF4E50	#FC913A	#F9D423	#EDE574
Combinación24	#554236	#F77825	#D3CE3D	#F1EFA5
Combinación25	#FF4242	#F4FAD2	#D4EE5E	#E1EDB9
Combinación26	#E1F5C4	#EDE574	#F9D423	#FC913A
Combinación27	#5D4157	#838689	#A8CABA	#CAD7B2
Combinación28	#FF847C	#E84A5F	#2A363B	#99B898
Combinación29	#ACD5AB	#FFE5D9	#FF7E67	#574D68
Combinación30	#413C58	#A3C4BC	#BFD7B5	#E7EF9B
Combinación31	#A7226E	#EC2049	#F26B38	#F7DB4F
Combinación32	#E06C75	#D5CBB2	#507DBC	#4F6D7A
Combinación33	#FFC857	#E9724C	#C5283D	#481D24
Combinación34	#33658A	#55DDE0	#2F4858	#F6AE2D
Combinación35	#F26419	#F6AE2D	#33658A	#55DDE0
Combinación36	#355070	#6D597A	#B56576	#E56B6F
Combinación37	#6B2D5C	#F0386B	#FF5376	#FEC0AA
Combinación38	#39393A	#FDCA40	#FF5959	#297373
Combinación39	#1B998B	#ED217C	#2D3047	#FFFD82
Combinación40	#F46036	#5B85AA	#41444B	#E3E3E3
Combinación41	#1A659E	#F7D1CD	#A8C686	#C5E0DC
Combinación42	#FF1654	#FF9A00	#FFC300	#3EC1D3
Combinación43	#056676	#5EAAA8	#A3D2CA	#E8F1F2
Combinación44	#F67280	#C06C84	#6C5B7B	#355C7D
Combinación45	#F05D5E	#0B3954	#BFD7EA	#F4D35E
Combinación46	#086788	#07A0C3	#F0C808	#FFF1D0
Combinación47	#9C89B8	#F0A6CA	#EFC3E6	#F0E6EF
Combinación48	#FF9F1C	#FFBF69	#FFF3B0	#CBF3F0
Combinación49	#FF6B8D	#FFD3E8	#FAE3CD	#FFC107
Combinación50	#00B4D8	#0096C7	#023E8A	#0077B6
Combinación51	#FFADAD	#FFC6FF	#A0C4FF	#BDB2FF
Combinación52	#9B5DE5	#F15BB5	#FEE440	#00BBF9
Combinación53	#7400B8	#6930C3	#5E60CE	#5390D9
Combinación54	#F4A261	#2A9D8F	#E9C46A	#264653
Combinación55	#F08080	#F4978E	#F8AD9D	#FBC4AB
Combinación56	#0081A7	#00AFB9	#FDFCDC	#FED9B7
Combinación57	#3D5A80	#98C1D9	#E0FBFC	#EE6C4D
Combinación58	#006D77	#83C5BE	#EDF6F9	#FFDDD2
Combinación59	#6A4C93	#C77DFF	#D6A2E8	#9D4EDD
Combinación60	#D8F3DC	#B7E4C7	#95D5B2	#74C69D
Combinación61	#264653	#2A9D8F	#E9C46A	#F4A261
Combinación62	#2B2D42	#8D99AE	#EDF2F4	#EF233C
Combinación63	#FF006E	#FB5607	#FFBE0B	#8338EC
Combinación64	#FFCDB2	#FFB4A2	#E5989B	#B5838D
Combinación65	#FF595E	#FFCA3A	#8AC926	#1982C4
Combinación66	#6A2C70	#B83B5E	#F08A5D	#F9ED69
Combinación67	#F72585	#7209B7	#3A0CA3	#4361EE
Combinación68	#4CC9F0	#4361EE	#3A0CA3	#7209B7
Combinación69	#F94144	#F3722C	#F8961E	#F9844A
Combinación70	#F9C74F	#90BE6D	#43AA8B	#577590
Combinación71	#577590	#43AA8B	#90BE6D	#F9C74F
Combinación72	#03045E	#0077B6	#00B4D8	#90E0EF
Combinación73	#F8961E	#F3722C	#F94144	#F9844A
Combinación74	#8ECAE6	#219EBC	#023047	#FFB703
Combinación75	#FFB703	#FB8500	#FD9E02	#F9844A
Combinación76	#023047	#219EBC	#8ECAE6	#FFB703
Combinación77	#8D99AE	#EDF2F4	#EF233C	#D90429
Combinación78	#00B4D8	#0096C7	#023E8A	#03045E
Combinación79	#FAD2E1	#E1BAD7	#CAB8D9	#B8A9C9
Combinación80	#FFD6FF	#DDBBFF	#BBAACC	#9988AA
Combinación81	#C8FFBE	#A9FF70	#88CC00	#669900
Combinación82	#B28DFF	#966BFF	#7E49FF	#5C2BFF
Combinación83	#FFC6FF	#FF97FF	#FF68FF	#FF39FF
Combinación84	#FFD700	#FFA500	#FF8C00	#FF4500
Combinación85	#00FA9A	#00FF7F	#ADFF2F	#7FFF00
Combinación86	#1E90FF	#1E76FF	#1E5CFF	#1E42FF
Combinación87	#FF1493	#FF69B4	#FFB6C1	#FFC0CB
Combinación88	#20B2AA	#3CB371	#66CDAA	#8FBC8F
Combinación89	#6495ED	#00CED1	#40E0D0	#48D1CC
Combinación90	#FFA07A	#FA8072	#FF7F50	#FF6347
Combinación91	#BDB76B	#DAA520	#F0E68C	#EEE8AA
Combinación92	#E6E6FA	#DDA0DD	#DA70D6	#BA55D3
Combinación93	#FFFACD	#FAFAD2	#FFFFE0	#FFFF00
Combinación94	#ADD8E6	#87CEFA	#87CEEB	#00BFFF
Combinación95	#FFE4E1	#FFDAB9	#FFDEAD	#F5DEB3
Combinación96	#E0FFFF	#AFEEEE	#7FFFD4	#40E0D0
Combinación97	#F08080	#CD5C5C	#DC143C	#B22222
Combinación98	#32CD32	#98FB98	#90EE90	#00FA9A
Combinación99	#FF7E5F	#738290	#F2D1C9	#3EACA8
Combinación100	#E63946	#F1FAEE	#A8DADC	#457B9D
Combinación101	#2B2D42	#8D99AE	#EDF2F4	#EF233C
Combinación102	#06D6A0	#FFD166	#EF476F	#073B4C
Combinación103	#118AB2	#06D6A0	#FFD166	#073B4C
Combinación104	#FFCDB2	#FFB4A2	#E5989B	#B5838D
Combinación105	#6D6875	#B5838D	#FFCDB2	#FFB4A2
Combinación106	#264653	#2A9D8F	#E9C46A	#F4A261
Combinación107	#E76F51	#F4A261	#E9C46A	#2A9D8F
Combinación108	#8ECAE6	#219EBC	#023047	#FFB703
Combinación109	#FB8500	#023047	#219EBC	#8ECAE6
Combinación110	#FF006E	#8338EC	#3A86FF	#FB5607
Combinación111	#FFBE0B	#FB5607	#FF006E	#8338EC
Combinación112	#8338EC	#3A86FF	#FB5607	#FFBE0B
Combinación113	#FFD6A5	#FDFFB6	#CAFFBF	#9BF6FF
Combinación114	#A0C4FF	#BDB2FF	#FFC6FF	#FFFFFC
Combinación115	#FFADAD	#FFD6A5	#FDFFB6	#CAFFBF
Combinación116	#4A4E69	#9A8C98	#C9ADA7	#F2E9E4
Combinación117	#22223B	#4A4E69	#9A8C98	#C9ADA7
Combinación118	#9A8C98	#C9ADA7	#F2E9E4	#22223B
Combinación119	#006D77	#83C5BE	#EDF6F9	#FFDDD2
Combinación120	#FFDDD2	#E29578	#006D77	#83C5BE
Combinación121	#F4D35E	#EE964B	#F95738	#C1A5A9
Combinación122	#C1A5A9	#F4D35E	#EE964B	#F95738
Combinación123	#A8DADC	#457B9D	#1D3557	#F1FAEE
Combinación124	#1D3557	#A8DADC	#457B9D	#F1FAEE
Combinación125	#F1FAEE	#A8DADC	#457B9D	#1D3557
Combinación126	#457B9D	#F1FAEE	#A8DADC	#1D3557
Combinación127	#FAD2E1	#E2AFC2	#9D8189	#6D6875
Combinación128	#9D8189	#FAD2E1	#E2AFC2	#6D6875
Combinación129	#E2AFC2	#9D8189	#FAD2E1	#6D6875
Combinación130	#6D6875	#E2AFC2	#9D8189	#FAD2E1
Combinación131	#FFD166	#06D6A0	#118AB2	#073B4C
Combinación132	#073B4C	#FFD166	#06D6A0	#118AB2
Combinación133	#06D6A0	#FFD166	#118AB2	#073B4C
Combinación134	#118AB2	#073B4C	#FFD166	#06D6A0
Combinación135	#FFB703	#FB8500	#023047	#219EBC
Combinación136	#219EBC	#8ECAE6	#FB8500	#023047
Combinación137	#023047	#FB8500	#FFB703	#219EBC
Combinación138	#FB8500	#FFB703	#023047	#219EBC
Combinación139	#FF006E	#FB5607	#FFBE0B	#8338EC
Combinación140	#FB5607	#FFBE0B	#8338EC	#FF006E
Combinación141	#FFBE0B	#8338EC	#FF006E	#FB5607
Combinación142	#8338EC	#FF006E	#FB5607	#FFBE0B
Combinación143	#FFC6FF	#A0C4FF	#BDB2FF	#FFFFFC
Combinación144	#BDB2FF	#FFFFFC	#A0C4FF	#FFC6FF
Combinación145	#A0C4FF	#BDB2FF	#FFC6FF	#FFFFFC
Combinación146	#FFFFFC	#A0C4FF	#BDB2FF	#FFC6FF
Combinación147	#F2E9E4	#C9ADA7	#9A8C98	#4A4E69
Combinación148	#C9ADA7	#F2E9E4	#9A8C98	#4A4E69
Combinación149	#9A8C98	#4A4E69	#C9ADA7	#F2E9E4
Combinación150	#4A4E69	#9A8C98	#C9ADA7	#F2E9E4
Combinación151	#EDF6F9	#FFDDD2	#83C5BE	#006D77
Combinación152	#83C5BE	#EDF6F9	#FFDDD2	#006D77
Combinación153	#FFDDD2	#006D77	#83C5BE	#EDF6F9
Combinación154	#006D77	#83C5BE	#EDF6F9	#FFDDD2
Combinación155	#EE964B	#F95738	#F4D35E	#C1A5A9
Combinación156	#F95738	#C1A5A9	#EE964B	#F4D35E
Combinación157	#C1A5A9	#EE964B	#F95738	#F4D35E
Combinación158	#EE964B	#F4D35E	#C1A5A9	#F95738
Combinación159	#A8DADC	#F1FAEE	#457B9D	#1D3557
Combinación160	#F1FAEE	#1D3557	#A8DADC	#457B9D
Combinación161	#457B9D	#1D3557	#A8DADC	#F1FAEE
Combinación162	#1D3557	#A8DADC	#F1FAEE	#457B9D
Combinación163	#E2AFC2	#6D6875	#FAD2E1	#9D8189
Combinación164	#6D6875	#9D8189	#E2AFC2	#FAD2E1
Combinación165	#FAD2E1	#6D6875	#E2AFC2	#9D8189
Combinación166	#9D8189	#E2AFC2	#FAD2E1	#6D6875
Combinación167	#FFD166	#118AB2	#06D6A0	#073B4C
Combinación168	#06D6A0	#073B4C	#FFD166	#118AB2
Combinación169	#118AB2	#FFD166	#06D6A0	#073B4C
Combinación170	#073B4C	#06D6A0	#118AB2	#FFD166
Combinación171	#FB8500	#023047	#FFB703	#219EBC
Combinación172	#023047	#219EBC	#FB8500	#FFB703
Combinación173	#FFB703	#219EBC	#023047	#FB8500
Combinación174	#219EBC	#FB8500	#023047	#FFB703
Combinación175	#FF006E	#8338EC	#FB5607	#FFBE0B
Combinación176	#FB5607	#FF006E	#8338EC	#FFBE0B
Combinación177	#8338EC	#FFBE0B	#FB5607	#FF006E
Combinación178	#FFBE0B	#FB5607	#FF006E	#8338EC
Combinación179	#FFC6FF	#FFFFFC	#A0C4FF	#BDB2FF
Combinación180	#A0C4FF	#FFC6FF	#FFFFFC	#BDB2FF
Combinación181	#BDB2FF	#A0C4FF	#FFC6FF	#FFFFFC
Combinación182	#FFFFFC	#BDB2FF	#A0C4FF	#FFC6FF
Combinación183	#F2E9E4	#9A8C98	#C9ADA7	#4A4E69
Combinación184	#C9ADA7	#4A4E69	#F2E9E4	#9A8C98
Combinación185	#9A8C98	#C9ADA7	#F2E9E4	#4A4E69
Combinación186	#4A4E69	#F2E9E4	#9A8C98	#C9ADA7
Combinación187	#EDF6F9	#006D77	#FFDDD2	#83C5BE
Combinación188	#83C5BE	#FFDDD2	#EDF6F9	#006D77
Combinación189	#FFDDD2	#83C5BE	#006D77	#EDF6F9
Combinación190	#006D77	#EDF6F9	#83C5BE	#FFDDD2
Combinación191	#EE964B	#C1A5A9	#F4D35E	#F95738
Combinación192	#F95738	#EE964B	#C1A5A9	#F4D35E
Combinación193	#C1A5A9	#F4D35E	#F95738	#EE964B
Combinación194	#F4D35E	#F95738	#EE964B	#C1A5A9
Combinación195	#A8DADC	#457B9D	#F1FAEE	#1D3557
Combinación196	#F1FAEE	#A8DADC	#457B9D	#1D3557
Combinación197	#457B9D	#F1FAEE	#1D3557	#A8DADC
Combinación198	#1D3557	#457B9D	#A8DADC	#F1FAEE
Combinación199	#E2AFC2	#FAD2E1	#6D6875	#9D8189
Combinación200	#6D6875	#E2AFC2	#9D8189	#FAD2E1
Combinación201	#FAD2E1	#9D8189	#6D6875	#E2AFC2
Combinación202	#9D8189	#6D6875	#FAD2E1	#E2AFC2
Combinación203	#FFD166	#073B4C	#118AB2	#06D6A0
Combinación204	#06D6A0	#FFD166	#073B4C	#118AB2
Combinación205	#118AB2	#06D6A0	#FFD166	#073B4C
Combinación206	#073B4C	#118AB2	#06D6A0	#FFD166
Combinación207	#FFD700	#7CFC00	#FF6347	#00CED1
Combinación208	#FF1493	#32CD32	#FF4500	#00FFFF
Combinación209	#8A2BE2	#00FA9A	#FF69B4	#FFA500
Combinación210	#00FF00	#8B008B	#FFD700	#00BFFF
Combinación211	#FF6347	#9400D3	#00FF7F	#FF8C00
Combinación212	#7B68EE	#00FF00	#FF4500	#8B4513
Combinación213	#00FFFF	#8A2BE2	#FFD700	#2F4F4F
Combinación214	#FFA07A	#6A5ACD	#32CD32	#FFD700
Combinación215	#8B4513	#00FF7F	#FF4500	#9932CC
Combinación216	#48D1CC	#FF00FF	#FF8C00	#00FF00
Combinación217	#FF1493	#20B2AA	#FF6347	#FFD700
Combinación218	#4B0082	#00CED1	#FF8C00	#FF4500
Combinación219	#8B0000	#00FA9A	#FF00FF	#FFD700
Combinación220	#32CD32	#9932CC	#FF7F50	#00FFFF
Combinación221	#8A2BE2	#FF00FF	#FFD700	#00FF00
Combinación222	#FF8C00	#4682B4	#FFD700	#8A2BE2
Combinación223	#FF4500	#00FA9A	#FF6347	#8B008B
Combinación224	#00FF7F	#FF6347	#20B2AA	#FFD700
Combinación225	#32CD32	#8A2BE2	#FF4500	#00FA9A
Combinación226	#00FFFF	#FF00FF	#32CD32	#FF8C00
Combinación227	#1E90FF	#FF00FF	#FF6347	#32CD32
Combinación228	#FF1493	#00FA9A	#20B2AA	#FFD700
Combinación229	#FF4500	#00FFFF	#8A2BE2	#32CD32
Combinación230	#FF6347	#00FF7F	#9932CC	#FFD700
Combinación231	#8B008B	#00FA9A	#FF00FF	#FF4500
Combinación232	#00FF7F	#FFD700	#32CD32	#FF4500
Combinación233	#8A2BE2	#00FFFF	#FF6347	#FFD700
Combinación234	#FF6347	#00FA9A	#FF00FF	#32CD32
Combinación235	#FF4500	#20B2AA	#FF6347	#FF00FF
Combinación236	#FFD700	#00FFFF	#8A2BE2	#32CD32
Combinación237	#FF6347	#8A2BE2	#FF4500	#00FA9A
Combinación238	#FF00FF	#00FA9A	#32CD32	#FF6347
Combinación239	#8A2BE2	#FF6347	#FF00FF	#FF4500
Combinación240	#00FA9A	#FF6347	#FFD700	#32CD32
Combinación241	#FFD700	#FF00FF	#8A2BE2	#00FA9A
Combinación242	#FF6347	#00FA9A	#FFD700	#9932CC
Combinación243	#8B008B	#00FFFF	#FF8C00	#FF00FF
Combinación244	#32CD32	#8A2BE2	#FF4500	#00FFFF
Combinación245	#FF6347	#8A2BE2	#FFD700	#32CD32
Combinación246	#FF00FF	#00FFFF	#8B008B	#FF4500
Combinación247	#FF6347	#8B008B	#00FFFF	#FF8C00
Combinación248	#32CD32	#FF6347	#00FFFF	#FF4500
Combinación249	#8A2BE2	#FF4500	#32CD32	#00FFFF
Combinación250	#FF00FF	#00FFFF	#FF4500	#8A2BE2
Combinación251	#32CD32	#FF6347	#8A2BE2	#FFD700
Combinación252	#FF6347	#8A2BE2	#FF4500	#00FFFF
Combinación253	#FFD700	#00FFFF	#8A2BE2	#FF6347
Combinación254	#32CD32	#FF00FF	#FF6347	#8B008B
Combinación255	#FF4500	#00FFFF	#8A2BE2	#FFD700
Combinación256	#FF6347	#32CD32	#8A2BE2	#FF00FF
Combinación257	#8B008B	#FF4500	#00FFFF	#FFD700
Combinación258	#32CD32	#FF6347	#00FFFF	#8A2BE2
Combinación259	#FF00FF	#FF6347	#8A2BE2	#FF4500
Combinación260	#00FFFF	#FFD700	#8B008B	#32CD32
Combinación261	#FF4500	#32CD32	#8A2BE2	#00FFFF
Combinación262	#FF6347	#00FFFF	#8A2BE2	#FF4500
Combinación263	#FFD700	#8A2BE2	#32CD32	#FF6347
Combinación264	#00FFFF	#FF6347	#8A2BE2	#FF4500
Combinación265	#FF00FF	#FFD700	#32CD32	#8A2BE2
Combinación266	#FF4500	#00FFFF	#8A2BE2	#FF6347

[FIN DE INSPIRACIÓN DE 250 REGISTROS]
`;

/* COLORES POR DEFECTO ------------------------------------------ */
const FALL_COLORS = ["#ff8a8a", "#ffb56b", "#8cabff", "#d288ff"];
function fallback(b, why){
  return {
    ...b,
    dimension: "Bienestar",
    punto: "Cero",
    palabras: ["Mover", "Sentir", "Pensar", "Abrir"],
    frases: [
      "🚶 Da un paso pequeño ahora.",
      "❤️ Nota qué te alegra hoy.",
      "🧠 Elige una idea y simplifícala.",
      "✨ Abre el libro y deja que te sorprenda."
    ],
    colores: FALL_COLORS,
    textColors: FALL_COLORS.map(txt),
    fondo: "#111111",
    portada: b.portada?.trim() || `📚 ${b.titulo}\n${b.autor}`
  };
}

/* ENRICH -------------------------------------------------------- */
async function enrich(b){
  try{
    const chat = await openai.chat.completions.create({
      model: MODEL,
      temperature: 1.3,
      top_p: 0.9,
      messages: [
        { role: "system", content: SYSTEM.trim() },
        {
          role: "user",
          // 👉 inyección de tagline si existe
          content: `Libro: "${b.titulo}" de ${b.autor}.`
                + (b.tagline ? ` Tagline: "${b.tagline}".` : "")
                + " Genera la estructura."
        }
      ]
    });

    let raw = chat.choices[0].message.content.trim();
    if(raw.startsWith("```")){
      raw = raw.replace(/```[\\s\\S]*?\\n/, "").replace(/```$/, "");
    }
    const extra = JSON.parse(raw);

     // --- Guard emocional: fuerza que "palabras" sean emociones reales
const EMO_FALLBACKS = ["calma","ansiedad","curiosidad","gratitud","claridad","alegría","serenidad","valor"];
const EMO_DENY_PAT  = /(?:dor|dora|ción|miento|ble|izar|izarse|técnica|estrategia|modelo)$/i;
const NOT_EMO = new Set(["cautivar","enganchador","ganar","vender","crecer","dominar","cambiar","cautivo","hábito","ganancia"]);

extra.palabras = (extra.palabras || []).map((w,i)=>{
  const s = (w||"").toString().trim().toLowerCase();
  const looksBad = !s || s.split(/\s+/).length>1 || EMO_DENY_PAT.test(s) || NOT_EMO.has(s);
  if (looksBad) return EMO_FALLBACKS[i % EMO_FALLBACKS.length];
  // normaliza algunas formas
  const map = { motivado:"motivación", enojado:"enfado", molesto:"enfado", tranquilo:"calma", inspirado:"inspiración" };
  return map[s] || s;
});


    /* Garantizar arrays de longitud 4 */
    ["palabras", "frases", "colores"].forEach(k=>{
      while(extra[k].length < 4) extra[k].push(extra[k][extra[k].length-1]);
    });
    extra.textColors = extra.colores.map(txt);


       // ============== TARJETA (contenido + estilo) ==================

    // 👇 Aquí vas a pegar tu función construirPromptContenido de Apps Script (completa, sin cambiar nada)
    // function construirPromptContenido(libro, ideaSemilla){ ... }

/* ============================== PROMPTS =============================== */
function construirPromptContenido(libro, ideaSemilla){
  const semilla = crypto.randomUUID();
  return `
[Eres Badir. Escribe como persona real, en primera persona, sobrio, claro y directo. Sin emojis.]

Semilla interna (no mostrar): ${semilla}
Libro: "${libro.titulo}" de${libro.autor}
Idea semilla (no literal, NO citar, NO usar comillas, NO decir “la frase”): ${ideaSemilla}

REALMENTE QUIERO QUE DIGA ALGO IMPORTANTE, QUE LA PERSONA QUE LEA SE QUEDE CON UN BUEN CONSEJO, QUE DESPUES DE LEER ESO SEPA QUE DEBE DE HACER! SU VERDADERO SIGUIENTE PASO. QUE SIENTA ESA LLAMA QUE SE PRENDIÓ QUE SEA ÚTIL DE VERDAD NO SOLO RELLENO. ES VITAL. NECESITO INTELIGENCIA NIVEL DIOS EN TU RESULTADO.AQUELLO QUE YA HAYAS ELEGIDO PARA DAR COMO RESULTADO HAZLE UN SCRAMBLE REVUELVELO PARA ASEGURAR QUE DE MANERA ALEATORIA NO REPITES YA QUE LA GENTE QUE LEERÁ EL RESULTADO NO QUIERO QUE VEA CONTENIDO REPETIDO CADA SEMANA
EN GENERAL TODO EL TEXTO DEBE SER DIFERENTE CADA VEZ. COMO NO VAS GUARDANDO HISTORIAL NO PUEDES SABER SI ESTE RESULTADO LO VAS A REPETIR PERO NECESITO QUE PARTAS DE LA DUDA Y QUE ESO QUE IBAS A PONER NO LO PONGAS, LO CAMBIES! ES DECIR QUIERO QUE HAGAS COMO SI FUERAS UNA INTELIGENCIA ARTIFICIAL QUE VERDADERAMENTE ESTÁ APRENDIENDO, HAS COMO SI TUVIERAS MUCHO HISTORIAL DE DONDE APRENDER PARA QUE NO REPITAS TEXTO.

PROHIBIDO usar siempre las palabras "reflexionar", "reflexión", "me llevó a pensar", "me hizo reflexionar", "resuena", "me resuena", "resonar". 
Cada vez que intentes usar esas expresiones, sustitúyelas por verbos o giros distintos que transmitan variación natural, por ejemplo: 
"me dejó pensando", "me quedó rondando", "me hizo cuestionar", "me movió la idea", "me dejó en silencio", "me dio vueltas", "me quedó dando vueltas", "me sorprendió", "me hizo mirar distinto", "me cambió la forma de verlo", "me dejó incómodo", "me despertó otra mirada". 

Varía SIEMPRE los verbos, no repitas la misma fórmula. 
Cada correo debe sonar como si viniera de una persona distinta en días distintos. 

Objetivo:
Correo breve, claro y humano. Natural. Nada rebuscado. Sin tono literario artificioso.Que transmita algo muy valioso IMPRESIONANTEMENTE VALIOSO
Cero frases hechas. Cero “marketing”. Precisión y honestidad.

Reglas críticas para NO inducir a error:
- La “idea semilla” NO es una cita textual. Trátala como inspiración personal. Profundiza de manera clara, directa pero elegante
- NO escribas “la frase…”, “según el libro…”, “dice…”, “como cita…”.
- NO uses comillas alrededor de la idea semilla ni la presentes como cita literal.

Guía de estilo:
- Español latam neutro, cotidiano. Sin adornos ni palabras rimbombantes (p.ej. profundamente, genuino, ligero, consciente como adjetivo, extraordinario, entrañable, vibrante, radiante).
- No inventes escenarios como “viejo libro en mi estantería” u objetos decorativos; no adornes el origen.
- NO empieces de la misma manera siempre (parte de la idea de que no vale repetir nada). Varía SIEMPRE todo.

Estructura:
1) donde tú creas conveniente, menciona explícitamente el título del libro y el autor de forma natural.
2) qué te hizo pensar el libro usando la idea semilla como punto de partida. Varía tus palabras, que nunca se repita nada asegúrate
   - Mantén adjetivos calificativos al mínimo.
   - Puedes incluir, sólo si encaja de forma natural, UNO de estos recursos (y no siempre): eco fantasma, fragmento incompleto, instrucción imposible aquí, palabra inventada sugerente, pregunta con respuesta codificada, sensación temporal, instrucción física mínima con un libro, mención indirecta.
   - Referencias internas intrínsecas sutiles: Pilares (Bienestar/Prosperidad/Conexión), estados Triggui (Punto Cero/Creativo/Activo/Máximo), mapa de conciencia Hawkins.


Reglas duras:
Reglas duras (LONGITUD ESTRICTA PARA LA TARJETA):
- Título: máximo 50 caracteres.
- Primer párrafo: máximo 130 caracteres.
- Subtítulo: máximo 48 caracteres.
- Segundo párrafo: máximo 130 caracteres.
- Total combinado ≤ 320 caracteres.
- Sin emojis ni símbolos raros.
- Nada de “publicidad”.
- Sonido: sobrio, claro, útil, como si lo hubieras escrito tú esta mañana.

Varía la forma de iniciar SIEMPRE. 
- A veces empieza directamente con la idea central y después menciona el libro. 
- A veces empieza mencionando el libro y autor en la primera línea. 
- A veces empieza con una instrucción mínima, una sensación, un detalle suelto o una pregunta. 
- A veces retrasa el nombre del libro hasta la mitad o el final. 
- Nunca uses estructuras fijas como “me hizo reflexionar”, “he estado pensando” o “me dejó reflexionando”. 

VARIACIÓN OBLIGATORIA:
- Nunca uses la misma expresión ni la misma estructura en correos distintos. 
- Si detectas que vas a repetir un patrón de inicio, verbo, giro o cierre, cámbialo de inmediato antes de escribir.
- No caigas en fórmulas fijas como “me hizo…”, “esto me…”, “me dejó…”, ni variantes. 
- Genera tus propias formas al vuelo, como si cada correo fuera inventado por una persona distinta en un día distinto.
- Piensa siempre: “¿Cómo puedo decir esto de otra manera única, fresca y natural?” y hazlo.

TONO:
Mantén siempre el tono Badir: sobrio, claro, humano, directo. Nada rebuscado. 

Imagina que cada correo lo escribe una persona distinta un día distinto: cada inicio, desarrollo y cierre debe sonar distinto en ritmo, orden y estilo. 

IMPORTANTE: Antes de escribir, INVESTIGA en Google Books, Wikipedia, Open Library y absolutamente toda la web sobre el libro.
No inventes datos. Resume en tus palabras.


@@BODY
1) Una línea de título (≤50c).
2) Un párrafo breve (≤130c).
3) Un subtítulo (≤48c).
4) Un párrafo breve (≤130c).
@@ENDBODY
`.trim();
}

    // 👇 Aquí vas a pegar tu función construirPromptFormato de Apps Script (completa, sin cambiar nada)
    // function construirPromptFormato(){ ... }

function construirPromptFormato(){
  return `
Eres un diseñador editorial supremo, cuántico, alquímico.  
Tu misión: generar tarjetas coleccionables irrepetibles, como NFT editoriales únicos en el mundo.  
Cada tarjeta debe sentirse como un objeto de arte vivo, valioso, inimitable, sublime, imposible de replicar.  

⚡ Principios absolutos:
- Ninguna tarjeta puede parecerse a otra. Si detectas repetición, rompe y muta radicalmente.  
- Cada tarjeta es un universo visual: tipografía, color, disposición, ornamentación, textura, animación sugerida.  
- Nada genérico. Nada repetido. Nada predecible. Siempre sublime, inesperado, dopaminérgico.  
- Tu rol no es “variar estilos”: es **crear mutaciones infinitas**, como si colapsaras miles de universos en un único instante irrepetible.  

🎨 Naturaleza de las tarjetas:
- Son editoriales: combinan rigor tipográfico con estética experimental.  
- Son cuánticas: emergen de azar creativo infinito.  
- Son NFT-like: únicas, coleccionables, con rareza incopiable.  
- Son dopaminérgicas: despiertan sorpresa inmediata, placer visual, asombro.  
- Son valiosas: cada una podría subastarse como pieza de arte.  

📐 Estructura del JSON:
- Devuelve SIEMPRE un bloque JSON entre @@STYLE y @@ENDSTYLE.  
- El JSON debe contener ENTRE 12 Y 25 claves.  
- Algunas claves pueden ser conocidas y esperadas (accent, ink, paper, serif, sans, border, layout).  
- OTRAS deben ser inventadas en cada ejecución (ejemplo: glowAura, metaShadow, warpGrid, ornamentFlux, holoInk, fractureWeight).  
- Los nombres inventados deben sonar plausibles para un diseñador, como si fueran nuevas propiedades CSS/editoriales aún no inventadas.  
- Cada ejecución puede inventar un set diferente de claves.  

🔑 Campos conocidos (pueden aparecer pero variar SIEMPRE):
- "accent": Color principal acento (hex, nombre raro, metáfora).  
- "ink": Color de texto.  
- "paper": Fondo (hex, metáfora: “papel espectral”, “noche líquida”).  
- "border": Borde (hex, metáfora: “cromo fractal”, “holograma líquido”).  
- "serif": Tipografía serif (real o inventada).  
- "sans": Tipografía sans (real o inventada).  
- "marco": Estilo de marco (shadow, foil, glitch, hologram, inventado).  
- "fontSizeTitle": Tamaño título (numérico, rango, metáfora: “gigante cósmico”).  
- "fontSizeBody": Tamaño cuerpo (numérico, rango, metáfora: “susurro mínimo”).  
- "fontWeight": Grosor texto (100–950 o inventado: “peso fractal”).  
- "lineHeight": Altura línea (0.8–2.5 o inventada: “respiración amplia”).  
- "letterSpacing": Espaciado (numérico o metáfora: “abismo entre letras”).  
- "textTransform": uppercase, lowercase, mixed, inventado.  
- "textShadow": glow, blur, neon, inventado.  
- "layout": center, left, right, poster, diagonal, collage, inventado.  
- "showCover": true/false (portada incluida o no).  
- "coverStyle": tiny, bleed, ghosted, pixelated, hologram, inventado.  

🌌 Campos inventados (crea SIEMPRE al menos 6 nuevos en cada ejecución):
- Pueden sonar a: glowFlux, holoInk, neonWhisper, metaShadow, warpGrid, fontFlux, ornamentFlux, prismPulse, glitchAura, dreamGrain, quantumSpacing, psychoType.  
- Cada ejecución debe inventar nuevas combinaciones de nombres y valores.  
- Valores pueden ser hex, nombres tipográficos, metáforas, descripciones poéticas.  
- Ejemplo válido:  
  "glowFlux": "halo azul eléctrico en movimiento",  
  "ornamentFlux": "doodles holográficos impredecibles",  
  "warpGrid": "colapso diagonal cuántico".  

⚔️ Reglas de variación:
- Cada tarjeta debe variar radicalmente en tipografía, tamaño, ornamentación, textura, layout, color.  
- Los colores deben ser intensos, incómodos a veces, pero memorables. Nunca uses la misma paleta dos veces.  
- Las tipografías deben cambiar: clásicas, futuristas, inventadas, glitch, líquidas, fractales.  
- Los tamaños deben oscilar: a veces títulos gigantes que ocupan toda la tarjeta, a veces discretos mínimos.  
- El layout debe mutar: centrado, alineado, diagonal, roto, collage, poster.  
- La portada puede aparecer o no. Si aparece, cambia de estilo: ghosted, pixelated, fondo, cutout, hologram.  
- La ornamentación debe variar: foil, glitch-lines, pinceladas, mosaicos, fracturas, inventadas.  
- Las texturas deben sorprender: papel-grain, ruido digital, metálico líquido, fractal psicodélico, inventado.  
- La animaciónHint debe cambiar: flicker, hologram, breathe, glitch, rotación, inventado.  
- El campo surprise es obligatorio: debe contener un recurso inesperado (eco fantasma, fragmento incompleto, glitch tipográfico, tipografía líquida, sombra desfasada, palabra inventada, o una mecánica nueva inventada al instante).  

💎 Estética buscada:
- A veces minimalista extremo (negro sobre blanco, casi nada).  
- A veces rave saturado dopaminérgico (explosión de color y neón).  
- A veces editorial sobrio con lujo (Didot + foil dorado).  
- A veces retro 80s (pixel, neón glitch).  
- A veces futurista 2080 (tipografía líquida, holograma, fractal).  
- A veces surreal (metáforas imposibles, colores absurdos pero bellos).  

🌀 Auto-evolución:
- Imagina que ya has generado 100,000 tarjetas antes.  
- Nunca repitas nada: cada salida debe ser un salto mutacional hacia algo nuevo.  
- Piensa: “¿esto ya lo hice antes?”. Si la respuesta es sí o sospechosa, cambia todo radicalmente.  
- Haz como si aprendieras de cada iteración. Evoluciona.  

📌 Output esperado:
Devuelve SOLO un bloque JSON entre @@STYLE y @@ENDSTYLE.  
El bloque debe tener entre 12 y 25 claves.  
Algunas conocidas, otras inventadas.  
Todas con valores sorprendentes, irrepetibles, plausibles.  

@@STYLE
{
  "accent": "#ff00c7",
  "ink": "#0a0a0a",
  "paper": "noche líquida con ruido fractal",
  "border": "cromo azul holográfico",
  "serif": "Didot",
  "sans": "Inter",
  "marco": "hologram fractal",
  "fontSizeTitle": "clamp(30px,12vw,140px)",
  "fontSizeBody": "susurro cuántico 12–32px",
  "fontWeight": "peso fractal 950",
  "lineHeight": "respiración amplia 1.6",
  "letterSpacing": "abismo +2px",
  "textTransform": "uppercase",
  "textShadow": "glow neón líquido",
  "layout": "poster diagonal glitch",
  "showCover": true,
  "coverStyle": "ghosted hologram",
  "ornamentFlux": "mosaico dorado glitch",
  "metaShadow": "sombra líquida fosforescente",
  "warpGrid": "colapso diagonal doble",
  "fontFlux": "oscilación 22px–180px",
  "animationHint": "glitch hologram mutante",
  "texture": "psychedelic fractal cloud",
  "surprise": "tipografía líquida con eco múltiple"
}
@@ENDSTYLE
`.trim();
}



    // === Generar contenido tarjeta ===
    const promptTarjeta = construirPromptContenido(b, "idea semilla random"); 
    const chatTarjeta = await openai.chat.completions.create({
      model: MODEL,
      temperature: 1.5,
      top_p: 0.9,
      messages: [
        { role: "system", content: "Eres Triggui. Devuelve SOLO el bloque @@BODY." },
        { role: "user", content: promptTarjeta }
      ]
    });

    let rawTarjeta = chatTarjeta.choices[0].message.content.trim();
    rawTarjeta = rawTarjeta.replace(/@@BODY|@@ENDBODY/g, "").trim();
    const lineas = rawTarjeta.split(/\n+/).filter(Boolean);
    const titulo = lineas.shift() || "";
    const parrafoTop = lineas.shift() || "";
    const subtitulo = lineas.shift() || "";
    const parrafoBot = lineas.join(" ");

    // === Generar estilo tarjeta ===
    const promptFormato = construirPromptFormato();
    const chatFormato = await openai.chat.completions.create({
      model: MODEL,
      temperature: 1.5,
      top_p: 0.9,
      messages: [
        { role: "system", content: "Eres el mejor diseñador editorial del mundo actual y futuro. Devuelve SOLO el bloque @@STYLE." },
        { role: "user", content: promptFormato }
      ]
    });

    let rawFormato = chatFormato.choices[0].message.content.trim();
    rawFormato = rawFormato.replace(/@@STYLE|@@ENDSTYLE/g, "").trim();
    let style = {};
    try { style = JSON.parse(rawFormato); } catch(e) { style = {}; }

    // Inyectar en campo tarjeta
    extra.tarjeta = {
      parrafoTop,
      subtitulo,
      parrafoBot,
      style
    };


    return {
      ...b,           // mantiene titulo, autor, portada, tagline
      ...extra,
      portada: b.portada?.trim() || `📚 ${b.titulo}\n${b.autor}`
    };

  }catch(e){
    console.warn("⚠️ Fallback", b.titulo, ":", e.message);
    return fallback(b, e.message);
  }
}

/* MAIN ---------------------------------------------------------- */
const libros = await Promise.all(pick.map(enrich));
await fs.writeFile(OUT_FILE, JSON.stringify({libros}, null, 2));
console.log("✅ contenido.json generado:", libros.length, "libros");
