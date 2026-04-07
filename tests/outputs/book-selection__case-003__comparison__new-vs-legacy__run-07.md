# Comparación formal — case-003 — new-system vs legacy-baseline

## Archivos usados
- Fixture: `tests/fixtures/case-003-catalog-only-atencion-friccion.json`
- New system: `tests/outputs/book-selection__case-003__new-system__model-gpt-4o-mini__run-03.json`
- Legacy baseline: `tests/outputs/book-selection__case-003__legacy-baseline__model-gpt-4o-mini__run-02.json`

## Schema detectado
- New system: new_system_like
- Legacy baseline: legacy_recommended_books

## Checks automáticos
- JSON válido:
  - New system: Sí
  - Legacy baseline: Sí
- `selection_source === "catalog"`:
  - New system: Sí
  - Legacy baseline: No determinable (schema legacy)
- Libro seleccionado existe en catálogo del fixture:
  - New system: Sí
  - Legacy baseline: Sí
- Alternatives count:
  - New system: 4
  - Legacy baseline: 1
- Rejections count:
  - New system: 0
  - Legacy baseline: 0

## Coincidencias de catálogo detectadas
### New system selected title matches
[fixture.catalog_candidates] Stolen Focus

### Legacy baseline selected title matches
[fixture.catalog_candidates] Stolen Focus

## Primeros títulos detectados en fixture
- [fixture.lens.secondary] chronobiology
- [fixture.recent_history] Deep Work
- [fixture.recent_history] Four Thousand Weeks
- [fixture.catalog_candidates] Stolen Focus
- [fixture.catalog_candidates] Indistractable
- [fixture.catalog_candidates] Deep Work
- [fixture.catalog_candidates] The Shallows
- [fixture.catalog_candidates] Four Thousand Weeks

## Comparación lado a lado

### detected_theme.core

**New system**  
Degradación de la atención y relación con las pantallas.

**Legacy baseline**  
—

### detected_theme.subtheme

**New system**  
Inercia y fragmentación de la atención.

**Legacy baseline**  
—

### detected_theme.why_it_matters_now

**New system**  
La saturación digital y la necesidad de recuperar una presencia auténtica son más relevantes que nunca en un mundo hiperconectado.

**Legacy baseline**  
—

### selected_book.title

**New system**  
Stolen Focus

**Legacy baseline**  
Stolen Focus

### selected_book.author

**New system**  
Johann Hari

**Legacy baseline**  
Johann Hari

### selected_book.why_this_book

**New system**  
Este libro gana porque aborda la degradación de la atención como un fenómeno cultural y ambiental, no solo como un problema de disciplina personal, lo que lo hace más adecuado que The Shallows, que se centra más en aspectos cerebrales y menos en la experiencia vivida de la fragmentación.

**Legacy baseline**  
Amplio, cultural, contemporáneo, fuerte para hablar de atención fragmentada y entorno.

### selected_book.fit.trigger_fit

**New system**  
El libro se centra en la atención fragmentada y cómo recuperarla, resonando directamente con la inercia y la fragmentación de la atención mencionadas en el detonante.

**Legacy baseline**  
—

### selected_book.fit.lens_fit

**New system**  
Ofrece una perspectiva clara sobre los patrones de atención, alineándose bien con el lente de autoconocimiento al ayudar a identificar y comprender los mecanismos internos detrás de la relación con las pantallas.

**Legacy baseline**  
—

### selected_book.fit.timing_fit

**New system**  
La lectura nocturna permite reflexionar sobre el día y cómo la atención se ha visto afectada, haciendo que el contenido del libro sea especialmente relevante en este momento.

**Legacy baseline**  
—

### alternatives

**New system**  
The Shallows — Nicholas Carr :: Es un análisis profundo de cómo internet afecta nuestro cerebro, pero se enfoca más en aspectos cognitivos que en la experiencia emocional y práctica de la fragmentación, lo que lo hace menos adecuado para este detonante.
Indistractable — Nir Eyal :: Ofrece tácticas prácticas para controlar la atención, pero puede derivar en un enfoque demasiado productivo y menos introspectivo, desviándose del objetivo de recuperar una relación más sana con las pantallas.
Deep Work — Cal Newport :: Proporciona estrategias para el enfoque, pero se centra en el rendimiento profesional, lo que no aborda la necesidad de una relación más consciente y menos reactiva con las pantallas.
Four Thousand Weeks — Oliver Burkeman :: Aborda la gestión del tiempo y la finitud, pero puede abrir demasiado el ángulo y perder el enfoque específico en la atención, lo que no satisface la necesidad inmediata del detonante.

**Legacy baseline**  
The Shallows — Nicholas Carr :: Más cerebral y estructural; potente para entender degradación cognitiva, menos inmediato para acción breve.

### rejections

**New system**  
—

**Legacy baseline**  
—


## Rúbrica humana rápida

### 1) Especificidad de `why_it_matters_now`
- Mejor:
- Motivo:
- Nota new (0-10):
- Nota legacy (0-10):

### 2) Huella real del lente
- Mejor:
- Motivo:
- Nota new (0-10):
- Nota legacy (0-10):

### 3) Calidad de `timing_fit`
- Mejor:
- Motivo:
- Nota new (0-10):
- Nota legacy (0-10):

### 4) Justificación no intercambiable del libro
- Mejor:
- Motivo:
- Nota new (0-10):
- Nota legacy (0-10):

### 5) Calidad de alternatives y rejections
- Mejor:
- Motivo:
- Nota new (0-10):
- Nota legacy (0-10):

## Conclusión provisional
- Ganador provisional:
- ¿El new-system ya supera al legacy?:
- Primer ajuste permitido a `prompts/tasks/select-book.md`:
- Evidencia puntual que lo justifica:
