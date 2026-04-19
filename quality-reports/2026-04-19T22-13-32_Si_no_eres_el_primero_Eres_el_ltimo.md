# Quality Report — Si no eres el primero; Eres el último

**Autor:** Grant Cardone
**Ejecutado:** 2026-04-19T22-13-32
**Pipeline:** nucleus-canonical-v3

---

## 🌐 Grounding

- **Source:** `model_inference`
- **Tier reached:** 3
- **Book identity confidence:** 0.39
- **Resolution path:** tier2a_miss_http_429 → tier2b_miss_no_subjects → tier3_conf_0.70


### Libros similares considerados (inferencia)
- **Vender es humano** (Daniel H. Pink): Explora la naturaleza de la venta y cómo todos somos vendedores en diferentes aspectos de la vida.
- **La venta desafiante** (Matthew Dixon y Brent Adamson): Ofrece estrategias sobre cómo desafiar a los clientes y ser un vendedor más efectivo.
- **Cómo ganar amigos e influir sobre las personas** (Dale Carnegie): Clásico sobre habilidades interpersonales que son esenciales para la venta y el éxito personal.
- **Los secretos de la mente millonaria** (T. Harv Eker): Aborda la mentalidad necesaria para alcanzar el éxito financiero y personal.


### Ground truth utilizado
```
TEMA INFERIDO (el modelo no conoce este libro directamente, infiere desde similares):

Estrategias de ventas y desarrollo personal para alcanzar el éxito financiero y profesional.

VOZ INFERIDA:
Motivacional y directo, con un enfoque práctico en la mejora personal y profesional.

LIBROS SIMILARES QUE COMPARTEN ADN CON ESTE:
- "Vender es humano" (Daniel H. Pink): Explora la naturaleza de la venta y cómo todos somos vendedores en diferentes aspectos de la vida.
- "La venta desafiante" (Matthew Dixon y Brent Adamson): Ofrece estrategias sobre cómo desafiar a los clientes y ser un vendedor más efectivo.
- "Cómo ganar amigos e influir sobre las personas" (Dale Carnegie): Clásico sobre habilidades interpersonales que son esenciales para la venta y el éxito personal.
- "Los secretos de la mente m...
```

---

## ⚓ Anchors extraídos

**Conceptos:**
- estrategias comprobadas para aumentar ventas
- venderse a uno mismo de manera efectiva
- robar mercado a los competidores
- mejora personal y profesional
- libertad financiera

**Key terms:** venta, estrategia, competencia, éxito financiero, desarrollo personal

**Voz autorial:** La voz es motivacional y directa, enfocándose en acciones prácticas y resultados tangibles.

---

## 🎨 Visual synthesis

- hue_primary: 200
- saturation: vivid
- lightness_paper: medium_light
- temperature_shift: 0
- palette_strategy: complementary
- typography: sans_humanista
- Resultado: paper=#CFD2D3, accent=#129DE2, ink=#171A1C, contraste=11.50:1

---

## 👨‍⚖️ Grounding judges

### ES
- Score: 0.90
- Usa conceptos específicos: true
- Podría aplicar a cualquier libro: false
- Razón: The content is highly specific to sales strategies and personal development, aligning closely with the inferred themes of the book. Phrases like 'propuesta de valor' and 'éxito financiero' directly relate to the ground truth. While the language is motivational and practical, it is tailored to the context of sales and competition, making it less generic and more anchored to the book's themes.

### EN
- Score: 0.80
- Usa conceptos específicos: true
- Razón: The content is closely aligned with the inferred themes of sales strategies and personal development for financial success. It uses specific concepts like 'value proposition' and 'seize market share,' which are relevant to the ground truth. However, while it is tailored to the context of sales and competition, some phrases could be considered somewhat generic in the broader self-help genre, which,

---

## 🎭 Voice verdict

- Consolidated: **pagina** (conf 0.90)
- ES: pagina — Tono directo y consejos prácticos sin referencias externas.
- EN: pagina — Tono directo y enfoque en estrategias, sin referencias externas.

---

## 📊 Confidence (calculada desde 4 señales ortogonales)

- **book_grounding:** 0.39 ← del tier de grounding alcanzado
- **voice_authenticity:** 0.93 ← del voice judge
- **specificity:** 0.95 ← anti-genericidad de anchors
- **grounding_judge:** 0.85 ← promedio de los 2 judges
- **Combined:** **0.75**

---

## ✅ Validación final

**Overall:** `pass`
Sin warnings.

---

## 💰 Métricas

- LLM calls: 8
- Tokens totales: 8993
- Tiempo total: 25.3s
- Modelos usados: gpt-4o-mini-2024-07-18

### Por fase
- grounding: 654 tokens, 5198ms
- anchors: 2336 tokens, 4446ms
- palette: 0 tokens, 0ms
- content_es: 2026 tokens, 6685ms
- judge_es: 820 tokens, 2084ms
- content_en: 1555 tokens, 4430ms
- judge_en: 776 tokens, 1713ms
- voice: 826 tokens, 725ms
