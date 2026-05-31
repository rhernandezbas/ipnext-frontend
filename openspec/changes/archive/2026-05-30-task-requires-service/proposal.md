# Proposal: task-requires-service (Frontend)

## Intent

The backend now requires `serviceId` on task creation. The `CreateTaskModal` must enforce this at the UI layer: the submit button is disabled until a service is selected, and the "no services" state (client with zero active services) is handled gracefully with a clear message rather than an empty broken dropdown.

## Scope

### In Scope

- `src/pages/scheduling/SchedulingTasksPage/components/CreateTaskModal.tsx`:
  - Add service selection to the validation block in `handleSave` (mirror title/project validation pattern).
  - Disable the submit button when no service is selected.
  - Show a clear error message when user attempts to submit without a service.
  - Detect "client with zero services" state (when `customerId` is set but `useClientServices` returns an empty array) and show an informational message + disable service selector.
- `src/__tests__/scheduling/components/CreateTaskModal.service.test.tsx` — new test file (TDD): covers submit-blocked, no-services state, valid-selection-enables-submit.

### Out of Scope

- Fetching or creating services from within the modal.
- Changing the `useClientServices` hook.
- Any other form fields or validation.
- Styling beyond the existing error/disabled patterns already in the modal.

## Approach

1. **Validation in `handleSave`**: add guard — if `!serviceId`, set a `serviceError` state string and return early (same pattern as `titleError`).
2. **Submit button disabled logic**: extend the existing disabled condition to include `!serviceId` when a client is selected (service selection only makes sense when a client is chosen).
3. **No-services state**: after `useClientServices(customerId)` resolves with an empty array AND `customerId` is set, render an inline message (e.g. "Este cliente no tiene servicios activos") and disable the `<select>` — user cannot proceed without picking a different client.
4. **Tests (TDD, Vitest)**: red → green → refactor.
   - Test: submit without service → button disabled / error shown.
   - Test: client with no services → informational message visible, select disabled.
   - Test: service selected → submit enabled.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/pages/scheduling/SchedulingTasksPage/components/CreateTaskModal.tsx` | Modified | Validation + no-services state |
| `src/__tests__/scheduling/components/CreateTaskModal.service.test.tsx` | New | TDD scenarios for service requirement |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Existing `CreateTaskModal` tests break — they don't include `serviceId` in submit fixture | High | Update existing test mocks to include a service selection |
| `useClientServices` returns undefined briefly (loading state) — submit wrongly disabled | Medium | Only apply "no services" message when loading is complete and array is empty |
| Edge case: no client selected — service field is irrelevant | Low | Validation only triggers when `customerId` is set; if no client, service selector remains optional-looking until client is chosen |

## Rollback Plan

Single-PR change. Rollback = `git revert`. No API changes. If rolled back, the frontend allows submit without `serviceId`, which the backend will reject with 400 — users see an API error toast instead of a form error.

## Success Criteria

- [ ] Submit button is disabled when client is selected but no service is chosen
- [ ] Inline error appears when user clicks submit without a service
- [ ] "No services" message shows when selected client has zero active services
- [ ] Service dropdown is disabled in the "no services" state
- [ ] Valid service selection enables the submit button
- [ ] Vitest green; TypeScript clean
