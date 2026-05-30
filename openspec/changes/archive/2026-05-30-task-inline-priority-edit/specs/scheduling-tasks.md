<!-- generated from engram topic_key: sdd/task-inline-priority-edit/spec -->
# PrioritySelect spec (delta)

## Requirements

### REQ-1: Inline priority edit in TasksTableView
- The "Prioridad" column renders a `<PrioritySelect>` (color-coded pill trigger) instead of the read-only `PriorityPill`.
- Scenario: user clicks priority pill on a row -> dropdown lists every priority in catalog with color swatch + name; clicking a different option triggers `updateTask({ id, data: { priority: name } })`; clicking the current priority is a no-op.

### REQ-2: Inline priority edit in TaskHeader (detail page)
- The header `prioritySelect` native control is replaced by a `<PrioritySelect>` with the same visual pattern.
- Scenario: user clicks the priority pill in the detail header -> dropdown -> selecting an option calls `onPriorityChange(name)`; disabled while `isSaving`.

### REQ-3: PrioritySelect molecule
- Trigger: rounded pill button tinted with the current priority's `color`, showing the priority name and a caret. `aria-label="Cambiar prioridad"`.
- Menu: portal-rendered listbox positioned via fixed coords; each option shows a color swatch + name; `role="option"` with `aria-selected` for the current.
- Closes on outside click, scroll (ignoring inner scroll), resize.
- Disabled prop hides the menu.
- Empty/missing catalog -> falls back to read-only badge with the current priority name (no dropdown).
- No-op when picking the current priority.

### REQ-4: Visual parity with StageSelect
- Uses same pill/menu CSS shape and tokens. Same caret glyph (`▾`). Same max-width and overflow handling.
