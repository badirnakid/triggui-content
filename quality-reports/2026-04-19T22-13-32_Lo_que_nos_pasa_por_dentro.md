# Quality Report — Lo que nos pasa por dentro

**Autor:** Eduardo Punset
**Ejecutado:** 2026-04-19T22-13-32
**Pipeline:** nucleus-canonical-v3

---

## 🌐 Grounding

- **Source:** `model_inference`
- **Tier reached:** 3
- **Book identity confidence:** 0.39
- **Resolution path:** tier2a_miss_http_429 → tier2b_miss_no_subjects → tier3_conf_0.70


### Libros similares considerados (inferencia)
- **El hombre en busca de sentido** (Viktor Frankl): Explora la condición humana y la búsqueda de significado en la vida.
- **Inteligencia emocional** (Daniel Goleman): Aborda aspectos de la psicología humana y cómo nuestras emociones influyen en nuestro comportamiento.
- **Los hombres son de Marte, las mujeres son de Venus** (John Gray): Analiza las diferencias en las relaciones humanas y la comunicación entre géneros.
- **La sombra del viento** (Carlos Ruiz Zafón): Aunque es ficción, trata sobre las experiencias humanas y su impacto en la vida de las personas.


### Ground truth utilizado
```
TEMA INFERIDO (el modelo no conoce este libro directamente, infiere desde similares):

La exploración de la condición humana, incluyendo la infancia, el amor, el miedo y la búsqueda de significado en la vida.

VOZ INFERIDA:
Reflexiva y analítica, con un enfoque en la psicología y el desarrollo personal.

LIBROS SIMILARES QUE COMPARTEN ADN CON ESTE:
- "El hombre en busca de sentido" (Viktor Frankl): Explora la condición humana y la búsqueda de significado en la vida.
- "Inteligencia emocional" (Daniel Goleman): Aborda aspectos de la psicología humana y cómo nuestras emociones influyen en nuestro comportamiento.
- "Los hombres son de Marte, las mujeres son de Venus" (John Gray): Analiza las diferencias en las relaciones humanas y la comunicación entre géneros.
- "La sombra del viento" (Carlo...
```

---

## ⚓ Anchors extraídos

**Conceptos:**
- la huella imborrable de la infancia
- los laberintos del amor
- el miedo a la muerte
- la turbulenta adolescencia
- la medicina personalizada

**Key terms:** condición humana, psicología, desarrollo personal, significado, emociones

**Voz autorial:** Reflexiva y analítica, con un enfoque en la psicología y el desarrollo personal.

---

## 🎨 Visual synthesis

- hue_primary: 200
- saturation: balanced
- lightness_paper: medium_light
- temperature_shift: 0
- palette_strategy: analogous
- typography: serif_moderno
- Resultado: paper=#CFD2D3, accent=#1F99D6, ink=#171A1C, contraste=11.50:1

---

## 👨‍⚖️ Grounding judges

### ES
- Score: 1.00
- Usa conceptos específicos: true
- Podría aplicar a cualquier libro: false
- Razón: El contenido generado refleja de manera específica los conceptos del ground_truth, como la exploración de la infancia, el amor, el miedo y la búsqueda de significado. Frases como 'La infancia deja una huella imborrable' y 'El miedo a la muerte es un motor de la búsqueda de significado' se alinean directamente con los temas inferidos, mostrando una profunda conexión con la condición humana y el aut

### EN
- Score: 0.90
- Usa conceptos específicos: true
- Razón: The content strongly reflects the ground truth by focusing on childhood's impact on emotions and personal development, which aligns with the exploration of the human condition. Phrases like 'Childhood shapes our emotions and beliefs profoundly' and 'Understanding our past is key to personal growth' directly connect to the themes of childhood, love, and the search for meaning. The content is not so

---

## 🎭 Voice verdict

- Consolidated: **pagina** (conf 0.90)
- ES: pagina — Uso de voz directa y preguntas reflexivas sin referencias externas.
- EN: pagina — Voz directa y reflexiones personales sobre la infancia.

---

## 📊 Confidence (calculada desde 4 señales ortogonales)

- **book_grounding:** 0.39 ← del tier de grounding alcanzado
- **voice_authenticity:** 0.93 ← del voice judge
- **specificity:** 0.95 ← anti-genericidad de anchors
- **grounding_judge:** 0.95 ← promedio de los 2 judges
- **Combined:** **0.78**

---

## ✅ Validación final

**Overall:** `pass`
Sin warnings.

---

## 💰 Métricas

- LLM calls: 8
- Tokens totales: 9067
- Tiempo total: 24.8s
- Modelos usados: gpt-4o-mini-2024-07-18

### Por fase
- grounding: 632 tokens, 6168ms
- anchors: 2309 tokens, 4232ms
- palette: 0 tokens, 0ms
- content_es: 2056 tokens, 4912ms
- judge_es: 858 tokens, 2232ms
- content_en: 1583 tokens, 4551ms
- judge_en: 787 tokens, 1984ms
- voice: 842 tokens, 738ms
