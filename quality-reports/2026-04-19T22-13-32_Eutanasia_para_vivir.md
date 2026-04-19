# Quality Report — Eutanasia para vivir

**Autor:** Martín Achirica
**Ejecutado:** 2026-04-19T22-13-32
**Pipeline:** nucleus-canonical-v3

---

## 🌐 Grounding

- **Source:** `model_inference`
- **Tier reached:** 3
- **Book identity confidence:** 0.39
- **Resolution path:** tier2a_miss_http_429 → tier2b_miss_no_results → tier3_conf_0.70


### Libros similares considerados (inferencia)
- **La muerte y la vida** (Jorge Luis Borges): Explora la relación entre la muerte y la existencia, tocando temas filosóficos y espirituales.
- **El arte de morir** (Julián Carrón): Reflexiona sobre la muerte desde una perspectiva espiritual y existencial.
- **La vida después de la muerte** (Deepak Chopra): Aborda la conexión entre la ciencia y la espiritualidad en el contexto de la vida y la muerte.
- **La ciencia y la espiritualidad** (Fritjof Capra): Analiza la intersección entre ciencia y espiritualidad, similar al enfoque del libro buscado.


### Ground truth utilizado
```
TEMA INFERIDO (el modelo no conoce este libro directamente, infiere desde similares):

La interconexión entre la vida, la muerte, la ciencia y la espiritualidad, así como la búsqueda de un nuevo paradigma de bienestar.

VOZ INFERIDA:
Reflexiva y filosófica, con un enfoque integrador que busca conectar diferentes aspectos de la existencia humana.

LIBROS SIMILARES QUE COMPARTEN ADN CON ESTE:
- "La muerte y la vida" (Jorge Luis Borges): Explora la relación entre la muerte y la existencia, tocando temas filosóficos y espirituales.
- "El arte de morir" (Julián Carrón): Reflexiona sobre la muerte desde una perspectiva espiritual y existencial.
- "La vida después de la muerte" (Deepak Chopra): Aborda la conexión entre la ciencia y la espiritualidad en el contexto de la vida y la muerte.
- "La ci...
```

---

## ⚓ Anchors extraídos

**Conceptos:**
- interconexión entre vida y muerte
- nuevo paradigma de bienestar
- vinculación entre ciencia y espiritualidad
- integración de lo visible y lo invisible
- arquetipo del sentido de la existencia

**Key terms:** bienestar integrativo, paradigma, arquetipo, espiritualidad, ciencia

**Voz autorial:** Reflexiva y filosófica, con un enfoque integrador que busca conectar diferentes aspectos de la existencia humana.

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
- Razón: The generated content explicitly addresses the interconnection between life and death, as well as the integration of science and spirituality, which are key concepts in the inferred ground truth of the book. Phrases like 'la interconexión de la existencia' and 'la vinculación entre ciencia y espiritualidad' directly reflect the themes of the book, demonstrating a deep alignment with its core ideas

### EN
- Score: 0.90
- Usa conceptos específicos: true
- Razón: The generated content closely reflects the inferred themes of interconnection between life and death, as well as the integration of science and spirituality. Phrases like 'Life and death are intertwined in existence's fabric' and 'The linkage between science and spirituality offers a fresh perspective on existence' directly relate to the ground truth concepts. The content is not generic and is not

---

## 🎭 Voice verdict

- Consolidated: **pagina** (conf 0.90)
- ES: pagina — Tono reflexivo y directo, sin referencias externas al libro.
- EN: pagina — Tono reflexivo y directo, sin referencias externas al libro.

---

## 📊 Confidence (calculada desde 4 señales ortogonales)

- **book_grounding:** 0.39 ← del tier de grounding alcanzado
- **voice_authenticity:** 0.93 ← del voice judge
- **specificity:** 0.86 ← anti-genericidad de anchors
- **grounding_judge:** 0.95 ← promedio de los 2 judges
- **Combined:** **0.76**

---

## ✅ Validación final

**Overall:** `pass`
Sin warnings.

---

## 💰 Métricas

- LLM calls: 8
- Tokens totales: 9012
- Tiempo total: 22.1s
- Modelos usados: gpt-4o-mini-2024-07-18

### Por fase
- grounding: 633 tokens, 4334ms
- anchors: 2327 tokens, 4357ms
- palette: 0 tokens, 0ms
- content_es: 2066 tokens, 5136ms
- judge_es: 846 tokens, 1911ms
- content_en: 1564 tokens, 3982ms
- judge_en: 787 tokens, 1710ms
- voice: 789 tokens, 671ms
