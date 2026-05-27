# Delta Spec: RV column — Revisado por Inventario

## Requirements

### REQ-RV-1: Type field
`ScheduledTask` MUST include `reviewedByInventory: boolean`.

### REQ-RV-2: API function
`setTaskInventoryReview(taskId: string, reviewed: boolean)` MUST call `PATCH /api/scheduling/{taskId}/inventory-review` with body `{ reviewed }` and return the updated `ScheduledTask`.

### REQ-RV-3: Mutation hook
`useSetTaskInventoryReview()` MUST expose a `mutateAsync({ id, reviewed })` that:
- calls `api.setTaskInventoryReview`
- on success, invalidates `['scheduling-tasks']` and `['scheduling-task', id]` queries

### REQ-RV-4: Column definition
`ALL_TASK_COLUMNS` MUST include `{ key: 'reviewedByInventory', label: 'RV' }`.

### REQ-RV-5: Indicator rendering
When `reviewedByInventory === true`, the cell MUST render a **green** clickable dot.
When `reviewedByInventory === false`, the cell MUST render a **red** clickable dot.

### REQ-RV-6: Toggle on click
Clicking the indicator MUST call `useSetTaskInventoryReview.mutateAsync` with `{ id: task.id, reviewed: !current }`.

### REQ-RV-7: Accessibility
The indicator button MUST have:
- `aria-label="RV: revisado"` when true
- `aria-label="RV: no revisado"` when false
- `data-reviewed="true"|"false"` attribute for test targeting

## Scenarios

| Scenario | Input | Expected |
|----------|-------|----------|
| Not reviewed | `reviewedByInventory: false` | Red dot, aria-label "RV: no revisado" |
| Reviewed | `reviewedByInventory: true` | Green dot, aria-label "RV: revisado" |
| Toggle false→true | click red dot | `mutateAsync({ id, reviewed: true })` called |
| Toggle true→false | click green dot | `mutateAsync({ id, reviewed: false })` called |
