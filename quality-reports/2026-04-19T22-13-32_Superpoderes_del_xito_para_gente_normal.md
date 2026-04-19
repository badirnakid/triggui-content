# Quality Report — Superpoderes del éxito para gente normal

**Autor:** Mago More
**Ejecutado:** 2026-04-19T22-13-32
**Pipeline:** nucleus-canonical-v3

---

## 🌐 Grounding

- **Source:** `model_inference`
- **Tier reached:** 3
- **Book identity confidence:** 0.39
- **Resolution path:** tier2a_miss_http_429 → tier2b_miss_no_subjects → tier3_conf_0.70


### Libros similares considerados (inferencia)
- **Los secretos de la mente millonaria** (T. Harv Eker): Ambos libros abordan el desarrollo personal y la superación de obstáculos en la vida.
- **El monje que vendió su Ferrari** (Robin Sharma): Se centra en la transformación personal y la búsqueda del éxito.
- **Cómo ganar amigos e influir sobre las personas** (Dale Carnegie): Trata sobre habilidades interpersonales y el éxito en la vida personal y profesional.
- **Piense y hágase rico** (Napoleon Hill): Explora la mentalidad necesaria para alcanzar el éxito y la prosperidad.


### Ground truth utilizado
```
TEMA INFERIDO (el modelo no conoce este libro directamente, infiere desde similares):

Superación personal y transformación hacia el éxito en la vida cotidiana, con un enfoque en la motivación y el desarrollo de habilidades.

VOZ INFERIDA:
Conversacional y motivacional, posiblemente con un toque humorístico y accesible, dirigido a un público amplio.

LIBROS SIMILARES QUE COMPARTEN ADN CON ESTE:
- "Los secretos de la mente millonaria" (T. Harv Eker): Ambos libros abordan el desarrollo personal y la superación de obstáculos en la vida.
- "El monje que vendió su Ferrari" (Robin Sharma): Se centra en la transformación personal y la búsqueda del éxito.
- "Cómo ganar amigos e influir sobre las personas" (Dale Carnegie): Trata sobre habilidades interpersonales y el éxito en la vida personal y pro...
```

---

## ⚓ Anchors extraídos

**Conceptos:**
- transformación personal hacia el éxito
- desarrollo de habilidades cotidianas
- motivación para el cambio positivo
- superación de obstáculos personales
- enfoque accesible en la autoayuda

**Key terms:** superpoderes, éxito, transformación, motivación, desarrollo personal

**Voz autorial:** Conversacional y motivacional, con un toque humorístico y accesible, dirigido a un público amplio.

---

## 🎨 Visual synthesis

- hue_primary: 45
- saturation: balanced
- lightness_paper: medium_light
- temperature_shift: 10
- palette_strategy: analogous
- typography: sans_humanista
- Resultado: paper=#D3D3CF, accent=#D6C71F, ink=#1C1B17, contraste=11.48:1

---

## 👨‍⚖️ Grounding judges

### ES
- Score: 1.00
- Usa conceptos específicos: true
- Podría aplicar a cualquier libro: false
- Razón: The content directly reflects the themes of personal transformation and motivation outlined in the ground truth. Phrases like 'transformación personal hacia el éxito' and 'desarrollar habilidades cotidianas' are specific to the book's focus on self-improvement and skill development. The conversational and motivational tone aligns well with the inferred voice, making it clear that this content is a

### EN
- Score: 0.80
- Usa conceptos específicos: true
- Razón: The content reflects the themes of personal transformation and motivation, which are central to the inferred ground truth. Phrases like 'personal transformation towards success' and 'developing everyday skills' align closely with the book's focus on self-improvement. However, while the language is motivational and engaging, it lacks specific references or unique concepts that would tie it directly

---

## 🎭 Voice verdict

- Consolidated: **pagina** (conf 0.90)
- ES: pagina — Voz directa y motivacional, sin referencias externas.
- EN: pagina — Voz directa y motivacional, sin referencias externas.

---

## 📊 Confidence (calculada desde 4 señales ortogonales)

- **book_grounding:** 0.39 ← del tier de grounding alcanzado
- **voice_authenticity:** 0.93 ← del voice judge
- **specificity:** 0.86 ← anti-genericidad de anchors
- **grounding_judge:** 0.9 ← promedio de los 2 judges
- **Combined:** **0.74**

---

## ✅ Validación final

**Overall:** `pass`
Sin warnings.

---

## 💰 Métricas

- LLM calls: 8
- Tokens totales: 8811
- Tiempo total: 21.6s
- Modelos usados: gpt-4o-mini-2024-07-18

### Por fase
- grounding: 612 tokens, 3761ms
- anchors: 2301 tokens, 4458ms
- palette: 0 tokens, 0ms
- content_es: 2022 tokens, 5037ms
- judge_es: 807 tokens, 1811ms
- content_en: 1532 tokens, 4162ms
- judge_en: 767 tokens, 1670ms
- voice: 770 tokens, 727ms
