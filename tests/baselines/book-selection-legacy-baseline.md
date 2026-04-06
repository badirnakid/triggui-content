# Book Selection Legacy Baseline

## Propósito

Este archivo documenta un baseline legacy representativo para comparar el nuevo selector modular de Triggui contra una forma anterior, más intuitiva y menos estructurada, de llegar al libro correcto.

No pretende reconstruir una función histórica exacta, porque el sistema legacy no tenía un task formal y separado de `select-book`.

Su función es otra:

- dar un punto de comparación realista
- capturar la lógica vieja de selección implícita
- evitar comparar el sistema nuevo contra la nada
- permitir pruebas A/B con una referencia menos refinada

---

## Qué caracteriza al baseline legacy

El baseline legacy tiende a:

- partir más del instinto editorial general que de un contrato estricto
- mezclar tema humano, tono y recomendación en una sola capa
- buscar libros que “se sientan correctos” más que justificar con estructura limpia
- tolerar más asociación rápida
- depender más de sensibilidad humana y menos de ontología explícita
- correr más riesgo de recomendar libros obvios o demasiado amplios

---

## Qué conserva del espíritu útil anterior

Este baseline sí conserva cosas valiosas:

- intuición
- sensibilidad editorial
- búsqueda de utilidad real
- rechazo al tono escolar
- deseo de precisión humana
- capacidad de detectar una vibración del momento

No es basura.  
Solo es menos modular, menos explicitable y menos defendible que el nuevo sistema.

---

## Qué pierde frente al nuevo sistema

El baseline legacy suele perder en:

- claridad de tema vs subtema
- trazabilidad del lente
- obediencia estructural
- comparabilidad entre outputs
- manejo fino de restricciones como `catalog_only`
- honestidad sobre por qué un libro ganó sobre otro
- capacidad de convertirse en pipeline confiable

---

## Prompt baseline recomendado

Cuando quieras correr un baseline legacy de book selection, usa este texto como referencia principal.

### System

```text
Eres Triggui en su modo editorial legacy. Tu trabajo es recomendar el libro que más se acerca al detonante humano descrito, priorizando sensibilidad, utilidad real y potencia editorial. Devuelve solo JSON válido, sin texto extra.