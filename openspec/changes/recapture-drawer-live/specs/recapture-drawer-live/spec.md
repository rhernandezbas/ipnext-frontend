# Spec — recapture-drawer-live (delta)

## Requirement: the drawer reflects live data, not the frozen prop snapshot

When the detail query for the open lead is invalidated and re-fetched (e.g. after a status or assignee mutation), the drawer MUST render the fresh values immediately — without closing and reopening.

### Scenario L1: detail status wins over stale prop status

- **GIVEN** the drawer is open with prop `lead.status = 'nuevo'`
- **WHEN** `useRecaptacionLead` resolves with `detail.status = 'recuperado'` (different from the prop)
- **THEN** the status `<select>` value SHALL be `'recuperado'`
- **AND** the status label shown SHALL be `'Recuperado'`

### Scenario L1b: statusPill text reflects detail for users without recapture.manage

- **GIVEN** the drawer is open with prop `lead.status = 'nuevo'`
- **AND** the actor does NOT have the `recapture.manage` permission (pill renders instead of select)
- **WHEN** `useRecaptacionLead` resolves with `detail.status = 'recuperado'`
- **THEN** the status pill SHALL display `'Recuperado'`
- **AND** `'Nuevo'` SHALL NOT be visible

### Scenario L2: loading fallback — no crash when detail is undefined

- **GIVEN** the drawer is open with prop `lead.status = 'interesado'`
- **AND** `useRecaptacionLead` returns `{ data: undefined, isLoading: false }`
- **WHEN** the drawer renders
- **THEN** the status `<select>` value SHALL be `'interesado'` (falls back to the prop)
- **AND** the drawer SHALL render without crashing

### Scenario L3: assignee select and meta-grid reflect detail assignee

- **GIVEN** the drawer is open with prop `lead.assigneeId = null`, `lead.assigneeName = null`
- **WHEN** `useRecaptacionLead` resolves with `detail.assigneeId = 'op-2'`, `detail.assigneeName = 'Operador Dos'`
- **THEN** the operator `<select>` value SHALL be `'op-2'`
- **AND** the meta-grid "Asignado" cell SHALL display `'Operador Dos'`

### Scenario L4 (implicit): existing tests — prop still drives render when detail is undefined

- **GIVEN** `useRecaptacionLead` returns `{ data: undefined }` (the default in `mockHooks()`)
- **WHEN** the drawer renders
- **THEN** all existing test assertions MUST remain true (the fallback `view = lead` is transparent to prior test coverage)
