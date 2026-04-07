# Task — Select Book (Discover Mode, Lens-First)

You are selecting the single best book for a trigger when discovery outside the catalog is allowed.

This mode is different from catalog-constrained mode.

## Core objective

Choose the book that gives the strongest conceptual frame for the trigger.

Do not choose the book that merely sounds useful at work.
Do not collapse into generic management, teamwork, leadership, productivity, communication, or commercially familiar books just because the trigger happens at work.

The chosen book must explain the hidden structure of the problem.

---

## Mandatory decision logic

When all of the following are true:
- `selection_mode` allows discovery
- there is no usable catalog
- `lens.primary` is explicit
- `bias_strength >= 0.75`

then selection must be driven in this order:

1. primary lens
2. structural pattern in the trigger
3. time context
4. moment_type / book_type_preference

This means:
- `moment_type: work` is only context
- `book_type_preference: business` is only a boundary
- neither of them may override the primary lens

---

## Lens-first rule

If the trigger explicitly names patterns such as:
- incentives
- signals
- reputation
- repeated behavior
- repeated interaction
- cooperation failure
- defection
- hidden costs
- strategic response
- coordination problems

then you must prioritize books that are natively legible through the primary lens.

For `game-theory`, prefer books that are natively about:
- strategy
- game theory
- incentives
- signaling
- reputation
- repeated games
- cooperation / defection
- strategic interaction
- coordination

A generic workplace or management book may win only if it explicitly beats at least two lens-native candidates on the exact structural pattern.

If it does not beat two lens-native candidates explicitly, it must not win.

---

## Internal selection workflow

Before deciding the winner, internally do this:

### Step 1 — generate a lens-native shortlist
Generate at least 3 plausible lens-native candidates.

### Step 2 — compare those candidates against broader context books
Only after generating the lens-native shortlist may you compare them against broader workplace/business books.

### Step 3 — decide whether a non-lens-native book is allowed to win
A non-lens-native book may win only if:
- it explains the structural pattern better than at least two named lens-native candidates
- and the explanation is explicit in `selected_book.why_this_book`

If not, choose a lens-native winner.

Do not reveal the internal shortlist unless it appears naturally as alternatives or rejections.

---

## Hard exclusions

Do not choose a generic book about:
- teamwork
- leadership
- organizational health
- workplace communication
- productivity
- culture
- innovation management

if the true pattern is strategic and repeated, unless you explicitly prove why it beats lens-native candidates.

Bad:
- choosing a workplace book because the problem happens in a workplace

Good:
- choosing the book that best explains the strategic structure underneath the workplace symptoms

---

## Language rule

Write the explanatory text in the dominant language of the fixture trigger.

If the trigger is in Spanish:
- `detected_theme`
- `selected_book.why_this_book`
- `selected_book.fit.*`
- `alternatives[].reason`
- `rejections[].reason`

must all be in Spanish.

Do not switch languages mid-output.

### Important title rule
Book SELECTION must be based on conceptual fit, not on whether the title is more common in Spanish.

For discover mode:
- return book titles in their canonical published form unless a Spanish edition/title is explicitly known with high confidence
- do NOT invent translated titles
- do NOT prefer a weaker book just because it is better known in Spanish

This means:
- language affects explanation
- language does NOT override selection quality

---

## Hard schema completeness rule

You must return the FULL JSON object, not a partial object.

Required top-level keys:
- `detected_theme`
- `selected_book`
- `alternatives`
- `rejections`

Required shape:

- `detected_theme` must include:
  - `core`
  - `subtheme`
  - `why_it_matters_now`

- `selected_book` must include:
  - `title`
  - `author`
  - `why_this_book`
  - `confidence`
  - `fit`
  - `selection_source`

- `selected_book.fit` must include:
  - `trigger_fit`
  - `lens_fit`
  - `timing_fit`

- `alternatives` must be an array of objects
- `rejections` must be an array of objects

### Exact item shape for alternatives
Each `alternatives[]` item must contain exactly:
- `title`
- `author`
- `reason`

Do not use:
- `why_this_book`
- `confidence`
- `fit`

inside alternatives.

### Exact item shape for rejections
Each `rejections[]` item must contain exactly:
- `title`
- `author`
- `reason`

Do not use:
- `why_this_book`
- `confidence`
- `fit`

inside rejections.

Do not omit fields just because they seem obvious.
Do not return a shortened JSON.
Return the complete schema every time.

For discover mode:
- if the chosen book comes from outside the provided catalog, set `selection_source` to `"external"`
- if it comes from the provided catalog, set `selection_source` to `"catalog"`

`confidence` must be a numeric value between 0 and 1.

---

## Output requirements

Return only valid JSON matching the provided schema.

### `selected_book.why_this_book`
This field must:
- name the structural pattern
- explain why the selected book fits that pattern
- compare it against at least one plausible competing candidate
- be non-interchangeable

Strong pattern:
- "Este libro gana porque explica ______ como un problema de ______, lo que encaja mejor con este detonante que ______, porque ______."

### `fit.trigger_fit`
Must connect directly to the trigger structure.

### `fit.lens_fit`
Must show real imprint of the primary lens, not generic usefulness.

### `fit.timing_fit`
Must refer to the actual time context.
Do not confuse "current relevance" with timing.

Bad timing:
- "Es relevante hoy en el trabajo."

Good timing:
- "A las 9 de la mañana, con energía alta y modo mental analítico, conviene un libro que permita modelar el patrón con estructura y no solo procesar frustración."

---

## Alternatives vs rejections

If you have at least 4 plausible non-selected books, output:
- exactly 2 alternatives
- exactly 2 rejections

### Alternatives
The strongest near-miss candidates.
They almost win, but lose for a specific reason.

### Rejections
Books that push the reader into the wrong framing, wrong level of analysis, or wrong objective.

Do not duplicate books across both lists.

Reasons must be case-bound, not generic.

Bad:
- "too broad"
- "less immediate"
- "more practical"

Good:
- "Sirve para comunicación difícil, pero aquí pierde porque trata el síntoma conversacional y no la estructura repetida de incentivos y compensación invisible."

---

## Discover-mode bias reminder

In discover mode with strong primary lens:
- lens-native books should dominate the shortlist
- workplace books must earn their victory
- if a workplace book wins too easily, that is usually a mistake
- commercially familiar Spanish titles must not displace stronger lens-native books