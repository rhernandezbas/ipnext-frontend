<!-- generated from engram topic_key: sdd/task-inline-priority-edit/proposal -->
Intent: Allow users to change a task's priority inline (badge -> dropdown on click) in both the tasks table and the task detail header, with identical UX to the existing stage selector.

Scope:
- New molecule `src/components/molecules/PrioritySelect/PrioritySelect.tsx` (+ `.module.css`) mirroring StageSelect.
- TasksTableView: replace `PriorityPill` in column render with `<PrioritySelect>`; pass new `priorities` and `onPriorityChange` (via `useUpdateTask`).
- TaskHeader: replace native `<select>` with `<PrioritySelect>` using existing `onPriorityChange` prop. Drop `prioritySelect` style (or keep CSS unused for now and remove).
- No backend changes — `useUpdateTask({ data: { priority } })` already supports it.

Out of scope: backend DTO changes, kanban view, priority creation flow, optimistic updates beyond what `useUpdateTask` does.

Risks:
- A11y: ensure aria-label/aria-haspopup/listbox mirror StageSelect.
- Empty catalog: like StageSelect's empty-stages fallback, render read-only PriorityBadge to avoid breaking when catalog hasn't loaded.

Approach: Strict TDD — tests first for PrioritySelect mirroring StageSelect tests, then component, then integration in TasksTableView + TaskHeader.
