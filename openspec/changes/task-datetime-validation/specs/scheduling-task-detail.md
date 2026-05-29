<!-- generated from engram topic_key: sdd/task-datetime-validation/spec -->
## REQ-DATE-1: End disabled until Start has value
- WHEN startDate value is empty string THEN endDate input MUST have `disabled` attribute.
- WHEN startDate has any non-empty value THEN endDate input MUST be enabled.

## REQ-DATE-2: Auto-default End to Start + 1h when End empty
- WHEN startDate changes from empty to a parseable datetime AND endDate is empty THEN endDate MUST be set to startDate + 60 minutes formatted as datetime-local string ("YYYY-MM-DDTHH:mm").
- Setting endDate via auto-default MUST mark form dirty (so save button activates).

## REQ-DATE-3: Respect user-edited End
- WHEN startDate changes AND endDate is NOT empty (user has any value) THEN endDate MUST remain unchanged.

## REQ-DATE-4: Preserve end >= start validation
- Existing inline error "Fecha de fin debe ser mayor o igual a la de inicio" continues to function on submit.

## Scenarios
- Scenario A: empty form, user picks Start=2026-06-10T10:00 → End auto-fills to 2026-06-10T11:00. End enabled.
- Scenario B: form with Start=null, End=null → End input disabled.
- Scenario C: Start=2026-06-10T10:00, End=2026-06-10T12:30 (initial). User changes Start to 2026-06-11T08:00 → End stays at 2026-06-10T12:30 (will trigger validation error on submit since end < start).
- Scenario D: User clears Start → End becomes disabled again. End value not touched.
