# Prompt Differences — Legacy Systems

## Propósito

Este archivo captura las diferencias estructurales entre los dos sistemas históricos de generación editorial de Triggui:

- `build-contenido.js`
- Apps Script

No es una conclusión final.  
Es un mapa de tensiones para no olvidar qué estaba pasando realmente.

---

## Diferencia 1 — Voz

### build-contenido.js
Tendencia más:
- observacional
- universal
- sobria
- menos dependiente de primera persona

### Apps Script
Tendencia más:
- cercana
- humana
- con sabor Badir más explícito
- históricamente más cercana a primera persona

### Riesgo
Dos almas editoriales compitiendo al mismo tiempo.

### Decisión arquitectónica futura
La fuente única de verdad debe definir una voz canónica y permitir variaciones controladas, no contradicciones simultáneas.

---

## Diferencia 2 — Arquitectura

### build-contenido.js
Genera contenido estructurado para `contenido.json`.

### Apps Script
Generaba contenido adicional por su cuenta.

### Riesgo
Doble generación.  
Doble verdad.  
Divergencia inevitable.

### Decisión arquitectónica futura
Una sola fuente de verdad.  
Las superficies derivan del núcleo, no compiten con él.

---

## Diferencia 3 — Anti-repetición

### build-contenido.js
Combina:
- prompt
- penalties
- memoria temporal
- verificación

### Apps Script
Carga mucho más peso en el texto del prompt:
- no repitas
- cambia
- duda
- scramble
- varía siempre

### Riesgo
La intención es potente, pero puede traducirse a ruido o inconsistencia si no se estructura bien.

### Decisión arquitectónica futura
Conservar la intención.
Mejorar la obediencia.

---

## Diferencia 4 — Verdad / Investigación

### Ambos sistemas
Piden “investigar” o “buscar” el libro con profundidad.

### Riesgo
Si no hay retrieval real, esa orden puede producir falsa seguridad.

### Decisión arquitectónica futura
Separar claramente:
- contexto real aportado al modelo
- ambición editorial permitida
- límites de afirmación

---

## Diferencia 5 — Formato de salida

### Ambos sistemas
Convergieron en:
- estructura editorial breve
- 4 partes
- highlights `[H]...[/H]`

### Valor rescatable
Aquí ya había una convergencia real.  
No todo estaba roto.

### Decisión arquitectónica futura
Mantener el formato como derivación final, pero mover la verdad canónica un nivel arriba: `editorial_nucleus`.

---

## Diferencia 6 — Intención profunda

El sistema histórico no intentaba solo generar texto.

Intentaba preservar:
- vida
- rareza
- no obviedad
- precisión
- utilidad
- congruencia
- una cualidad casi “electrón”: cambia sin perder esencia

### Decisión arquitectónica futura
Eso no debe codificarse como contradicción simultánea.
Debe codificarse como:
- esencia fija
- variación permitida
- lentes
- contexto temporal
- sesgo controlado
- derivación estructurada

---

## Conclusión provisional

Los prompts viejos no son basura.  
Tampoco son el destino final.

Son materia prima sagrada.

La nueva arquitectura debe:
- conservar su fuerza
- quitar sus choques
- volverla modular
- hacerla más obedecible por los LLMs
- dejar una sola inteligencia editorial real