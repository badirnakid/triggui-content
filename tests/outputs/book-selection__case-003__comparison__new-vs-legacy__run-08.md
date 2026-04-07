# Comparación formal — case-003 — new-system vs legacy-baseline

## Archivos usados
- Fixture: `tests/fixtures/case-003-catalog-only-atencion-friccion.json`
- New system: `tests/outputs/book-selection__case-003__new-system__model-gpt-4o-mini__run-04.json`
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
  - New system: 2
  - Legacy baseline: 1
- Rejections count:
  - New system: 2
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
Inercia y fragmentación atencional.

**Legacy baseline**  
—

### detected_theme.why_it_matters_now

**New system**  
La búsqueda de una relación menos reactiva con la tecnología es crucial en un momento donde la atención está constantemente fragmentada.

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
Este libro gana porque aborda la degradación de la atención como un fenómeno cultural y ambiental, lo que es más relevante para este detonante que 'The Shallows', que se centra más en el aspecto cognitivo sin ofrecer una conexión práctica con la experiencia diaria del lector.

**Legacy baseline**  
Amplio, cultural, contemporáneo, fuerte para hablar de atención fragmentada y entorno.

### selected_book.fit.trigger_fit

**New system**  
El libro se enfoca en la pérdida de atención y ofrece un análisis de las causas, alineándose con el deseo de entender la inercia atencional.

**Legacy baseline**  
—

### selected_book.fit.lens_fit

**New system**  
La obra permite una reflexión profunda sobre la relación con las pantallas, facilitando el autoconocimiento en este contexto.

**Legacy baseline**  
—

### selected_book.fit.timing_fit

**New system**  
La lectura se adapta bien a la noche, cuando se busca una comprensión más introspectiva y menos inmediata.

**Legacy baseline**  
—

### alternatives

**New system**  
The Shallows — Nicholas Carr :: Es útil para entender la degradación cognitiva, pero su enfoque es más cerebral y menos práctico para la acción inmediata que se busca con este detonante.
Indistractable — Nir Eyal :: Ofrece estrategias concretas para controlar la atención, pero puede desviar la atención hacia la productividad, en lugar de explorar la relación emocional con las pantallas.

**Legacy baseline**  
The Shallows — Nicholas Carr :: Más cerebral y estructural; potente para entender degradación cognitiva, menos inmediato para acción breve.

### rejections

**New system**  
Deep Work :: Se centra demasiado en el rendimiento profesional y la productividad, lo que no se alinea con la necesidad de recuperar una relación más saludable con las pantallas.
Four Thousand Weeks :: Aunque útil para el manejo del tiempo, su enfoque es demasiado amplio y podría desviar la atención del problema específico de la fragmentación atencional.

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
