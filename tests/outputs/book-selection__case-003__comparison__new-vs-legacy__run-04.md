# Comparación formal — case-003 — new-system vs legacy-baseline

## Archivos usados
- Fixture: `tests/fixtures/case-003-catalog-only-atencion-friccion.json`
- New system: `tests/outputs/book-selection__case-003__new-system__model-gpt-4o-mini__run-01.json`
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
  - New system: 3
  - Legacy baseline: 0
- Rejections count:
  - New system: 1
  - Legacy baseline: 0

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
La saturación digital y la dificultad para mantener la presencia plena son cada vez más comunes, especialmente en momentos de baja energía como la noche.

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
Este libro aborda de manera amplia y cultural por qué la atención se fragmenta en el entorno actual y ofrece una perspectiva rica que ayuda a entender la relación con las pantallas sin caer en la trampa de la productividad vacía.

**Legacy baseline**  
—

### selected_book.fit.trigger_fit

**New system**  
Responde directamente a la experiencia de fragmentación y la necesidad de recuperar la atención plena.

**Legacy baseline**  
—

### selected_book.fit.lens_fit

**New system**  
Permite ver patrones internos de atención y fricción con el uso de pantallas.

**Legacy baseline**  
—

### selected_book.fit.timing_fit

**New system**  
Es adecuado para la noche, cuando la energía es baja y se busca una reflexión más profunda.

**Legacy baseline**  
—

### alternatives.titles

**New system**  
The Shallows | Indistractable | Four Thousand Weeks

**Legacy baseline**  
—

### rejections.titles

**New system**  
Deep Work

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
