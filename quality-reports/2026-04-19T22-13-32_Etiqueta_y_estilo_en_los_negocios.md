# Quality Report — Etiqueta y estilo en los negocios

**Autor:** Pachter Barbara
**Ejecutado:** 2026-04-19T22-13-32
**Pipeline:** nucleus-canonical-v3

---

## 🌐 Grounding

- **Source:** `model_inference`
- **Tier reached:** 3
- **Book identity confidence:** 0.39
- **Resolution path:** tier2a_miss_http_429 → tier2b_miss_no_results → tier3_conf_0.70


### Libros similares considerados (inferencia)
- **La etiqueta en los negocios** (María José Canel): Aborda el tema de la etiqueta y el comportamiento profesional en entornos empresariales.
- **Cómo ganar amigos e influir sobre las personas** (Dale Carnegie): Aunque no es exclusivamente sobre etiqueta, trata sobre las relaciones interpersonales y la comunicación efectiva en el ámbito profesional.
- **El arte de la guerra** (Sun Tzu): Aunque es un texto antiguo, se aplica a la estrategia y comportamiento en situaciones competitivas, similar a la etiqueta en negocios.
- **Los secretos de la comunicación efectiva** (Leil Lowndes): Enfocado en mejorar la comunicación y las interacciones en el ámbito profesional.


### Ground truth utilizado
```
TEMA INFERIDO (el modelo no conoce este libro directamente, infiere desde similares):

Comportamiento profesional y etiqueta en el entorno empresarial, con un enfoque en la mejora de habilidades interpersonales.

VOZ INFERIDA:
Práctica y directa, orientada a ofrecer consejos útiles y aplicables en situaciones cotidianas de negocios.

LIBROS SIMILARES QUE COMPARTEN ADN CON ESTE:
- "La etiqueta en los negocios" (María José Canel): Aborda el tema de la etiqueta y el comportamiento profesional en entornos empresariales.
- "Cómo ganar amigos e influir sobre las personas" (Dale Carnegie): Aunque no es exclusivamente sobre etiqueta, trata sobre las relaciones interpersonales y la comunicación efectiva en el ámbito profesional.
- "El arte de la guerra" (Sun Tzu): Aunque es un texto antiguo, se apl...
```

---

## ⚓ Anchors extraídos

**Conceptos:**
- comportamiento profesional en situaciones empresariales
- mejora de habilidades interpersonales
- 101 consejos para la etiqueta en negocios

**Key terms:** etiqueta empresarial, comunicación efectiva, relaciones interpersonales, comportamiento profesional, presentación personal

**Voz autorial:** Práctica y directa, orientada a ofrecer consejos útiles y aplicables en situaciones cotidianas de negocios.

---

## 🎨 Visual synthesis

- hue_primary: 200
- saturation: balanced
- lightness_paper: medium_light
- temperature_shift: 0
- palette_strategy: analogous
- typography: sans_humanista
- Resultado: paper=#CFD2D3, accent=#1F99D6, ink=#171A1C, contraste=11.50:1

---

## 👨‍⚖️ Grounding judges

### ES
- Score: 1.00
- Usa conceptos específicos: true
- Podría aplicar a cualquier libro: false
- Razón: El contenido generado se centra en la etiqueta empresarial y el comportamiento profesional, utilizando conceptos específicos como 'primeras impresiones', 'habilidades interpersonales' y 'comunicación efectiva', que están claramente alineados con el ground truth del libro. Además, las frases y consejos son prácticos y aplicables a situaciones cotidianas en el entorno empresarial, lo que refuerza su

### EN
- Score: 0.90
- Usa conceptos específicos: true
- Razón: The content is highly relevant to the inferred theme of professional behavior and etiquette in business environments. It discusses the importance of first impressions and interpersonal skills, which are central to the ground truth. The phrases used, such as 'first impressions can open doors or close them' and 'mastering etiquette can elevate your career,' directly reflect the focus on improving 'h

---

## 🎭 Voice verdict

- Consolidated: **pagina** (conf 0.90)
- ES: pagina — Uso de voz directa y enfoque en habilidades interpersonales.
- EN: pagina — Voz directa y consejos prácticos sin referencias meta.

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
- Tokens totales: 8978
- Tiempo total: 23.8s
- Modelos usados: gpt-4o-mini-2024-07-18

### Por fase
- grounding: 644 tokens, 5091ms
- anchors: 2329 tokens, 4656ms
- palette: 0 tokens, 0ms
- content_es: 2032 tokens, 5257ms
- judge_es: 836 tokens, 2265ms
- content_en: 1553 tokens, 4355ms
- judge_en: 784 tokens, 1552ms
- voice: 800 tokens, 663ms
