# Delta Spec: task-requires-service — task-create-form capability

**Capability**: `task-create-form`
**Type**: MODIFIED (delta over existing CreateTaskModal behavior)
**Change**: `task-requires-service`
**Component**: `CreateTaskModal.tsx`

---

## Context

This delta modifies the `CreateTaskModal` form validation. `serviceId` was previously optional. The backend now rejects creates without it (`400 VALIDATION_ERROR`). The UI must enforce the rule at form level so users never see an API error for this specific field.

The component uses manual state-based validation in `handleSave` (NO react-hook-form). Validation mirrors the existing `titleError` / `projectError` pattern. The service `<select>` is rendered at lines 288-307 and populated by `useClientServices(customerId)` (line 99).

---

## MODIFIED Requirements

### REQ-FORM-SERVICE-1: Submit is blocked when no service is selected

**Given** the CreateTaskModal is open  
**And** the user has selected a client (`customerId` is set)  
**And** no service has been selected (`serviceId` is empty or undefined)  
**When** the user clicks the submit button  
**Then** the form MUST NOT call the create mutation  
**And** a service error message MUST become visible  
**And** the error message MUST clearly indicate that a service is required

### REQ-FORM-SERVICE-2: Error message is cleared on service selection

**Given** a service error message is visible  
**When** the user selects a service from the dropdown  
**Then** the error message MUST disappear  
**And** the service field MUST reflect the selected value

### REQ-FORM-SERVICE-3: Submit button reflects validation state

**Given** the CreateTaskModal is open with a client selected  
**When** no service is selected  
**Then** the submit button MUST be visually disabled (disabled attribute OR aria-disabled)  
**Or** the submit handler MUST early-return with an error message (either approach is acceptable)

*Note: The implementation MAY choose either a disabled button or an early-return error pattern — both satisfy this requirement. Consistency with existing title/project validation is preferred.*

### REQ-FORM-SERVICE-4: Client without services — informational state

**Given** the CreateTaskModal is open  
**And** the user has selected a client (`customerId` is set)  
**And** `useClientServices(customerId)` resolves with an empty array  
**And** the loading state has completed  
**When** the service selection section is rendered  
**Then** an informational message MUST be visible (e.g. "Este cliente no tiene servicios activos")  
**And** the service `<select>` element MUST be disabled  
**And** the submit button MUST remain blocked (no service can be selected)

### REQ-FORM-SERVICE-5: No client selected — service field is not enforced

**Given** the CreateTaskModal is open  
**And** no client has been selected (`customerId` is empty or undefined)  
**When** the user interacts with the form  
**Then** the service requirement validation MUST NOT trigger  
**And** the "no services" message MUST NOT appear

*Note: Service selection only has meaning in the context of a client. If no client is selected, the service field remains inert.*

### REQ-FORM-SERVICE-6: Valid service selection enables submit

**Given** the CreateTaskModal is open  
**And** the user has selected a client with at least one service  
**And** the user selects a service from the dropdown  
**And** all other required fields (title, project) are filled  
**When** the user clicks the submit button  
**Then** the create mutation MUST be called with the selected `serviceId`  
**And** NO service error message MUST be visible

---

## Test Scenarios

### SCEN-FORM-1: Submit without service shows error

Given client C is selected with services [S1, S2]  
And no service is selected  
When the submit button is clicked  
Then the service error message is visible  
And the mutation is NOT called

### SCEN-FORM-2: No services for selected client

Given client C is selected  
And `useClientServices(C)` returns `[]`  
When the modal renders  
Then "Este cliente no tiene servicios activos" is visible  
And the service `<select>` is disabled

### SCEN-FORM-3: Service selected — submit succeeds

Given client C is selected with services [S1]  
And title and project are filled  
And service S1 is selected  
When the submit button is clicked  
Then the mutation is called with `serviceId: S1.id`  
And no error messages are visible

### SCEN-FORM-4: Error clears after selection

Given submit was clicked without a service and the error is visible  
When the user selects service S1  
Then the service error message disappears

---

## Non-Goals (explicitly excluded from this delta)

- Validation behavior when no client is selected (service is ignored).
- Changes to `useClientServices` hook.
- Any styling beyond the existing error/disabled CSS classes already in the modal.
- Backend error handling for `VALIDATION_ERROR` — that toast path already exists and is a fallback, not the primary UX.
