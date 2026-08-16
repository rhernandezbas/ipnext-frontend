<!-- generated from engram topic_key: sdd/task-service-picker-richer-label/proposal -->
## Intent
When picking a customer service in CreateTaskModal and DatosForm (task edit), each option should show `<download>/<upload> — <service address>` (e.g. `10/5 — Av. Siempreviva 742`) instead of the current `${plan} (${type})`.

## Why
The current label `plan (type)` is uninformative — technicians need bandwidth and address at a glance to confirm they're picking the right service, especially for clients with multiple contracts.

## Outcome of exploration
BLOCKED on backend. The frontend CANNOT render `<download>/<upload>` from data already available.
- `Service` entity (domain + Prisma + Splynx + GR) does NOT carry `downloadSpeed`/`uploadSpeed` columns or fields.
- The `plan` column is a free-text label ("Plan 100Mbps", "Empresarial 200MB", etc.) — not parseable reliably.
- `ServicePlan` model has structured speeds but `Service.plan` is a string with no FK to ServicePlan.
- The `address` portion IS reachable (added by prior `task-service-location` change), so a partial label `— <address>` is doable, but does NOT meet the user request.

## Recommended scope split
1. ipnext-backend change: extend `Service` with optional `downloadSpeed`/`uploadSpeed` (Int, Mbps), parse from GR raw, surface through `GET /clients/:id/services`. Idempotent additive migration, mirroring `task-service-location` pattern.
2. ipnext-frontend change (this change): bump `Service` type and option-label rendering once the backend ships.

## What we did NOT do
- No code changed in this iteration. Worktree created, tests not modified. NO MOCK speeds added — would violate the no-mocks constraint.

## Decision
HOLD frontend implementation until backend exposes speeds. Mirror proposal saved to ipnext-backend engram for the API change.

## Files referenced (no edits made)
- src/pages/scheduling/SchedulingTasksPage/components/CreateTaskModal.tsx (line 266-270 — option label)
- src/pages/scheduling/SchedulingTaskDetailPage/components/DatosForm.tsx (line 216-220 — option label)
- src/types/customer.ts `Service` (would gain `downloadSpeed?`, `uploadSpeed?`)
- src/hooks/useCustomers.ts `useClientServices` (no signature change)
