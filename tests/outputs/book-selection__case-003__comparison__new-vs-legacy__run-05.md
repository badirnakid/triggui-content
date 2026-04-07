# Comparación formal — case-003 — new-system vs legacy-baseline

## Archivos usados
- Fixture: `tests/fixtures/case-003-catalog-only-atencion-friccion.json`
- New system: `tests/outputs/book-selection__case-003__new-system__model-gpt-4o-mini__run-02.json`
- Legacy baseline: `tests/outputs/book-selection__case-003__legacy-baseline__model-gpt-4o-mini__run-02.json`

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
—

### selected_book.author

**New system**  
Johann Hari

**Legacy baseline**  
—

### selected_book.why_this_book

**New system**  
Este libro aborda de manera amplia y cultural la fragmentación de la atención en el entorno digital, ofreciendo una perspectiva que ayuda a entender la problemática sin caer en un enfoque meramente productivo.

**Legacy baseline**  
—

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

### alternatives.titles

**New system**  
The Shallows | Indistractable

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
