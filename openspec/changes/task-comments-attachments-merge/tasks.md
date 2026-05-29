# Tasks — task-comments-attachments-merge

Strict TDD: for every behavior task, write the failing test first, then make it pass.

## 1. Tests (red phase) — set up failing specs

- [ ] 1.1 Create `src/__tests__/scheduling/TaskTabs.test.tsx`
  - Mock `@/hooks/useTaskComments` (return `idleMutation` shape + empty `data`).
  - Mock `@/hooks/useAuth` (return `{ user: { displayName: 'Ana', username: 'ana', email: 'a@b.c' } }`).
  - Assert tab labels === `['Detalles','Comentarios','Relacionado','Inventory','Registro de trabajo','Actividad']`.
  - Assert no element with text `'Adjuntos'` in the tab list.

- [ ] 1.2 Create `src/__tests__/scheduling/TaskCommentsTimeline.test.tsx`
  - Mock `useTaskComments`, `useAddTaskComment`, `useDeleteTaskComment` from `@/hooks/useTaskComments`.
  - Mock `@/hooks/useAuth` per scenario.
  - Scenarios from design.md "Test strategy" — author input absent, gating, author fallback chain, attachment row, filename auto-derive, image thumbnail, non-image chip, onError fallback, lightbox open + Escape close, delete still works, null-user fallback message.

## 2. Implementation (green phase)

- [ ] 2.1 Refactor `TaskCommentsTimeline.tsx`:
  - Remove `authorName` state and the corresponding input.
  - Import `useAuth` from `@/hooks/useAuth`; add `resolveAuthorName` helper.
  - Update submit gating to `body.trim() || hasAttachments` AND `authorName !== null` AND `!isPending`.
  - Compose `authorName` into the api call.
  - Render `"Iniciá sesión para comentar"` when `authorName === null`.
  - Split body into internal `Composer`, `CommentItem`, `AttachmentThumb`, `Lightbox` functions.
  - Add `isImageUrl` extension regex.
  - Add `AttachmentThumb` with `onError` fallback to chip.
  - Add `Lightbox` via `createPortal`, Esc + backdrop + close button.
  - Add `justAddedIds` set + fade-in class for new comments.

- [ ] 2.2 Update `TaskCommentsTimeline.module.css`:
  - Remove obsolete `attachmentRowLabel`, `attachmentInputRow` heavy grid styles where unused.
  - Add classes for `composer`, `composerActions`, `attachToggle`, `pendingRow`, `pendingChip`, `commentAvatar`, `commentItem`, `commentItem.justAdded`, `thumbsRow`, `thumb`, `lightboxOverlay`, `lightboxImage`, `lightboxClose`, `loginPrompt`.
  - Use only tokens (`var(--*)`).
  - Add `@media (prefers-reduced-motion: reduce)` to disable the fade.

- [ ] 2.3 Update `TaskTabs.tsx`:
  - Drop the `adjuntos` entry from `TAB_IDS` and `tabs` array.

## 3. Verification (refactor + run)

- [ ] 3.1 Run the two new test files in isolation, confirm green.
- [ ] 3.2 Run the full vitest suite to ensure no regression in neighboring tests.
- [ ] 3.3 Run `npm run typecheck` to confirm no TS errors.

## 4. Commits

- [ ] 4.1 `test(scheduling): add specs for comments timeline + tabs without Adjuntos` (failing baseline)
- [ ] 4.2 `feat(scheduling)!: derive comment author from auth; merge adjuntos into comments`
- [ ] 4.3 `docs(scheduling): SDD artifacts for task-comments-attachments-merge`

## Out of scope (do not touch)

- Backend route `taskComments.routes.ts`.
- `useTaskComments.ts` hook (signature unchanged).
- `taskComments.api.ts` (payload shape unchanged).
- Other tabs in `TaskTabs.tsx`.
