# PLANTILLA — Cómo crear un lente nuevo para Triggui

> Este archivo es una **plantilla**, no un lente activo.
> El guion bajo al inicio del nombre (`_template.md`) le dice al sistema que lo ignore.
> Cuando crees un lente nuevo, copia este archivo y quítale el guion bajo.

---

## ¿Qué es un lente?

Un lente es una manera de leer el mundo.

Cuando alguien te cuenta algo, tú lo escuchas con un lente. Si eres terapeuta, escuchas con el lente de la psicología. Si eres ingeniero, escuchas con el lente de los sistemas. Si eres madre, escuchas con el lente del cuidado.

Triggui hace lo mismo, pero formalizado: cada lente es una manera específica de leer el momento humano del usuario, y cada lente cambia qué libro se recomienda y cómo se escribe la tarjeta editorial.

Hay lentes generales (cronobiología, autoconocimiento) y puede haber lentes muy específicos (terapia narrativa, estoicismo, economía conductual, mindfulness). Los lentes se prenden y apagan. Pueden combinarse.

---

## ¿Cómo crear uno nuevo?

Sigue estos pasos:

1. **Copia este archivo** y quítale el guion bajo del nombre. Por ejemplo: `_template.md` → `mindfulness.md` o `estoicismo.md` o `narrative-therapy.md`.

2. **El nombre del archivo es el ID del lente.** Usa minúsculas, sin acentos, con guiones medios para separar palabras.

3. **Llena las 11 secciones** que vienen abajo. Cada sección tiene una pregunta clara y un ejemplo. Solo borra los ejemplos cuando hayas escrito tu propia versión.

4. **Edita `lenses-registry.json`** y agrega tu lente con `"active": 1`.

5. **Listo.** El próximo run del sistema lo carga automáticamente.

---

## ¿Cómo se ve un lente bien hecho?

Antes de empezar a llenar, abre alguno de los lentes que ya existen como referencia:

- `prompts/lenses/chronobiology.md` — lee el momento humano según el tiempo (día, hora, ritmo del cuerpo)
- `prompts/lenses/game-theory.md` — lee como estructura de decisiones e incentivos
- `prompts/lenses/self-knowledge.md` — lee patrones internos y autoconocimiento

Mira cómo están escritos. Tu lente debe sentirse así de claro, así de específico, así de útil.

---

# PLANTILLA EMPIEZA AQUÍ
# (cuando llenes este archivo, borra el bloque de arriba y deja solo lo de abajo)

---

# Lente: [Aquí va el nombre claro y corto del lente]

## 1. ¿De qué trata este lente?

Aquí escribe 2-3 párrafos como si le explicaras a un amigo qué hace este lente. Sin tecnicismos. Solo qué busca este lente cuando lee el momento de alguien. Y qué NO busca hacer.

**EJEMPLO** (lente imaginario llamado "cuerpo"):

> Este lente lee los momentos humanos a través del cuerpo. Cuando alguien dice algo, este lente se pregunta qué está sintiendo el cuerpo de esa persona ahora mismo, antes de que la mente lo interprete.
>
> No diagnostica. No moraliza. No promete sanación. Solo escucha lo que el cuerpo ya estaba diciendo antes de que la mente lo notara.
>
> Su valor está en hacer visible una señal corporal que estaba ahí pero que la persona no había nombrado.

---

## 2. ¿Qué le importa a este lente?

Escribe entre 5 y 8 cosas a las que este lente le presta atención. Frases cortas. Si el detonante de la persona toca alguna de estas cosas, este lente debe ganar fuerza.

**EJEMPLO**:

- señales del cuerpo (cansancio, hambre, tensión, sueño)
- patrones que se repiten en la semana o el mes
- la diferencia entre lo que se siente y lo que se cuenta
- el momento exacto antes de que algo se vuelva problema
- lo que el cuerpo intuye antes de que la cabeza entienda
- ritmos naturales que no se respetan
- síntomas físicos que la mente está minimizando

---

## 3. ¿Qué preguntas se hace este lente por dentro?

Escribe entre 5 y 7 preguntas que el sistema se hace cuando este lente está activo. Estas preguntas guían la lectura, pero NO se imprimen en la tarjeta. Son herramientas de pensamiento.

**EJEMPLO**:

- ¿Qué estaba mostrando el cuerpo antes de que se volviera obvio?
- ¿Qué señal fue ignorada o minimizada?
- ¿Qué parte del problema viene de adentro, no de afuera?
- ¿Qué pequeño acto de notar cambiaría más que una explicación larga?
- ¿Qué hábito reciente está produciendo este síntoma?

---

## 4. ¿Qué tipo de libro favorece este lente?

Describe qué clase de libros este lente prefiere recomendar y cuáles NO.

**EJEMPLO**:

**SÍ favorece:**
- libros que enseñen a leer señales internas con precisión
- libros que conecten experiencia vivida con comprensión útil
- libros que reduzcan autoengaño sin moralizar
- obras de autores que combinan rigor y voz personal

**NO favorece:**
- libros de motivación genérica
- libros con promesas infladas de transformación rápida
- libros que prometen curación sin esfuerzo
- bestsellers de wellness sin profundidad

---

## 5. ¿Qué tipo de tarjeta produce este lente?

Cuando este lente está activo, ¿hacia qué tipo de verdad debe empujar la pieza editorial? ¿Qué tonos debe evitar?

**EJEMPLO**:

La tarjeta debe empujar hacia:
- una observación corporal o sensorial específica
- una microacción que no requiera fuerza de voluntad
- una verdad útil que se sienta inmediata, no abstracta

Debe evitar:
- sonar como sermón médico
- frases motivacionales de bienestar
- promesas que el lector no puede verificar
- vocabulario clínico frío

---

## 6. ¿Qué tono debe tener la tarjeta?

De estas opciones, elige las que mejor encajen con tu lente:

- **observacional** — describe lo que está pasando sin juzgar
- **contemplativo** — invita a pausa, sin urgencia
- **quirúrgico** — preciso, corta lo innecesario
- **aforístico** — frases breves con peso
- **frontal** — directo, sin rodeos
- **íntimo** — cercano, casi como susurro
- **táctico** — práctico, orientado a acción
- **directo** — sin metáfora, claro

Marca cuáles SÍ usar normalmente, cuáles a veces, cuáles evitar.

**EJEMPLO**:

- **SÍ usar normalmente:** observacional, contemplativo
- **A veces:** íntimo, quirúrgico
- **Evitar:** aforístico vacío, confrontativo, mesiánico

---

## 7. ¿Qué tipo de verdad busca este lente?

Escribe 3-5 frases que ejemplifican el tipo de verdad que este lente apunta. Estas frases son **dirección conceptual**. NO son lo que se va a imprimir literal en la tarjeta.

**EJEMPLO**:

- lo que se repite en el cuerpo no se nota mientras ocurre
- el cuerpo avisa antes que la narrativa mental
- una reacción no explica nada por sí sola; un patrón sí
- observar mejor a tiempo evita corregir demasiado tarde
- la sensación física es información, no problema

---

## 8. ¿Qué tipo de acción privilegia?

Escribe los verbos que mejor describen las microacciones que sugiere este lente. La acción debe poder hacerse en 15 a 60 segundos.

**EJEMPLO**:

**Verbos:** notar, nombrar, registrar, comparar, pausar, medir, observar

**Ejemplos de tipos de acción** (no son textos finales, son clases de acción):
- notar una señal física específica del momento (tensión en hombros, respiración corta)
- escribir la diferencia entre lo que se sintió y lo que ocurrió
- identificar el primer momento del patrón en el día de hoy
- medir una variable sencilla del estado actual (hambre 1-10, cansancio 1-10)

---

## 9. ¿Qué cosas NO debe hacer este lente?

Lista entre 6 y 10 cosas que delatan que el lente está mal aplicado. Sé específico — esto le ayuda al sistema a evitar errores típicos.

**EJEMPLO**:

- sonar terapéutico sin fundamento
- tratar cualquier detonante como trauma
- inflar la introspección hasta volverla inútil
- usar lenguaje blando o nebuloso ("conecta con tu energía", "escucha tu interior")
- vender "conciencia" como adorno verbal
- prescribir prácticas largas (más de 60 segundos)
- recomendar dietas, suplementos, productos
- patologizar lo que es normal

---

## 10. ¿Con qué intensidad por defecto?

Elige una intensidad por defecto y di cuándo cambiarla.

**Intensidades posibles:**
- **low** — el lente sugiere pero no insiste. Bueno para momentos delicados o vulnerables.
- **medium** — el lente influye pero deja espacio. La mayoría de los casos.
- **high** — el lente domina la lectura. Solo cuando el detonante muestra una verdad demasiado obvia que está siendo evitada.

**EJEMPLO**:

- **Por defecto:** medium
- **Usar low cuando:** el momento es delicado, hay vulnerabilidad reciente, la persona está empezando proceso
- **Usar high cuando:** el detonante muestra evasión obvia que vale la pena confrontar, sin crueldad

---

## 11. La regla final del lente

Una sola frase que captura cómo se siente la persona si este lente fue bien aplicado.

Empieza con: *"Si este lente está bien aplicado, la persona dice internamente:"* y cierra con la frase que la persona pensaría.

**EJEMPLO**:

> Si este lente está bien aplicado, la persona dice internamente:
> **"Eso ya estaba pasando en mi cuerpo. Ahora ya lo vi mejor."**

---

# PLANTILLA TERMINA AQUÍ

---

## Después de llenar tu lente

1. **Guarda el archivo** en `prompts/lenses/[mi-lente-id].md`
2. **Edita `lenses-registry.json`** y agrega:
   ```json
   { "id": "mi-lente-id", "active": 1, "type": "interpretive" }
   ```
3. **(Opcional pero recomendado)** Crea un fixture de prueba en `tests/fixtures/case-XXX-[mi-lente-id].json` con un detonante donde tu lente debería ganar fuerza
4. **Commit y push**
5. **Dispara el workflow** `triggui.yml` en modo `📘 single_book` con un libro relevante al lente, para validar que se carga sin errores
6. **Si todo bien:** el lente está vivo. Próximo batch lo usa.

---

## Cómo desactivar un lente sin borrarlo

Si quieres pausar un lente (porque está produciendo resultados raros, o quieres testear sin él), NO borres el archivo. Solo cambia su toggle:

```json
{ "id": "mi-lente-id", "active": 0, "type": "interpretive" }
```

El sistema deja de cargarlo. Cuando lo prendas de nuevo (cambiar 0 a 1), vuelve a participar. Sin perder nada.

---

## Cómo borrar un lente permanentemente

Si estás seguro de que ya no lo quieres:

1. Borra el archivo `.md` de `prompts/lenses/`
2. Borra la línea correspondiente de `lenses-registry.json`
3. Commit

⚠️ **Advertencia:** los libros existentes en `contenido.json` que tengan compatibilidad calculada con ese lente conservan ese campo. No causa daño (el sistema ignora lentes que no existen en el registry), pero si te molesta verlos puedes correr un script de limpieza.

---

## Sugerencias de lentes futuros

Estos son lentes que tendría sentido formalizar cuando llegue un cliente B2B o cuando quieras ampliar la cobertura del sistema:

- **narrative-therapy** — terapia narrativa (Michael White, David Epston). Útil para clientes terapéuticos.
- **stoicism** — estoicismo clásico (Marco Aurelio, Epicteto, Séneca). Útil para coaching ejecutivo y liderazgo.
- **behavioral-econ** — economía conductual (Kahneman, Thaler, Ariely). Útil para programas de toma de decisiones.
- **mindfulness** — atención plena contemplativa (Kabat-Zinn, Thich Nhat Hanh). Útil para apps de meditación y bienestar.
- **gestalt** — terapia gestalt (Fritz Perls). Útil para procesos de awareness corporal.
- **systems-thinking** — pensamiento sistémico (Donella Meadows, Peter Senge). Útil para liderazgo organizacional.
- **archetypes** — arquetipos junguianos. Útil para procesos de identidad y narrativa personal.
- **somatic** — somática (Peter Levine, Bessel van der Kolk). Útil para trauma y regulación nerviosa.

Cada uno de estos toma 4-6 horas formalizar usando esta plantilla. Cada uno expande el mercado en el que Triggui es vendible.