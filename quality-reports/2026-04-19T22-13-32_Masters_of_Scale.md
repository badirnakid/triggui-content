# Quality Report — Masters of Scale

**Autor:** Reid Hoffman
**Ejecutado:** 2026-04-19T22-13-32
**Pipeline:** nucleus-canonical-v3

---

## 🌐 Grounding

- **Source:** `model_inference`
- **Tier reached:** 3
- **Book identity confidence:** 0.39
- **Resolution path:** tier2a_miss_http_429 → tier2b_miss_no_subjects → tier3_conf_0.70


### Libros similares considerados (inferencia)
- **El arte de empezar** (Guy Kawasaki): Ambos libros tratan sobre el emprendimiento y la mentalidad necesaria para iniciar y escalar un negocio.
- **Lean Startup** (Eric Ries): Se centra en la metodología para crear y escalar startups, abordando la mentalidad emprendedora.
- **Start with Why** (Simon Sinek): Explora la importancia de la mentalidad y el propósito en los negocios y el liderazgo.
- **The Innovator's Dilemma** (Clayton Christensen): Analiza cómo las empresas pueden escalar y adaptarse a los cambios en el mercado.


### Ground truth utilizado
```
TEMA INFERIDO (el modelo no conoce este libro directamente, infiere desde similares):

El libro probablemente trata sobre la mentalidad emprendedora necesaria para escalar un negocio exitoso, enfatizando la importancia de la mentalidad sobre la estrategia o el talento.

VOZ INFERIDA:
La voz del autor podría ser motivacional y práctica, orientada a emprendedores y líderes de negocios, con un enfoque en la acción y el desarrollo personal.

LIBROS SIMILARES QUE COMPARTEN ADN CON ESTE:
- "El arte de empezar" (Guy Kawasaki): Ambos libros tratan sobre el emprendimiento y la mentalidad necesaria para iniciar y escalar un negocio.
- "Lean Startup" (Eric Ries): Se centra en la metodología para crear y escalar startups, abordando la mentalidad emprendedora.
- "Start with Why" (Simon Sinek): Explora ...
```

---

## ⚓ Anchors extraídos

**Conceptos:**
- la mentalidad emprendedora como clave para el éxito
- cultivar una mentalidad que prioriza la acción sobre la estrategia
- la importancia de aprender de los fracasos en el camino hacia el escalamiento

**Key terms:** mentalidad emprendedora, escalamiento, estrategia de negocios, talento, desarrollo personal

**Voz autorial:** La voz del autor es motivacional y práctica, enfocada en emprendedores y líderes, promoviendo la acción y el crecimiento personal.

---

## 🎨 Visual synthesis

- hue_primary: 200
- saturation: vivid
- lightness_paper: medium_light
- temperature_shift: 10
- palette_strategy: triadic
- typography: sans_humanista
- Resultado: paper=#CFD1D3, accent=#127AE2, ink=#171A1C, contraste=11.42:1

---

## 👨‍⚖️ Grounding judges

### ES
- Score: 1.00
- Usa conceptos específicos: true
- Podría aplicar a cualquier libro: false
- Razón: El contenido generado se alinea perfectamente con el tema del libro sobre la mentalidad emprendedora. Utiliza conceptos específicos como 'mentalidad emprendedora', 'acción', 'adaptabilidad' y 'aprendizaje constante', que son fundamentales en la discusión sobre cómo escalar un negocio exitoso. Además, las frases y bloques de edición refuerzan la idea de que el fracaso es parte del proceso de éxito,

### EN
- Score: 1.00
- Usa conceptos específicos: true
- Razón: The content directly reflects the inferred themes of the book, emphasizing the importance of the entrepreneurial mindset, adaptability, and continuous learning, which are crucial for scaling a business. Phrases like 'The key to scaling is a mindset of action' and 'Failure is merely a stepping stone to greater success' align closely with the inferred focus on mindset over strategy or talent.

---

## 🎭 Voice verdict

- Consolidated: **pagina** (conf 0.90)
- ES: pagina — Uso de voz directa y preguntas retóricas sin referencias externas.
- EN: pagina — Uso de voz directa y preguntas retóricas.

---

## 📊 Confidence (calculada desde 4 señales ortogonales)

- **book_grounding:** 0.39 ← del tier de grounding alcanzado
- **voice_authenticity:** 0.93 ← del voice judge
- **specificity:** 0.91 ← anti-genericidad de anchors
- **grounding_judge:** 1 ← promedio de los 2 judges
- **Combined:** **0.78**

---

## ✅ Validación final

**Overall:** `pass`
Sin warnings.

---

## 💰 Métricas

- LLM calls: 8
- Tokens totales: 9033
- Tiempo total: 24.7s
- Modelos usados: gpt-4o-mini-2024-07-18

### Por fase
- grounding: 596 tokens, 5619ms
- anchors: 2313 tokens, 4781ms
- palette: 0 tokens, 0ms
- content_es: 2070 tokens, 4909ms
- judge_es: 854 tokens, 2266ms
- content_en: 1597 tokens, 4613ms
- judge_en: 799 tokens, 1772ms
- voice: 804 tokens, 750ms
