# case-003 status

## Estado
Validated improvement cycle complete.

## Current best run
- New system: `tests/outputs/book-selection__case-003__new-system__model-gpt-4o-mini__run-04.json`
- Legacy baseline: `tests/outputs/book-selection__case-003__legacy-baseline__model-gpt-4o-mini__run-02.json`
- Comparison: `tests/outputs/book-selection__case-003__comparison__new-vs-legacy__run-08.md`
- Judge: `tests/outputs/book-selection__case-003__judge-eval__new-vs-legacy__model-gpt-4o-mini__run-07.md`

## What improved
- Selected book justification became more decisive and non-interchangeable.
- Alternatives and rejections returned to a clean fixed split: 2 + 2.
- Catalog compliance is confirmed.
- New system clearly beats legacy on case-003.

## What we are NOT doing next
- No more prompt tightening based only on case-003.
- No follow-up edits based on the judge request for “more diversity” or “three alternatives”, because that conflicts with the fixture size and the fixed split rule.

## Next move
Run the same system on case-002 to test generalization and detect whether the recent prompt changes hold outside the attention/screens scenario.