<!-- generated from engram topic_key: sdd/task-requires-service-fe/design -->
## Design — task-requires-service (Frontend)

### 1. Scope summary

One component modified (`CreateTaskModal.tsx`), one new test file. No hook changes, no API client changes, no style additions beyond reusing existing CSS classes.

---

### 2. State additions — `CreateTaskModal.tsx`

Add a single new state variable:

```ts
const [serviceError, setServiceError] = useState<string | null>(null);
```

This mirrors the existing `error` state but is scoped to the service field so it can be displayed inline next to the selector, not as a top-level modal error.

---

### 3. `handleSave` validation guard

Add after the existing `firstStageId` check and date-range check, BEFORE the merge-variable resolution block:

```ts
if (customerId && !serviceId) {
  setServiceError('Seleccioná un servicio para continuar.');
  return;
}
setServiceError(null);
```

**Rationale:**
- Only enforced when `customerId` is set (REQ-FORM-SERVICE-5): service only matters in the context of a client.
- `serviceId` is `string | null` — falsy check covers both `null` and `''` (the select resets to `null` via `setServiceId(e.target.value || null)`).
- Pattern is identical to the existing early-return for `firstStageId` — no new mental model.
- `setServiceError(null)` clears stale error on valid submit (REQ-FORM-SERVICE-2 side effect).

---

### 4. Service select rendering changes (lines 288-307)

**Current behavior:** Select is rendered only when `customerId` is set. It is already disabled when `customerServices.length === 0`. The placeholder option text changes between `'— Sin servicios —'` and `'— Sin servicio —'`.

**New behavior additions:**

1. **No-services message (REQ-FORM-SERVICE-4):** When `customerId` is set, `customerServices.length === 0`, AND the services hook is not loading — show an inline `<p>` with `"Este cliente no tiene servicios activos"`. The select stays rendered but disabled (already the case).

2. **Service error message (REQ-FORM-SERVICE-1):** When `serviceError` is non-null, render a `<p className={styles.fieldError}>` (or `styles.error` if no separate class exists) below the select.

3. **Clear error on change (REQ-FORM-SERVICE-2):** In the select `onChange`, call `setServiceError(null)` in addition to `setServiceId(...)`.

**Loading state:** `useClientServices` returns `{ data, isLoading }`. Access `isLoading` to suppress the "no services" message while loading. Current destructuring at line 99 only takes `data` — add `isLoading`:
```ts
const { data: customerServices = [], isLoading: servicesLoading } = useClientServices(customerId ?? '', !!customerId);
```
Show "no services" message only when `!servicesLoading && customerServices.length === 0 && customerId`.

---

### 5. `canSave` / submit disabled logic

The existing `canSave`:
```ts
const canSave = title.trim().length > 0 && !!firstStageId && !loading;
```

Extend to:
```ts
const canSave =
  title.trim().length > 0 &&
  !!firstStageId &&
  !loading &&
  (!customerId || !!serviceId);   // REQ-FORM-SERVICE-3
```

The added condition `(!customerId || !!serviceId)` means: if no client → passes (service not required); if client selected → serviceId must be truthy.

This disables the submit button visually AND the `handleSave` guard provides the inline error message when the user clicks anyway (in case the button is somehow not disabled — belt-and-suspenders).

---

### 6. Test strategy — new test file

**File:** `src/__tests__/scheduling/components/CreateTaskModal.service.test.tsx`

The component has complex dependencies (hooks, context). Strategy: mock all hooks at the vi.mock level, render the component in isolation, interact via @testing-library/react, and assert on DOM state.

**Mocks needed:**
- `@/hooks/useCustomers` → `useClientDetail` returns `{ data: undefined }`, `useClientServices` configurable per test
- `@/hooks/useTaskCategories` → returns `{ data: [] }`
- `@/hooks/useTaskPriorities` → returns `{ data: [] }`
- `@/context/ConfirmContext` → `useConfirm` returns `async () => true`
- `./CustomerPicker` → renders a button that calls `onChange` on click (simulated)
- CSS modules → identity proxy

**Test scenarios (4 scenarios from spec):**

| Scenario | Setup | Interaction | Assert |
|---|---|---|---|
| SCEN-FORM-1: submit without service | Client selected, services=[S1,S2], no serviceId | Click submit | Error message visible; `onCreate` NOT called |
| SCEN-FORM-2: no services state | Client selected, services=[] | Render | "Este cliente no tiene servicios activos" visible; select disabled |
| SCEN-FORM-3: service selected → submit | Client selected, services=[S1], title+project filled, serviceId=S1.id selected | Click submit | `onCreate` called with `serviceId: S1.id` |
| SCEN-FORM-4: error clears on selection | SCEN-FORM-1 state (error visible) | Select service | Error message gone |

---

### 7. BE ↔ FE coordination

The FE sends `serviceId: serviceId || null` at line ~235. After this change, `serviceId` will always be a non-null string when a client is selected (the guard in `handleSave` prevents submit otherwise). The BE receives a valid string and validates it unconditionally.

**If no client is selected:** `customerId: null`, `serviceId: null` — the FE sends both null. The BE DTO does not require `serviceId` in the... wait — actually the BE NOW requires `serviceId` unconditionally. This means the FE must either:
- Always require a client + service, OR
- The BE must allow tasks without a client (and therefore without a service)

Looking at the BE proposal: `serviceId` is required always (not just when a client is selected). The FE currently only validates service when a client is selected. **This is a known gap** — tasks created without a client cannot have a service, but the BE now requires one.

**Resolution:** The FE spec (REQ-FORM-SERVICE-5) says "service requirement validation MUST NOT trigger" when no client is selected. This means the FE will still submit `serviceId: null` when no client is selected, which the BE will reject with 400. This is a product decision — tasks without clients may need to be disallowed at the BE, or serviceId may need to remain optional when `customerId` is null. **This is an open risk to flag to the product owner.** For this change, implement exactly what the spec says: enforce service only when client is selected.
