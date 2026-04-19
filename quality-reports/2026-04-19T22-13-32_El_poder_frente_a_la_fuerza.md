# Quality Report — El poder frente a la fuerza

**Autor:** David R. Hawkins
**Ejecutado:** 2026-04-19T22-13-32
**Pipeline:** nucleus-canonical-v3

---

## 🌐 Grounding

- **Source:** `model_inference`
- **Tier reached:** 3
- **Book identity confidence:** 0.39
- **Resolution path:** tier2a_miss_http_429 → tier2b_miss_no_results → tier3_conf_0.70


### Libros similares considerados (inferencia)
- **El poder del ahora** (Eckhart Tolle): Ambos libros abordan la conciencia y el crecimiento personal, centrándose en la espiritualidad y la transformación interna.
- **Los secretos de la mente millonaria** (T. Harv Eker): Explora la relación entre la mentalidad y el éxito, similar a la distinción entre poder y fuerza en el contexto personal.
- **Despierta tu héroe interior** (Victor Hugo Manzanilla): Se enfoca en el autoconocimiento y el desarrollo personal, tocando temas de poder interno.
- **La sabiduría de las emociones** (Norberto Levy): Trata sobre la comprensión de las emociones y su impacto en la vida, alineándose con el enfoque del libro buscado.


### Ground truth utilizado
```
TEMA INFERIDO (el modelo no conoce este libro directamente, infiere desde similares):

El libro probablemente explora la relación entre la conciencia, las emociones y el poder personal, enfatizando la importancia de alinearse con un poder más elevado en lugar de depender de la fuerza personal.

VOZ INFERIDA:
La voz del autor parece ser reflexiva y orientada hacia el autoconocimiento, con un enfoque en la espiritualidad y el desarrollo personal.

LIBROS SIMILARES QUE COMPARTEN ADN CON ESTE:
- "El poder del ahora" (Eckhart Tolle): Ambos libros abordan la conciencia y el crecimiento personal, centrándose en la espiritualidad y la transformación interna.
- "Los secretos de la mente millonaria" (T. Harv Eker): Explora la relación entre la mentalidad y el éxito, similar a la distinción entre pod...
```

---

## ⚓ Anchors extraídos

**Conceptos:**
- niveles de la conciencia humana
- diferencia entre poder y fuerza
- prueba kinesiológica para discernir lo verdadero y lo falso
- alineación con el verdadero poder
- emoción como guía en la conciencia

**Key terms:** poder, fuerza, conciencia, attractor, kinesiología

**Voz autorial:** La voz del autor es reflexiva y orientada hacia el autoconocimiento, con un enfoque en la espiritualidad y el desarrollo personal.

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
- Razón: The generated content directly reflects the inferred themes of the book, such as the distinction between power and force, the importance of aligning with a higher essence, and the role of emotions in guiding personal power. Phrases like 'poder verdadero' and 'alineación con lo más elevado' are specific to the book's focus on consciousness and personal empowerment, making it highly relevant and not

### EN
- Score: 1.00
- Usa conceptos específicos: true
- Razón: The generated content directly reflects the inferred themes of the book, such as the distinction between power and force, the importance of aligning with a higher essence, and the role of emotions in guiding consciousness. Phrases like 'True power emerges from within, transcending force' and 'Emotions serve as a compass in the journey of consciousness' specifically echo the book's focus on self-aw

---

## 🎭 Voice verdict

- Consolidated: **pagina** (conf 0.90)
- ES: pagina — Voz directa y reflexiones sobre la conciencia sin referencias externas.
- EN: pagina — Tono directo y reflexivo, sin referencias externas al libro.

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
- Tokens totales: 9293
- Tiempo total: 25.5s
- Modelos usados: gpt-4o-mini-2024-07-18

### Por fase
- grounding: 727 tokens, 5577ms
- anchors: 2431 tokens, 5200ms
- palette: 0 tokens, 0ms
- content_es: 2069 tokens, 4612ms
- judge_es: 849 tokens, 2585ms
- content_en: 1602 tokens, 4681ms
- judge_en: 837 tokens, 2126ms
- voice: 778 tokens, 701ms
