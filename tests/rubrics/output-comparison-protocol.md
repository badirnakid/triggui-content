# Output Comparison Protocol

## Propósito

Este protocolo existe para comparar outputs de forma limpia entre:

- sistema nuevo vs sistema viejo
- prompt A vs prompt B
- modelo A vs modelo B
- run 01 vs run 02

No sirve para “sentir” cuál gustó más.  
Sirve para juzgar con criterio.

---

## Regla cero

No se compara por intuición suelta.  
Se compara por:

1. mismo caso
2. mismo objetivo
3. misma tarea
4. misma rúbrica
5. misma severidad

Si cualquiera de esas cambia, la comparación queda contaminada.

---

## Qué se debe mantener fijo

Siempre que sea posible, mantén fijo:

- el fixture
- el modelo
- el operador humano
- el orden de inyección del prompt
- la tarea evaluada
- la rúbrica
- la convención de guardado

---

## Qué sí puede variar

Puede variar, de manera controlada:

- la arquitectura del prompt
- el uso o no uso de lentes
- el system message
- la temperatura
- la presencia o no de contexto histórico
- el sistema viejo vs el nuevo

---

## Tipos de comparación válidos

### Comparación A
Nuevo sistema vs baseline legacy

Pregunta:
¿La nueva arquitectura modular supera la lógica anterior?

### Comparación B
Nuevo sistema con lente vs sin lente

Pregunta:
¿El lente realmente agrega precisión o solo ruido?

### Comparación C
Mismo sistema, distinto modelo

Pregunta:
¿La arquitectura sobrevive bien al cambio de modelo?

### Comparación D
Mismo sistema, distinta temperatura

Pregunta:
¿Dónde está el mejor equilibrio entre vida y obediencia?

---

## Plantilla mínima de comparación

Cada comparación debería responder por escrito:

- Qué se comparó
- Qué se mantuvo fijo
- Qué cambió
- Qué output ganó
- Por qué ganó
- Qué perdió el otro
- Qué se aprendió
- Qué se ajusta o no se ajusta después

---

## Criterio de desempate

Si dos outputs tienen puntaje parecido, desempata así:

1. gana el más específico
2. gana el menos genérico
3. gana el más defendible
4. gana el que mejor podría alimentar una pieza Triggui poderosa
5. gana el que menos depende de que un humano lo “salve” después

---

## Qué no cuenta como victoria

No cuenta como victoria:

- sonar más sofisticado
- usar palabras más raras
- verse más largo
- parecer más profundo
- ser más severo o más brillante en apariencia

La victoria real es:

- mejor precisión
- mejor encaje
- mejor potencial editorial
- mejor obediencia estructural
- menos humo

---

## Señales de falsa mejora

Cuidado si un output parece mejor solo porque:

- habla más bonito
- usa más conceptos
- menciona más cosas
- da más alternativas
- suena más autoritario

Eso puede ser inflación verbal, no mejora real.

---

## Señales de mejora real

Sí hay mejora real si:

- entiende mejor el detonante
- elige un libro más preciso
- justifica mejor
- usa mejor el lente
- evita mejor lo genérico
- deja una base editorial más viva
- se puede defender mejor bajo rúbrica

---

## Regla de documentación

Cada comparación debe dejar un archivo `.comparison.md` en `tests/outputs/`.

Convención recomendada:

```text
comparison__book-selection__case-003__new-vs-legacy__model-gpt-4o-mini__run-01.md