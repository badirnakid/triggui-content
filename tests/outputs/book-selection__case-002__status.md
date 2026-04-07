# case-002 status

## Estado
Validated improvement cycle complete.

## Current best run
- New system: `tests/outputs/book-selection__case-002__new-system__model-gpt-4o-mini__run-06.json`
- Legacy baseline: `tests/outputs/book-selection__case-002__legacy-baseline__model-gpt-4o-mini__run-01.json`

## What improved
- The selector stopped collapsing into generic workplace/management books.
- The winning book is now native to the primary lens (`game-theory`).
- The output kept a clean structure: 2 alternatives + 2 rejections.
- Full schema returned correctly.
- Output language stayed aligned with the fixture language.

## What we are NOT doing next
- No more tightening of discover mode based only on case-002.
- No more appending rules to `select-book.md`.
- No more forcing extra variety just because a judge asks for it.

## Next move
Replace case-specific runners with one generic runner that auto-selects the correct task mode:
- constrained / catalog-first
- discover / lens-first
