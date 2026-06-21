# Tasks: recapture-drawer-live

Strict TDD: write/extend the failing test first (RED), then implement (GREEN), then refactor. Run `npx vitest run` per phase; `npm run typecheck` at the end.

## Phase 1 — Red: failing tests

- [x] 1.1 (RED) Add `describe('LeadDetailDrawer — live detail wins over prop snapshot (#recapture-drawer-live)')` block in `src/__tests__/customers/LeadDetailDrawer.test.tsx` with:
  - `L1` — status select value is the DETAIL's status, not the prop's (prop='nuevo', detail='recuperado' → expect 'recuperado')
  - `L1b` — statusPill text shows the DETAIL's label for actors without recapture.manage
  - `L2` — falls back to prop when detail is undefined (no crash, prop status shown)
  - `L3` — operator select value and meta-grid "Asignado" show the DETAIL's assignee
- [x] 1.2 Run `npx vitest run src/__tests__/customers/LeadDetailDrawer.test.tsx` → confirmed RED: L1 expected 'recuperado' received 'nuevo'; L1b unable to find 'Recuperado'; L3 expected 'op-2' received ''

## Phase 2 — Green: implement the fix

- [x] 2.1 In `LeadDetailDrawer.tsx`, after `if (!lead) return null;`, derive: `const view = detail ?? lead;`
- [x] 2.2 Replace `lead.X` with `view.X` for all display bindings:
  - `assigneeInPool` / `showPhantom` derivation: `view.assigneeId`
  - `aria-label`: `view.contactName`
  - Header: `view.contactName`, `view.email`, `view.phone`
  - Meta grid: `view.phone`, `view.email`, `view.source`, `view.createdAt`, `view.claimedAt`, `view.assigneeName`, `view.clientId`
  - Status pill: `RECAPTURE_STATUS_COLOR[view.status]`, `RECAPTURE_STATUS_LABELS[view.status]`
  - Status select: `value={view.status}`
  - Operator select: `value={view.assigneeId ?? ''}`, phantom option `value={view.assigneeId!}`, phantom name `view.assigneeName`
  - ContractHistoryModal condition + props: `view.clientId`, `view.contactName`
  - Keep `lead.id` for: `useRecaptacionLead(lead?.id ...)`, `RegisterContactForm leadId={lead.id}`, mutation calls (`lead.id`)

## Phase 3 — Verify

- [x] 3.1 Run `npx vitest run src/__tests__/customers/LeadDetailDrawer.test.tsx` → 29 passed (29)
- [x] 3.2 Run `npx vitest run` (full suite) → all pass
- [x] 3.3 Run `npm run typecheck` → clean (exit 0)
