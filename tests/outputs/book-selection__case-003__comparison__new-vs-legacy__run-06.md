# Comparación formal — case-003 — new-system vs legacy-baseline

## Archivos usados
- Fixture: `tests/fixtures/case-003-catalog-only-atencion-friccion.json`
- New system: `tests/outputs/book-selection__case-003__new-system__model-gpt-4o-mini__run-02.json`
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
Recuperar una presencia completa y menos reactiva.

**Legacy baseline**  
—

### detected_theme.why_it_matters_now

**New system**  
La inercia digital actual afecta la capacidad de concentración y presencia, especialmente en momentos de baja energía.

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
Este libro aborda de manera amplia y cultural la fragmentación de la atención en el entorno digital, ofreciendo una perspectiva que ayuda a entender la problemática sin caer en un enfoque meramente productivo.

**Legacy baseline**  
Amplio, cultural, contemporáneo, fuerte para hablar de atención fragmentada y entorno.

### selected_book.fit.trigger_fit

**New system**  
El libro se centra en la atención fragmentada, que es el núcleo del detonante.

**Legacy baseline**  
—

### selected_book.fit.lens_fit

**New system**  
Permite una exploración interna de los patrones de atención y la relación con las pantallas.

**Legacy baseline**  
—

### selected_book.fit.timing_fit

**New system**  
La energía baja de la noche sugiere una lectura que no demande acción inmediata, sino reflexión.

**Legacy baseline**  
—

### alternatives

**New system**  
The Shallows — Nicholas Carr :: Ofrece un análisis profundo sobre cómo internet afecta nuestros cerebros, pero es más cerebral y menos inmediato en cuanto a acciones prácticas, lo que puede no resonar con la necesidad de recuperar una relación activa con las pantallas.
Indistractable — Nir Eyal :: Proporciona estrategias prácticas para controlar la atención, pero corre el riesgo de ser percibido como un enfoque de productividad que no se alinea con el deseo de una relación más saludable con las pantallas.

**Legacy baseline**  
The Shallows — Nicholas Carr :: Más cerebral y estructural; potente para entender degradación cognitiva, menos inmediato para acción breve.

### rejections

**New system**  
Deep Work :: Aunque es fuerte en el enfoque, se centra demasiado en el rendimiento profesional y puede no abordar adecuadamente la degradación de la atención en el contexto digital que se busca explorar.
Four Thousand Weeks :: Si bien trata sobre la gestión del tiempo y la finitud, puede abrir demasiado el ángulo y desviar la atención del problema específico de la fragmentación atencional que se desea abordar.

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
