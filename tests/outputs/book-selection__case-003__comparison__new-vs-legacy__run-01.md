# Comparación formal — case-003 — new-system vs legacy-baseline

## Archivos usados
- Fixture: `tests/fixtures/case-003-catalog-only-atencion-friccion.json`
- New system: `tests/outputs/book-selection__case-003__new-system__model-gpt-4o-mini__run-01.json`
- Legacy baseline: `tests/outputs/book-selection__case-003__legacy-baseline__model-gpt-4o-mini__run-01.json`

## Checks automáticos
- JSON válido:
  - New system: Sí
  - Legacy baseline: Sí
- `selection_source === "catalog"`:
  - New system: Sí
  - Legacy baseline: No
- Libro seleccionado existe en catálogo del fixture:
  - New system: No
  - Legacy baseline: No
- Alternatives count:
  - New system: 2
  - Legacy baseline: 0
- Rejections count:
  - New system: 2
  - Legacy baseline: 0

## Comparación lado a lado

### detected_theme.core

**New system**  
Degradación de la atención y relación con las pantallas

**Legacy baseline**  
—

### detected_theme.subtheme

**New system**  
Fragmentación de la atención y búsqueda de presencia

**Legacy baseline**  
—

### detected_theme.why_it_matters_now

**New system**  
En un mundo saturado de estímulos digitales, es crucial entender cómo recuperar la atención plena y evitar la inercia reactiva.

**Legacy baseline**  
—

### selected_book.title

**New system**  
Stolen Focus

**Legacy baseline**  
—

### selected_book.author

**New system**  
Johann Hari

**Legacy baseline**  
—

### selected_book.why_this_book

**New system**  
Este libro aborda de manera amplia y cultural la problemática de la atención fragmentada, ofreciendo un análisis profundo que puede ayudar a entender las causas y posibles soluciones, lo que se alinea perfectamente con la necesidad de recuperar una relación sana con las pantallas.

**Legacy baseline**  
—

### selected_book.fit.trigger_fit

**New system**  
El enfoque en la atención fragmentada se alinea con la experiencia de inercia y dificultad para mantener la presencia.

**Legacy baseline**  
—

### selected_book.fit.lens_fit

**New system**  
El libro permite una reflexión sobre patrones internos de atención y cómo estos se ven afectados por el entorno digital.

**Legacy baseline**  
—

### selected_book.fit.timing_fit

**New system**  
La lectura nocturna es ideal para reflexionar sobre la atención y la presencia, temas que requieren un espacio de calma y contemplación.

**Legacy baseline**  
—

### alternatives.titles

**New system**  
Indistractable | The Shallows

**Legacy baseline**  
—

### rejections.titles

**New system**  
Deep Work | Four Thousand Weeks

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

### 5) Calidad de alternativas y rechazos
- Mejor:
- Motivo:
- Nota new (0-10):
- Nota legacy (0-10):

## Conclusión provisional
- Ganador provisional:
- ¿El new-system ya supera al legacy?:
- Primer ajuste permitido a `prompts/tasks/select-book.md`:
- Evidencia puntual que lo justifica:
