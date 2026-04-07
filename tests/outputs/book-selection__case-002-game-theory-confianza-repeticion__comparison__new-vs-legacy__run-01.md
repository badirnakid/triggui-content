# Comparación formal — case-002-game-theory-confianza-repeticion — new-system vs legacy-baseline

## Archivos usados
- Fixture: `tests/fixtures/case-002-game-theory-confianza-repeticion.json`
- New system: `tests/outputs/book-selection__case-002-game-theory-confianza-repeticion__new-system__model-gpt-4o-mini__run-01.json`
- Legacy baseline: `tests/outputs/book-selection__case-002-game-theory-confianza-repeticion__legacy-baseline__model-gpt-4o-mini__run-01.json`

## Schema detectado
- New system: new_system_like
- Legacy baseline: legacy_recommendations

## Checks automáticos
- JSON válido:
  - New system: Sí
  - Legacy baseline: Sí
- `selection_source === "catalog"`:
  - New system: No
  - Legacy baseline: No determinable (schema legacy)
- Libro seleccionado existe en catálogo del fixture:
  - New system: No
  - Legacy baseline: No
- Alternatives count:
  - New system: 2
  - Legacy baseline: 4
- Rejections count:
  - New system: 2
  - Legacy baseline: 0

## Coincidencias de catálogo detectadas
### New system selected title matches
—

### Legacy baseline selected title matches
—

## Primeros títulos detectados en fixture
- [fixture.lens.secondary] self-knowledge
- [fixture.recent_history] Thinking, Fast and Slow
- [fixture.recent_history] Influence

## Comparación lado a lado

### detected_theme.core

**New system**  
Patrones de incentivos y cooperación rota en entornos laborales.

**Legacy baseline**  
—

### detected_theme.subtheme

**New system**  
Estructuras de decisión y costos ocultos en la interacción humana.

**Legacy baseline**  
—

### detected_theme.why_it_matters_now

**New system**  
Entender estos patrones es crucial para mejorar la dinámica de trabajo y evitar la frustración recurrente.

**Legacy baseline**  
—

### selected_book.title

**New system**  
The Art of Strategy: A Game Theorist's Guide to Success in Business and Life

**Legacy baseline**  
The Art of Strategy

### selected_book.author

**New system**  
Avinash K. Dixit y Barry J. Nalebuff

**Legacy baseline**  
Avinash K. Dixit and Barry J. Nalebuff

### selected_book.why_this_book

**New system**  
Este libro gana porque explica la cooperación y los incentivos en contextos de repetición como un problema de teoría de juegos, lo que encaja mejor con este detonante que 'Predictably Irrational' de Dan Ariely, porque aborda directamente cómo las decisiones estratégicas afectan la dinámica de grupo y la reputación.

**Legacy baseline**  
Una introducción accesible a la teoría de juegos y cómo aplicar sus principios en situaciones de la vida real, ideal para entender los patrones de incentivos y cooperación.

### selected_book.fit.trigger_fit

**New system**  
El libro permite desglosar cómo las acciones individuales impactan en el resultado colectivo, ayudando a ver los patrones de incentivos ocultos.

**Legacy baseline**  
—

### selected_book.fit.lens_fit

**New system**  
Ofrece un marco claro de teoría de juegos que revela las dinámicas de cooperación y deficiencias en la comunicación.

**Legacy baseline**  
—

### selected_book.fit.timing_fit

**New system**  
A las 9 de la mañana, con energía alta y modo mental analítico, conviene un libro que permita modelar el patrón con estructura y no solo procesar frustración.

**Legacy baseline**  
—

### alternatives

**New system**  
Predictably Irrational — Dan Ariely :: Sirve para entender cómo las decisiones irracionales afectan la cooperación, pero aquí pierde porque se centra más en el comportamiento individual que en la estructura de incentivos y cooperación rota.
Game Theory for Applied Economists — G. E. P. Box :: Ofrece una buena base sobre teoría de juegos, pero aquí pierde porque es más técnico y menos aplicable a situaciones de cooperación en el trabajo.

**Legacy baseline**  
Predictably Irrational — Dan Ariely :: Explora cómo las decisiones humanas a menudo son irracionales y cómo esto afecta la cooperación y las expectativas en las interacciones sociales.
Game Theory: An Introduction — E. N. Barron :: Un texto que ofrece una visión general de la teoría de juegos, ideal para aquellos que buscan entender las dinámicas de incentivos y decisiones estratégicas.
Nudge: Improving Decisions About Health, Wealth, and Happiness — Richard H. Thaler and Cass R. Sunstein :: Analiza cómo pequeñas intervenciones pueden cambiar el comportamiento humano y mejorar la toma de decisiones en contextos de cooperación y confianza.
The Wisdom of Crowds — James Surowiecki :: Investiga cómo la agregación de información de grupos puede llevar a mejores decisiones, ofreciendo una perspectiva sobre la cooperación y los costos ocultos.

### rejections

**New system**  
The Five Dysfunctions of a Team — Patrick Lencioni :: Aunque aborda problemas de equipo, se enfoca en la dinámica de grupo sin profundizar en la estructura de incentivos y costos ocultos.
Crucial Conversations — Kerry Patterson :: Sirve para comunicación difícil, pero aquí pierde porque trata el síntoma conversacional y no la estructura repetida de incentivos y compensación invisible.

**Legacy baseline**  
—

