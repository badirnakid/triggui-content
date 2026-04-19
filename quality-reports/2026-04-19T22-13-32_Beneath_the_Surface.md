# Quality Report — Beneath the Surface

**Autor:** Michael Phelps
**Ejecutado:** 2026-04-19T22-13-32
**Pipeline:** nucleus-canonical-v3

---

## 🌐 Grounding

- **Source:** `model_inference`
- **Tier reached:** 3
- **Book identity confidence:** 0.39
- **Resolution path:** tier2a_miss_http_429 → tier2b_miss_no_subjects → tier3_conf_0.70


### Libros similares considerados (inferencia)
- **Open** (Andre Agassi): Es una autobiografía de un atleta que habla sobre sus luchas personales y la presión de ser una figura pública.
- **I Am Zlatan Ibrahimović** (Zlatan Ibrahimović): Una autobiografía que explora la vida de un deportista famoso, incluyendo sus desafíos y triunfos.
- **Becoming a Champion** (Michael Johnson): Un relato sobre la vida de un atleta y las dificultades que enfrenta en su carrera.
- **The Long Walk to Freedom** (Nelson Mandela): Aunque no es un libro de deportes, trata sobre la lucha personal y la superación, similar a las experiencias de Phelps.


### Ground truth utilizado
```
TEMA INFERIDO (el modelo no conoce este libro directamente, infiere desde similares):

Superación personal, lucha contra adversidades, vida de un atleta en el ojo público.

VOZ INFERIDA:
Reflexiva, honesta y emocional, con un enfoque en la vulnerabilidad y la resiliencia.

LIBROS SIMILARES QUE COMPARTEN ADN CON ESTE:
- "Open" (Andre Agassi): Es una autobiografía de un atleta que habla sobre sus luchas personales y la presión de ser una figura pública.
- "I Am Zlatan Ibrahimović" (Zlatan Ibrahimović): Una autobiografía que explora la vida de un deportista famoso, incluyendo sus desafíos y triunfos.
- "Becoming a Champion" (Michael Johnson): Un relato sobre la vida de un atleta y las dificultades que enfrenta en su carrera.
- "The Long Walk to Freedom" (Nelson Mandela): Aunque no es un libro...
```

---

## ⚓ Anchors extraídos

**Conceptos:**
- superación personal a través de la vulnerabilidad
- lucha contra el trastorno por déficit de atención
- impacto de la fama en la vida personal
- desafíos familiares y su influencia en el rendimiento
- resiliencia ante la adversidad

**Key terms:** atención, resiliencia, fama, vulnerabilidad, superación

**Voz autorial:** Reflexiva, honesta y emocional, centrada en la vulnerabilidad y la resiliencia del autor.

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
- Razón: El contenido generado refleja de manera específica los temas de superación personal y lucha contra adversidades, que son centrales en el ground truth del libro. Frases como 'La vulnerabilidad se convierte en el camino para encontrar una fuerza interna' y 'Cada desafío se convierte en una oportunidad para crecer' son conceptos que resuenan con la voz reflexiva y emocional esperada. Además, se menci

### EN
- Score: 0.80
- Usa conceptos específicos: true
- Razón: The content reflects the themes of personal growth and resilience, which align closely with the inferred themes of the book. Phrases like 'embracing our own imperfections' and 'vulnerability becomes the pathway to discovering an inner strength' resonate with the emotional and reflective voice inferred. However, while the content is specific to the struggles of an athlete, it could still apply to a

---

## 🎭 Voice verdict

- Consolidated: **pagina** (conf 0.90)
- ES: pagina — Voz directa y reflexiones personales del autor.
- EN: pagina — Voz directa y reflexiones personales del autor sobre su vida.

---

## 📊 Confidence (calculada desde 4 señales ortogonales)

- **book_grounding:** 0.39 ← del tier de grounding alcanzado
- **voice_authenticity:** 0.93 ← del voice judge
- **specificity:** 0.92 ← anti-genericidad de anchors
- **grounding_judge:** 0.9 ← promedio de los 2 judges
- **Combined:** **0.75**

---

## ✅ Validación final

**Overall:** `pass`
Sin warnings.

---

## 💰 Métricas

- LLM calls: 8
- Tokens totales: 8917
- Tiempo total: 25.1s
- Modelos usados: gpt-4o-mini-2024-07-18

### Por fase
- grounding: 621 tokens, 3316ms
- anchors: 2311 tokens, 4393ms
- palette: 0 tokens, 0ms
- content_es: 2043 tokens, 8513ms
- judge_es: 833 tokens, 1695ms
- content_en: 1550 tokens, 4090ms
- judge_en: 770 tokens, 2461ms
- voice: 789 tokens, 658ms
