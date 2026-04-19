# Quality Report — Descubre tu destino con el monje que vendió su Ferrari

**Autor:** Robin Sharma
**Ejecutado:** 2026-04-19T22-13-32
**Pipeline:** nucleus-canonical-v3

---

## 🌐 Grounding

- **Source:** `model_inference`
- **Tier reached:** 3
- **Book identity confidence:** 0.39
- **Resolution path:** tier2a_miss_http_429 → tier2b_miss_no_results → tier3_conf_0.70


### Libros similares considerados (inferencia)
- **El monje que vendió su Ferrari** (Robin Sharma): Es el libro anterior en la serie que trata sobre la transformación personal y la búsqueda de la felicidad.
- **Los secretos de la mente millonaria** (T. Harv Eker): Aborda temas de desarrollo personal y mentalidad para alcanzar el éxito y la prosperidad.
- **La magia del orden** (Marie Kondo): Aunque se centra en la organización, también trata sobre la transformación personal y la búsqueda de una vida más plena.
- **El poder del ahora** (Eckhart Tolle): Explora la importancia de vivir en el presente y encontrar la paz interior.
- **Despierta tu héroe interior** (Victor Hugo Manzanilla): Se enfoca en el autodescubrimiento y el desarrollo personal.


### Ground truth utilizado
```
TEMA INFERIDO (el modelo no conoce este libro directamente, infiere desde similares):

Transformación personal, búsqueda de la felicidad y realización de potencial interno.

VOZ INFERIDA:
Inspiracional, reflexivo y motivacional, con un enfoque en lecciones prácticas y fábulas.

LIBROS SIMILARES QUE COMPARTEN ADN CON ESTE:
- "El monje que vendió su Ferrari" (Robin Sharma): Es el libro anterior en la serie que trata sobre la transformación personal y la búsqueda de la felicidad.
- "Los secretos de la mente millonaria" (T. Harv Eker): Aborda temas de desarrollo personal y mentalidad para alcanzar el éxito y la prosperidad.
- "La magia del orden" (Marie Kondo): Aunque se centra en la organización, también trata sobre la transformación personal y la búsqueda de una vida más plena.
- "El poder d...
```

---

## ⚓ Anchors extraídos

**Conceptos:**
- despertar del yo interior
- liberación del potencial personal
- transformación de la vida a través de la introspección
- búsqueda de la paz interior y felicidad
- superación de límites personales

**Key terms:** fábula, sabiduría, prosperidad, libertad personal, dimensiones del mundo

**Voz autorial:** Inspiracional, reflexivo y motivacional, con un enfoque en lecciones prácticas y fábulas.

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
- Razón: The content is deeply anchored in the themes of personal transformation and the search for inner happiness, which are explicitly mentioned in the ground truth. Phrases like 'despertar del yo interior' and 'búsqueda de la paz interior' directly reflect the core concepts of self-discovery and personal potential. The inspirational tone and practical lessons align well with the inferred voice of the '

### EN
- Score: 0.80
- Usa conceptos específicos: true
- Razón: The content strongly reflects the themes of personal transformation and the quest for happiness, which are central to the inferred ground truth. Phrases like 'awakening the inner self' and 'transforming the very essence of our existence' align well with the concepts of self-discovery and personal potential. However, while the language is inspirational and reflective, it remains somewhat generic in

---

## 🎭 Voice verdict

- Consolidated: **pagina** (conf 0.90)
- ES: pagina — Voz directa y reflexiones personales sobre el yo interior.
- EN: pagina — Voz directa y reflexiones sobre el crecimiento personal.

---

## 📊 Confidence (calculada desde 4 señales ortogonales)

- **book_grounding:** 0.39 ← del tier de grounding alcanzado
- **voice_authenticity:** 0.93 ← del voice judge
- **specificity:** 0.88 ← anti-genericidad de anchors
- **grounding_judge:** 0.9 ← promedio de los 2 judges
- **Combined:** **0.75**

---

## ✅ Validación final

**Overall:** `pass`
Sin warnings.

---

## 💰 Métricas

- LLM calls: 8
- Tokens totales: 9589
- Tiempo total: 24.8s
- Modelos usados: gpt-4o-mini-2024-07-18

### Por fase
- grounding: 855 tokens, 5540ms
- anchors: 2567 tokens, 5501ms
- palette: 0 tokens, 0ms
- content_es: 2086 tokens, 5302ms
- judge_es: 861 tokens, 1705ms
- content_en: 1599 tokens, 4192ms
- judge_en: 805 tokens, 1657ms
- voice: 816 tokens, 893ms
