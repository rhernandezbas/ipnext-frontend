# Archive Report — combo-balance-honesto (FRONTEND)

**Archived**: 2026-08-11 · **Deploy**: `82aa05b4` (prod, green) · **Verify**: PASS WITH WARNINGS →
warnings resolved before this archive (see below)

---

## The problem

The customer balance UI was actively lying to the operator:

- `balanceDue: null` (client without `grClienteId`, or never synced with Gestión Real) rendered as
  **"Sin deuda ✓"** — a green checkmark asserting "does not owe" when the real answer was "we don't
  know". `formatBalance` in `CustomerDetailPage.tsx` returned `'$ 0,00'` for `null`/`undefined`.
- The sub-header painted **every** balance state — debt included — with the same hardcoded green
  (`#16a34a`, 3.30:1 contrast on white: WCAG AA **FAIL**). A debtor and a client in credit rendered
  visually identical (`-$ 5.000` either way), and a real debt shared the same green as "all good".
- Credit (`balanceDue < 0`, saldo a favor) had no distinct visual state anywhere — it fell through
  the same branches as debt or "no debt" depending on the component.
- The WhatsApp inbox's client-context panel could crash outright: `useWhatsapp.ts` read
  `?.client?.balance.stale` without a full optional chain, and even after that hop was fixed,
  `FinancialSection` and `TemplateSendPanel` read `balance.due` downstream with no guard — same
  fixture, same throw, just one hop later (a CRITICAL caught only in the fix-wave, not the original
  apply).
- `formatRelativeTime` on an invalid `lastBalanceAt` printed the literal string `"hace NaN d"`.

**Root cause traced to the type contract**: `src/types/customer.ts` declared `balanceOverdue` and
`invoicesQty`, fields that do not exist in the backend entity (`domain/entities/customer.ts`) or its
mapper (`toCustomer()`). TypeScript was blessing unreachable UI branches built on data that would
never arrive.

## What shipped

- `Customer` type now matches the real `GET /api/clients/:id` contract: `balanceStale?: boolean`
  added, `balanceOverdue`/`invoicesQty` removed (a `@ts-expect-error` pins their absence so a
  re-add breaks the typecheck).
- `BalanceCard` (`InfoTab`) and the `CustomerDetailPage` sub-header both render **4 mutually
  exclusive states** driven by a shared `balanceState()` helper: no-data ("Saldo no disponible"),
  zero-measured ("Sin deuda"), debt ("Deudor" badge, red), credit ("Saldo a favor", distinct label
  and color). Every state carries text/icon, never color alone (WCAG AA, calculated ≥4.5:1 against
  real tokens).
- Sub-header color is now per-state via the same design tokens as the card
  (`--badge-late-fg` / `--badge-paid-fg` / `--color-text-secondary`), replacing the single hardcoded
  green.
- A `balanceStale` chip ("⚠ Desactualizado") appears in both the card and the sub-header when the
  data is stale AND a balance is known — gated off entirely when `balanceDue == null` (no
  contradicting "no data" + "outdated" pair).
- `formatRelativeTime` guards with `Number.isFinite` and returns `null` on an invalid date instead
  of emitting `NaN`.
- `FinanceGrowthOverviewPage` panel: the finance-sync status type grew a `reconcile` block
  (`lastRunAt`, `lastResult`, `itemsSynced`, `sweepInProgress`, `windowFrom`, `windowTo`,
  `pageOffset`) matching the backend's third ingest lane. The sync button now treats
  `reconcile.sweepInProgress` as "running" (previously only `delta.pendingPages` counted, so a
  reconcile sweep left the button clickable). A dedicated error state surfaces
  `reconcile.lastResult` verbatim when it starts with `error:` (case-insensitive prefix, not
  substring), shown **alongside** — not instead of — the "Ritmo degradado" warning, since the two
  are orthogonal signals.
- Inbox robustness: `useWhatsapp.ts` optional-chains the full `client?.balance?.stale` hop, and its
  downstream consumers (`FinancialSection`, `TemplateSendPanel`) tolerate a `client` payload with no
  `balance` property at all without throwing.

## The loop

Two independent adversarial reviewers ran blind against the same implementation → **15 fixes**
(fix wave FX1–FX15) → re-review → a small follow-up mini-wave → **CLEAN**. `sdd-verify` then ran a
full pass: **50/50 real spec scenarios COMPLIANT**, typecheck clean, 208/208 targeted matrix tests
green, full suite matching the documented baseline (1 pre-existing unrelated red in
`WhatsappReportsPage.test.tsx`, confirmed ancestor of the base commit — not a regression).

Verify surfaced one **CRITICAL** (documentation-integrity, not functional): `tasks.md` claimed 7
fix-wave behaviors were already covered by spec scenarios (CARD-3 sub-case, CARD-5, HEADER-1
sub-case, HEADER-2 sub-case, HEADER-4, HEADER-5, INBOX-1 sub-case), but
`customer-balance-display/spec.md` still measured 31 scenarios — the 7 behaviors were implemented
and tested, just never written into the spec text. Two **WARNING**s: `design.md` §10 "No se toca"
falsely listed `FinancialSection.tsx`/`TemplateSendPanel.tsx` as untouched (FX1 touched both), and
the apply-progress engram artifact only preserved the final mini-wave's narrative, not a full
per-task TDD table.

All three were closed **before this archive**, on top of the verified commit:
- `6606804b` — specs amended with the 7 fix-wave scenarios (`customer-balance-display` went from
  31 → 45; `finance-sync-lane-visibility` was already accurate at 19, confirmed unchanged) +
  `design.md` §10 corrected to acknowledge `FinancialSection.tsx`/`TemplateSendPanel.tsx` were
  touched.
- `82aa05b4` — verify-report itself committed, documenting PASS with the now-resolved warnings.
- This archive step additionally flipped `tasks.md` G.7 (Playwright smoke) from pending to done,
  since the live smoke ran after that commit (see below) — the only task that required a deployed
  environment to execute.

## Live smoke (2026-08-11, deploy `82aa05b4`, prod)

- Debtor client `109143`: balance rendered **red** in both the sub-header and the `BalanceCard`,
  with "Actualizado hace 39 min" — consistent state top-to-bottom, no green-for-debt regression.
- Demo account with no Gestión Real link: rendered `—` / "Saldo no disponible" with the real reason
  in the accessible text, not a false "Sin deuda".
- `/admin/finance-growth` sync panel: showed "Sincronización al día", correctly consuming the new
  `reconcile` block (button state and error/degraded badges reflect the three-lane backend
  reality).

## Key findings worth remembering

- **The CRITICAL that took two rounds to catch was hook-vs-consumers, not the hook itself.**
  `useWhatsapp.ts`'s own optional chain was fixed early and had a passing test — but the *same*
  partial-payload fixture crashed one hop downstream in components that read `balance.due` off the
  hook's output without their own guard. "The function that's tested isn't always the function that
  decides" applies here at the consumer boundary, not just within one function.
- **A previously-fixed color bug got reintroduced during the fix wave itself**: `#16a34a` (green,
  3.30:1 on white — WCAG AA FAIL) came back in an intermediate revision before the final token-based
  fix landed. Contrast regressions are cheap to reintroduce when a hex literal is copy-pasted instead
  of referencing the token.
- **Debt and credit rendering identically was the sharpest instance of the "no perceptible-state
  distinction" bug class in this change**: both were `-$ 5.000` with the same green, only the sign
  differed — and the sign alone is not a reliable channel for an operator scanning a list.

---

## Traceability

- **Verified commit**: `82aa05b4` (worktree `.claude/worktrees/combo-balance-fe`,
  branch `feat/combo-balance-honesto`, code HEAD `9da368ab`)
- **Post-verify amendment commit**: `6606804b`
- **Deployed to prod**: `82aa05b4` — confirmed via live smoke above
- **Archived from**: `origin/main` at `82aa05b4`, via worktree
  `.claude/worktrees/archive-combo-fe` (branch `chore/archive-combo-fe`)
- **Specs synced to canonical** (`openspec/specs/`, both created new — no prior canonical existed):
  - `customer-balance-display` — 45 scenarios (14 requirements: TYPE-1, CARD-1..5, HEADER-1..5,
    INBOX-1, NOREG-1, A11Y-1)
  - `finance-sync-lane-visibility` — 19 scenarios (5 requirements: TYPE-1, RUN-1, ERR-1, ERR-2,
    A11Y-1)
- **tasks.md**: 84/84 complete (G.7 flipped to done in this archive step, live-smoke evidence
  attached in place)
