# Quality Report — Cambie Sus Pensamientos Cambie Su Vida

**Autor:** Dr. Wayne W. Dyer
**Ejecutado:** 2026-04-19T22-13-32
**Pipeline:** nucleus-canonical-v3

---

## 🌐 Grounding

- **Source:** `model_inference`
- **Tier reached:** 3
- **Book identity confidence:** 0.39
- **Resolution path:** tier2a_miss_http_429 → tier2b_miss_no_results → tier3_conf_0.70


### Libros similares considerados (inferencia)
- **El Tao de la Física** (Fritjof Capra): Explora la relación entre la filosofía oriental y la física moderna, similar a la interpretación de Dyer sobre el Tao.
- **El poder del ahora** (Eckhart Tolle): Se centra en la transformación personal y la espiritualidad, resonando con el enfoque de Dyer sobre el cambio de pensamiento.
- **Despierta tu héroe interior** (Victor Hugo): Aborda la transformación personal y el autoconocimiento, temas que también se encuentran en la obra de Dyer.
- **Los cuatro acuerdos** (Don Miguel Ruiz): Ofrece principios de vida que promueven el cambio personal y la paz interior, en línea con el mensaje de Dyer.
- **El camino del artista** (Julia Cameron): Fomenta la autoexploración y el crecimiento personal, similar al enfoque de Dyer en la transformación a través de la meditación y la reflexión.


### Ground truth utilizado
```
TEMA INFERIDO (el modelo no conoce este libro directamente, infiere desde similares):

Transformación personal y espiritualidad a través de la filosofía oriental, específicamente el Taoísmo.

VOZ INFERIDA:
Reflexiva y motivacional, con un enfoque en la autoayuda y el crecimiento personal.

LIBROS SIMILARES QUE COMPARTEN ADN CON ESTE:
- "El Tao de la Física" (Fritjof Capra): Explora la relación entre la filosofía oriental y la física moderna, similar a la interpretación de Dyer sobre el Tao.
- "El poder del ahora" (Eckhart Tolle): Se centra en la transformación personal y la espiritualidad, resonando con el enfoque de Dyer sobre el cambio de pensamiento.
- "Despierta tu héroe interior" (Victor Hugo): Aborda la transformación personal y el autoconocimiento, temas que también se encuentran en...
```

---

## ⚓ Anchors extraídos

**Conceptos:**
- transformación personal a través de la filosofía del Tao
- práctica diaria de la meditación y reflexión
- alineación con la naturaleza para alcanzar la paz interior

**Key terms:** Taoísmo, Lao-Tsé, autoconocimiento, sabiduría antigua, cambio de mentalidad

**Voz autorial:** La voz de Dyer es reflexiva y motivacional, enfocándose en la autoayuda y el crecimiento personal, invitando a los lectores a una profunda introspección y transformación.

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
- Razón: The generated content is deeply anchored in the themes of personal transformation and spirituality through Taoism, directly reflecting the inferred ground truth of the book. Phrases like 'sabiduría antigua del Tao' and 'alinear nuestros pensamientos con la naturaleza' specifically reference Taoist concepts, while the focus on meditation and self-reflection aligns perfectly with the book's emphasis

### EN
- Score: 1.00
- Usa conceptos específicos: true
- Razón: The content is deeply anchored in the themes of personal transformation and spirituality through Taoism, explicitly referencing concepts such as meditation, reflection, and alignment with nature, which are central to the inferred ground truth. Phrases like 'ancient wisdom of the Tao' and 'harmony Lao-Tzu spoke of' demonstrate a clear connection to the specific philosophical framework of the book.

---

## 🎭 Voice verdict

- Consolidated: **pagina** (conf 0.90)
- ES: pagina — Voz directa y reflexiones personales sobre el tema.
- EN: pagina — Voz directa y reflexiones personales sobre transformación.

---

## 📊 Confidence (calculada desde 4 señales ortogonales)

- **book_grounding:** 0.39 ← del tier de grounding alcanzado
- **voice_authenticity:** 0.93 ← del voice judge
- **specificity:** 0.95 ← anti-genericidad de anchors
- **grounding_judge:** 1 ← promedio de los 2 judges
- **Combined:** **0.79**

---

## ✅ Validación final

**Overall:** `pass`
Sin warnings.

---

## 💰 Métricas

- LLM calls: 8
- Tokens totales: 9869
- Tiempo total: 25.4s
- Modelos usados: gpt-4o-mini-2024-07-18

### Por fase
- grounding: 872 tokens, 5924ms
- anchors: 2581 tokens, 4925ms
- palette: 0 tokens, 0ms
- content_es: 2149 tokens, 5222ms
- judge_es: 910 tokens, 2049ms
- content_en: 1665 tokens, 3982ms
- judge_en: 851 tokens, 2507ms
- voice: 841 tokens, 792ms
