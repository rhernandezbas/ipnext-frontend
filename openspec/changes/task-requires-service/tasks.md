<!-- generated from engram topic_key: sdd/task-requires-service-fe/tasks -->
## Tasks — task-requires-service (Frontend)
Strict TDD: every task starts with a failing test. Test runner: `npx vitest run` (or `npm test`).

### Phase A — Red (write failing tests first)

- [ ] A.1 — Create `src/__tests__/scheduling/components/` directory and new file `CreateTaskModal.service.test.tsx`.
- [ ] A.2 — Set up test scaffolding: `vi.mock` for all hooks (`useClientDetail`, `useClientServices`, `useTaskCategories`, `useTaskPriorities`, `useConfirm`), CSS module identity proxy, `CustomerPicker` stub that exposes an `onChange` trigger.
- [ ] A.3 — Write **SCEN-FORM-1**: render modal with client selected + services=[S1,S2] + no serviceId → click submit → assert service error message is visible AND `onCreate` is NOT called. Run → RED.
- [ ] A.4 — Write **SCEN-FORM-2**: render modal with client selected + services=[] + `isLoading: false` → assert `"Este cliente no tiene servicios activos"` is in the document AND the service `<select>` has `disabled` attribute. Run → RED.
- [ ] A.5 — Write **SCEN-FORM-3**: render modal with client, services=[S1], title filled, project with workflow → simulate selecting S1 → click submit → assert `onCreate` called with `serviceId: S1.id` AND no error message. Run → RED.
- [ ] A.6 — Write **SCEN-FORM-4**: reproduce SCEN-FORM-1 error state → simulate selecting S1 → assert error message is gone. Run → RED.
- [ ] A.7 — Confirm all 4 scenarios are RED before touching production code.

### Phase B — Green (implementation)

- [ ] B.1 — In `CreateTaskModal.tsx`: destructure `isLoading: servicesLoading` from `useClientServices` (line ~99).
- [ ] B.2 — Add `const [serviceError, setServiceError] = useState<string | null>(null);` after the existing `error` state declaration.
- [ ] B.3 — Extend `canSave`: add `&& (!customerId || !!serviceId)` to the existing condition.
- [ ] B.4 — In `handleSave`: add guard after date-range check — if `customerId && !serviceId`, call `setServiceError('Seleccioná un servicio para continuar.')` and return. Add `setServiceError(null)` at the top of the happy path (after all guards pass).
- [ ] B.5 — In the service `<select>` `onChange` handler: add `setServiceError(null)` alongside `setServiceId(...)`.
- [ ] B.6 — In the JSX service block (inside `{customerId && (...)}` at line ~288): add `{!servicesLoading && customerId && customerServices.length === 0 && <p className={styles.error}>Este cliente no tiene servicios activos</p>}`.
- [ ] B.7 — Below the service `<select>`, add `{serviceError && <p className={styles.error}>{serviceError}</p>}`.
- [ ] B.8 — Run `npx vitest run` — all 4 scenarios must be GREEN.

### Phase C — Cleanup & verification

- [ ] C.1 — Check existing tests that render `CreateTaskModal` (if any exist in `__tests__/scheduling/`) — ensure no fixtures break due to the new `isLoading` destructuring or `canSave` change.
- [ ] C.2 — Run `tsc --noEmit` — must be clean.
- [ ] C.3 — Final `npx vitest run` — full suite green.

### Files touched

| File | Change |
|---|---|
| `src/pages/scheduling/SchedulingTasksPage/components/CreateTaskModal.tsx` | Add `serviceError` state, extend `canSave`, update `handleSave`, update select JSX |
| `src/__tests__/scheduling/components/CreateTaskModal.service.test.tsx` | New — 4 TDD scenarios |

### Open risk (flag to product owner)

Tasks created without a client (`customerId: null`) will still send `serviceId: null` to the BE. If the BE enforces `serviceId` unconditionally (not scoped to when `customerId` is set), these creates will fail with 400. Coordinate with product owner: either (a) disallow task creation without client in the UI, or (b) the BE makes `serviceId` required only when `customerId` is present. Current implementation follows the spec (REQ-FORM-SERVICE-5) and only enforces service when a client is selected.

### Estimated complexity
- Files touched: 2 (1 production, 1 new test)
- No new hooks, no API client changes, no migration
- Total tasks: 14 (7 red + 7 green/cleanup)
