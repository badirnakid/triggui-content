# Manual Runner — Book Selection

## Propósito

Este runner existe para probar manualmente el motor selector de libros de Triggui antes de conectarlo al pipeline real.

No modifica código.  
No toca `build-contenido.js`.  
No toca producción.

Sirve para comparar, con orden y sin humo:

- prompt nuevo vs sistema viejo
- una variante de prompt vs otra
- un modelo vs otro
- un output bueno vs uno mediocre

---

## Qué se prueba aquí

Aquí se prueba únicamente la tarea:

- `prompts/tasks/select-book.md`

Contra fixtures de entrada estructurados como:

- `tests/fixtures/case-001-...json`
- `tests/fixtures/case-002-...json`
- `tests/fixtures/case-003-...json`

Y se evalúa con:

- `tests/rubrics/book-selection-rubric.md`

---

## Qué NO se prueba aquí

Aquí no se prueba:

- generación de tarjeta
- bloques
- email
- edición viva
- OG
- render visual
- HTML
- Apps Script
- cron del pipeline

Solo selección de libro.

---

## Material mínimo para correr una prueba

Para una prueba manual correcta necesitas reunir:

1. `prompts/constitution/triggui-core.md`
2. `prompts/tasks/select-book.md`
3. el lente principal correspondiente
4. lentes secundarios si aplican
5. `prompts/schemas/book-selection-request.json`
6. el fixture del caso
7. `tests/rubrics/book-selection-rubric.md`

---

## Orden correcto de lectura

El orden recomendado para construir el prompt manual es:

1. constitución
2. tarea
3. lente principal
4. lentes secundarios
5. schema
6. fixture

La constitución pone la ética.  
La tarea pone la función.  
El lente pone el sesgo.  
El schema pone el contrato.  
El fixture pone el caso real.

---

## Procedimiento exacto

### Paso 1
Elige un caso de `tests/fixtures/`.

Ejemplos:
- `case-001-autoconocimiento-lunes.json`
- `case-002-game-theory-confianza-repeticion.json`
- `case-003-catalog-only-atencion-friccion.json`

### Paso 2
Identifica el lente principal y secundarios dentro del fixture.

### Paso 3
Abre estos archivos y cópialos en este orden:

1. `prompts/constitution/triggui-core.md`
2. `prompts/tasks/select-book.md`
3. `prompts/lenses/[primary].md`
4. `prompts/lenses/[secondary].md` si aplica
5. `prompts/schemas/book-selection-request.json`

### Paso 4
Agrega al final este bloque:

```text
INPUT FIXTURE:
[pegar aquí el JSON completo del fixture]