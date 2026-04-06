# Test Payloads

Esta carpeta guarda payloads ya ensamblados para correr pruebas manuales en un LLM sin tener que armar el prompt pieza por pieza cada vez.

## Qué contiene cada payload

Cada archivo de payload incluye:

- `SYSTEM MESSAGE`
- `USER MESSAGE`

El `USER MESSAGE` ya trae integrado:
- constitución
- tarea
- lentes (si aplica)
- schema
- fixture

## Cómo usarlo

### Opción A — Chat con system y user separados
1. copia el bloque `SYSTEM MESSAGE` en system
2. copia el bloque `USER MESSAGE` en user
3. corre la prueba
4. guarda el output en `tests/outputs/`

### Opción B — Entorno sin system separado
Si el entorno no permite `system`, puedes pegar ambos bloques en un solo mensaje, dejando claro cuál es system y cuál es user.

## Regla

No alteres el payload durante la prueba.  
Si lo cambias, ya no estás probando el sistema: estás improvisando.

## Primeros payloads

- `case-003-book-selection-new-system.md`
- `case-003-book-selection-legacy-baseline.md`