# Change: recapture-drawer-live

## Intent

After updating a lead's status (or assignee) via the drawer, the change is saved and the list refreshes instantly — but the drawer itself keeps showing the stale value until it's closed and reopened. This change makes the drawer read from the re-fetched detail rather than the frozen prop snapshot, so the UI reflects mutations immediately without any user action.

## Scope

- `src/pages/customers/RecaptacionPage/components/LeadDetailDrawer.tsx` — derive `view = detail ?? lead` and replace every `lead.X` display reference with `view.X`. Mutation `onChange` calls keep `lead.id` (stable; drives the fetch).
- `src/__tests__/customers/LeadDetailDrawer.test.tsx` — new `describe` block with four tests (L1, L1b, L2, L3) that exercise the fix.
- `openspec/changes/recapture-drawer-live/` — this proposal, design, spec, and tasks.

No new hooks, no new files outside tests and SDD artifacts.

## Root Cause

`LeadDetailDrawer` already calls `useRecaptacionLead(lead.id)` and `useUpdateLeadStatus` already invalidates the detail query key after a mutation — so `detail` is re-fetched fresh. However, every display binding in the JSX read from the `lead` prop (a frozen snapshot held in `RecaptacionPage` state), so the fresh `detail` data was never rendered until the drawer was closed and `selectedLead` was reset.

## Approach

Single derived constant after the `if (!lead) return null;` guard:

```ts
const view = detail ?? lead;
```

All display bindings switch to `view`. The prop `lead` is kept as the render gate (the `null` check) and as the stable `id` for mutation calls. `RecaptureLeadDetailDto extends RecaptureLeadDto`, so every field used in rendering exists on both types — the substitution is fully type-safe.
