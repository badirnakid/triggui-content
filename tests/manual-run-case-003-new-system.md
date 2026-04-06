# Manual Run — Case 003 — New System

## Caso

`tests/fixtures/case-003-catalog-only-atencion-friccion.json`

## Objetivo

Correr manualmente el selector modular nuevo sobre un caso que fuerza algo importante:

- obedecer `catalog_only`
- no confundir atención con pura productividad
- elegir con criterio editorial real dentro de un catálogo dado

---

## Material a usar

Pega exactamente estos archivos en este orden:

1. `prompts/constitution/triggui-core.md`
2. `prompts/tasks/select-book.md`
3. `prompts/lenses/self-knowledge.md`
4. `prompts/lenses/chronobiology.md`
5. `prompts/schemas/book-selection-request.json`

Y al final:

6. `tests/fixtures/case-003-catalog-only-atencion-friccion.json`

---

## System recomendado

```text
Eres el motor selector de libros de Triggui. Debes obedecer la constitución, la tarea, los lentes y el contrato JSON. Devuelve solo JSON válido, sin texto extra.