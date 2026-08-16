<!-- generated from engram topic_key: sdd/task-service-picker-richer-label/spec -->
## Spec (delta) — Task Service Picker label

### REQ-PICKER-1: Richer option label
WHEN a user opens the customer-service `<select>` in CreateTaskModal or DatosForm
THEN each `<option>` SHALL render as `${downloadSpeed}/${uploadSpeed} — ${address}` when both speeds and address are present.

Scenarios:
- WHEN both speeds + address present → "10/5 — Av. Siempreviva 742"
- WHEN address missing, speeds present → "10/5"
- WHEN speeds missing, address present → "— Av. Siempreviva 742"
- WHEN all missing → fallback to current `${plan} (${type})` so the option is never empty.
- The placeholder option "— Sin servicio —" remains unchanged.

### REQ-PICKER-2: Type contract
- `Service` SHALL expose optional numeric fields `downloadSpeed?: number | null` and `uploadSpeed?: number | null` (Mbps).
- Existing fields (`plan`, `type`, `address`, `lat`, `lng`) remain unchanged.

### REQ-PICKER-3: Selected value stability
- The value passed to `onChange` (the serviceId) MUST NOT change format. Only the visible `<option>` label changes.

### REQ-PICKER-4: Test coverage
Strict TDD (Vitest):
- `CreateTaskModal.test.tsx`: assert label rendering for the four scenarios above.
- `DatosForm.test.tsx`: same assertions in edit mode.
- Existing tests using `s.plan (s.type)` selectors must be migrated.

## Out of scope
- Backend changes (separate ipnext-backend change `service-speed-fields`).
- Adding speeds to ServicePlan FK lookup.
- Re-styling the dropdown (still native `<select>`).

## Blocker
This spec is implementable only after the backend exposes `downloadSpeed`/`uploadSpeed` on `GET /clients/:id/services`. Until then, this change is HOLD.
