<!-- generated from engram topic_key: sdd/task-datetime-validation/proposal -->
## Intent
Add UX validation to startDate/endDate inputs in DatosForm (SchedulingTaskDetailPage) to prevent invalid date entries and remove friction.

## Scope
- File: src/pages/scheduling/SchedulingTaskDetailPage/components/DatosForm.tsx
- Tests: src/__tests__/scheduling/components/DatosForm.test.tsx

## Requirements
1. End input disabled while Start has no value (clear visual signal).
2. When Start gets a value (from empty), auto-default End to Start + 1 hour IF End is empty.
3. If End already has a value (user-edited or initial), do NOT override it on Start change.
4. Preserve existing end >= start validation on submit.

## Out of scope
- Server-side validation
- Other date fields outside DatosForm
