<!-- generated from engram topic_key: sdd/task-inline-priority-edit/design -->
# Design

## Component API
```ts
interface PrioritySelectProps {
  /** Current priority name (free text, may not be in catalog). */
  value: string;
  /** Catalog of available priorities. Empty -> read-only badge fallback. */
  priorities: TaskPriority[];
  /** Called when the user picks a different priority name. */
  onChange: (priorityName: string) => Promise<unknown> | void;
  /** Externally disables the control. */
  disabled?: boolean;
}
```

Rationale: `value` + `onChange` (vs StageSelect's `task` + `onMove`) because priority is not modeled as a workflow stage, and the column already has the string. Keeps the molecule re-usable beyond ScheduledTask.

## File layout
- `src/components/molecules/PrioritySelect/PrioritySelect.tsx`
- `src/components/molecules/PrioritySelect/PrioritySelect.module.css`
- Tests: `src/__tests__/components/molecules/PrioritySelect.test.tsx`

## Color resolution
- Find catalog entry by `name === value`. `bg = entry?.color ?? '#9ca3af'` (neutral grey when unknown).
- Same swatch convention in the menu options.

## Integration: TasksTableView
- Add hook `useUpdateTask()` to `TasksTableView`.
- Add `handlePriorityChange(id, name) -> updateTask.mutateAsync({ id, data: { priority: name } })`.
- Replace the column `render` for `priority`:
  ```tsx
  render: (t) => (
    <PrioritySelect
      value={t.priority}
      priorities={priorities}
      onChange={name => handlePriorityChange(t.id, name)}
    />
  )
  ```
- Keep `PriorityPill` export for any other consumers (kanban tile? — leave alone for now).

## Integration: TaskHeader
- Replace the `<select className={styles.prioritySelect}>` block with:
  ```tsx
  <PrioritySelect
    value={task.priority}
    priorities={priorities}
    onChange={onPriorityChange}
    disabled={isSaving}
  />
  ```
- Leave `handlePriorityChange` (the local select handler) removed; signature `onPriorityChange: (priority: string) => Promise<void>` is unchanged.
- Keep `.prioritySelect` CSS class or remove it — remove to avoid dead code.

## Testing strategy (TDD)
1. Mirror StageSelect.test.tsx for PrioritySelect (trigger label, lists options, calls onChange, no-op on current, empty fallback, disabled).
2. Add a smoke test in TasksTableView (or its existing test file) — defer if a TasksTableView test does not yet exist (verify first).
3. Update TaskHeader test if it asserts on native select usage.
