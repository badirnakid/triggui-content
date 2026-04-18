# Triggui Nucleus — Pipeline Experimental

**Reemplazo propuesto para `build-contenido.js` v9.7.4 (1,764 líneas → ~550 líneas total entre 5 archivos).**

---

## Qué es esto

El patrón **nucleus + renderers deterministas** aplicado al pipeline de Triggui. En lugar de pedirle al LLM 7 artefactos finales por libro (main, bibliografía, auditoría, activadores EN, tarjeta ES, tarjeta EN, estilo) y luego repararlos cuando fallan, este pipeline:

1. Pide al LLM **UNA** llamada con `response_format: json_schema strict:true` para llenar el `EditionNucleus` — semilla semántica, no artefacto final.
2. Valida el Nucleus con el Quality Engine (preservado de v9.7.4).
3. Compila tarjeta ES, tarjeta EN, OG title, WhatsApp copy desde el mismo Nucleus con renderers deterministas. Cero llamadas IA adicionales.

## Arquitectura

```
book { titulo, autor, tagline }
         │
         ▼
┌────────────────────────┐
│ extract-nucleus.js     │  ← 1 llamada a OpenAI (strict json_schema)
└───────────┬────────────┘
            ▼
        Nucleus
            │
            ▼
┌────────────────────────┐
│ quality-engine.js      │  ← validación semántica, 0 IA
└───────────┬────────────┘
            ▼
   Nucleus validado
            │
     ┌──────┼──────┬─────────┬───────────┐
     ▼      ▼      ▼         ▼           ▼
 render-  render-  render-   render-   (futuro: email,
 ES       EN       OG        WhatsApp   Instagram, voz)
            (cada renderer es función pura, 0 IA)
```

## Archivos

| Archivo | Líneas | Responsabilidad |
|---|---|---|
| `edition-nucleus.schema.json` | 130 | El contrato único. Prompts embebidos en descriptions. |
| `extract-nucleus.js` | 105 | UNA llamada IA con structured outputs strict. |
| `triggui-quality-engine.js` | 215 | Moat preservado: luminance, highlights, validadores. Cero IA. |
| `render-tarjeta.js` | 130 | Renderers ES + EN + OG + WhatsApp. Cero IA. |
| `build-contenido-nucleus.js` | 180 | Orquestador (reemplaza los 1764 de v9.7.4). |
| `test-pipeline-sin-ia.js` | 105 | Prueba end-to-end sin usar tu OPENAI_KEY. |

**Total: ~865 líneas, vs 1,764 de v9.7.4. Y cada archivo tiene una sola responsabilidad.**

## Estado actual (honesto)

### ✅ Probado funcionando
- Pipeline determinista end-to-end con nucleus simulado
- Quality Engine valida Nucleus (36/36 checks)
- Renderer ES produce tarjeta completa en 1ms, valida 13/13
- Renderer EN produce tarjeta completa en 1ms, valida 13/13
- OG title y WhatsApp copy como bonus desde el mismo nucleus

### ⚠️ Falta probar (requiere tu OPENAI_KEY)
- Llamada real a `gpt-4o-mini` con `response_format: json_schema strict:true`
- Calidad del nucleus extraído vs tarjetas actuales de v9.7.4
- Costo real en tokens (estimado: ~70% menos que v9.7.4)
- 3 libros del catálogo (uno fácil, uno medio, uno difícil)

## Cómo probar

### Paso 1: Probar el renderer determinista sin gastar tokens

```bash
cd triggui-nucleus
npm install
node test-pipeline-sin-ia.js
```

Esto ejecuta todo el flujo con un nucleus simulado de "El poder del ahora". Si ves:
```
Nucleus válido:     ✅
Tarjeta ES válida:  ✅
Tarjeta EN válida:  ✅
```
el pipeline funciona.

### Paso 2: Probar con llamada real a OpenAI (SINGLE)

```bash
export OPENAI_KEY=sk-...
export SINGLE_MODE=true
export SINGLE_BOOK='{"titulo":"Hábitos Atómicos","autor":"James Clear","tagline":"Cambios pequeños, resultados extraordinarios"}'
node build-contenido-nucleus.js
```

Esto hace UNA llamada real a GPT-4o-mini, extrae el Nucleus, valida, renderiza ambas tarjetas, y escribe `contenido_edicion.json`.

### Paso 3: Comparar contra v9.7.4

1. Toma 3 libros de tu catálogo donde sepas que v9.7.4 produjo tarjetas excelentes.
2. Córrelos por el pipeline nuevo.
3. Compara manualmente:
   - Calidad de tarjeta ES (¿mantiene la línea sagrada?)
   - Calidad de tarjeta EN (¿nativa, no traducción literal?)
   - Tokens consumidos (debería bajar ~70%)
   - Tiempo (debería bajar ~70%)
   - Reintentos (nuevo pipeline: 0 reintentos estructurales)

### Regla de decisión

Si en 3 libros reales el patrón nuevo **iguala o supera** v9.7.4 en calidad editorial y **reduce** costo y tiempo → migrar.

Si alguno sale peor → identificar qué campo del schema ajustar y repetir.

Si el taste es peor en todos → archivar experimento, seguir con v9.7.4.

## Lo que cambió vs lo que preservamos

### Preservado intacto (tu moat)
- Todas las funciones de luminancia y contraste WCAG
- `normalizeHighlightSyntax`, `countHighlights`, `stripHighlightTags`
- Detección de primera persona, meta-referencias, cierres genéricos
- Sanitizadores de título y subtítulo
- Verbos físicos permitidos vs prohibidos

### Eliminado (ya no necesario)
- `coerceTarjetaDeterministic` — el schema garantiza forma válida
- `generateTarjetaWithRepair` con 6 intentos — no hay reparación, el schema no falla
- `buildRepairPromptTarjeta` — no hay prompt de reparación
- Carriles paralelos para tarjeta ES, tarjeta EN, bibliografía, auditoría, activadores EN, estilo — todo sale del mismo nucleus
- `response_format: { type: "json_object" }` → reemplazado por `json_schema strict:true`
- Múltiples funciones de fallback — si el nucleus falla validación, el libro se marca `_fallback` y el batch continúa

### Nuevo
- `confidence` como campo del nucleus: el modelo auto-reporta su grounding
- `highlight_seeds` como frases cortas, no párrafos con markup
- Un solo `SYSTEM_PROMPT` corto porque las reglas viven en el schema

## Compatibilidad con el formato v9.7.4

El orquestador produce output en formato compatible con `contenido.json` y `contenido_edicion.json`. Los campos que tu Apps Script, Edición Viva, y app consumen siguen presentes:

- `tarjeta`, `tarjeta_en`, `tarjeta_base`, `tarjeta_base_en`
- `palabras`, `palabras_en`, `frases`, `frases_en`
- `colores`, `fondo`, `dimension`, `punto`
- `titulo_es`, `titulo_en`, `idioma_original`
- `portada`, `portada_url`, `isbn`

Campos nuevos añadidos (opcionales):
- `_nucleus` — el Nucleus completo para auditar
- `_validation` — scores de validación
- `_metrics` — tokens, ms, modelo, versión

## Lo que NO es esto

- **No es magia.** Es arquitectura sólida usando features documentadas de OpenAI.
- **No es un secreto oculto.** El patrón `structured outputs + deterministic rendering` está en blogs y papers.
- **No va a resolver tus suscriptores.** Eso requiere llamar a Boris y cerrar Anáhuac.

Lo que sí es: menos tokens, menos latencia, más mantenible, replicable a Soul NRGY y TMA con el mismo patrón cambiando el schema.

## Próximos pasos (después de validar con 3 libros)

1. `render-email.js` — HTML de correo con el mismo nucleus
2. `render-og-image.js` — PNG para preview en WhatsApp
3. `ProductNucleus.schema.json` para Soul NRGY
4. `ApprovalNucleus.schema.json` para TMA
5. Migración progresiva: `experiments/nucleus/` → `src/nucleus/` → producción
