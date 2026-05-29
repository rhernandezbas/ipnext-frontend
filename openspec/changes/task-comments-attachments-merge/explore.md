# Explore — task-comments-attachments-merge

## Intent

Two related refinements to the task detail page (`SchedulingTaskDetailPage`):

1. **Drop the manual "Autor" input** from the comment composer. The author must come from the logged-in user (`useAuth().user`), not from a text field anyone can fill.
2. **Merge the empty "Adjuntos" tab into the "Comentarios" tab.** Each comment can carry optional URL-based attachments (text-only, text+images, or images-only). Inline thumbnails for image URLs, click to expand. Apply the impeccable skill to the composer and comment item layout.

## Current state (verified)

### Frontend

- `src/pages/scheduling/SchedulingTaskDetailPage/components/TaskTabs.tsx` declares 7 tabs: `Detalles, Adjuntos, Comentarios, Relacionado, Inventory, Registro de trabajo, Actividad`. The `Adjuntos` tab today only renders a `ComingSoonPanel` — confirmed dead UI.
- `src/pages/scheduling/SchedulingTaskDetailPage/components/TaskCommentsTimeline.tsx`:
  - Has a free-form `authorName` text input (required).
  - Already supports URL attachments via `attachments[]` with `url + filename` rows.
  - Renders attachments as `<a>` chips with a paperclip emoji — no thumbnails, no image detection.
- `src/api/taskComments.api.ts` posts `{ body, authorName, attachments }` to `POST /scheduling/:taskId/comments` and forwards `attachments` as `{ url, filename, mimeType?, sizeBytes? }`.
- `src/hooks/useTaskComments.ts` wraps the api with TanStack Query.
- `src/types/taskComments.ts` defines `TaskCommentAttachment` with optional `mimeType` and `sizeBytes`.
- `src/context/AuthContext.tsx` exposes `user: AuthUser | null` with `displayName, username, email`.
- `src/hooks/useAuth.ts` re-exports the context as `useAuth()`.

### Backend (read-only inspection)

`C:/Users/ronald/projects/ipnext/ipnext-backend/src/infrastructure/http/routes/taskComments.routes.ts`:

```ts
const { body: commentBody, authorName, attachments } = req.body as {
  body: string;
  authorName: string;
  attachments?: Array<{ url: string; filename: string; mimeType?: string; sizeBytes?: number }>;
};
```

- The route reads `authorName` **from the request body**, not from auth context. Confirmed.
- The route accepts URL-based attachments. **No multipart endpoint exists.**
- Backend support for `mimeType` is plumbed but not required.

## Constraints

- Strict TDD with Vitest. Tests live in `src/__tests__/...` mirroring source paths.
- CSS Modules + design tokens only. No inline styles, no Tailwind.
- Rioplatense Spanish for user-facing copy.
- No multipart upload endpoint → composer must use URL paste, not file picker / drag-and-drop.
- Backend remains unchanged in this round. Author is derived in the FE from `useAuth().user.displayName` (fallback chain: `displayName → username → email`).

## Options considered

### Option A — derive `authorName` in the FE from auth user (chosen)

- Pros: zero backend churn. Self-contained FE change. Ships today.
- Cons: backend still trusts a client-supplied author name. A bad actor could spoof it via curl, but the route is already auth-gated so this is no worse than today.
- Mitigation: log a follow-up to move authorship to the auth-resolved request user on the backend.

### Option B — change backend to ignore body `authorName` and use auth context

- Pros: source of truth on the server.
- Cons: out of scope for this change. Couples two repos. Deferred to a follow-up.

### Option C — keep "Adjuntos" tab and add a separate uploader

- Rejected. Backend has no upload endpoint. Two surfaces for the same concept (URL-based attachments) is redundant and the current tab is already a placeholder.

## Risks

- **Image URL trust**: arbitrary URLs render `<img>`. Mitigated by `onError` fallback (chip view) and `referrerpolicy="no-referrer"`. CSP is project-wide, no change here.
- **No auth user available**: if `useAuth().user` is null while the composer is mounted, the submit button stays disabled and a one-liner advises to log in (defensive — should not happen because the page is auth-gated).
- **Lightbox scope creep**: keep the "click to expand" minimal — a modal overlay with the image at natural size, escape closes. Don't pull in a heavy lightbox library.

## Files in scope

- `src/pages/scheduling/SchedulingTaskDetailPage/components/TaskCommentsTimeline.tsx` (rewrite composer + item)
- `src/pages/scheduling/SchedulingTaskDetailPage/components/TaskCommentsTimeline.module.css` (redesign)
- `src/pages/scheduling/SchedulingTaskDetailPage/components/TaskTabs.tsx` (remove Adjuntos tab)
- New: `src/__tests__/scheduling/TaskCommentsTimeline.test.tsx`
- New: `src/__tests__/scheduling/TaskTabs.test.tsx` (covers tab removal)

## Out of scope

- Backend changes (route, persistence, auth-derived author).
- File upload (multipart).
- Rich text editor for the comment body — plain textarea with `white-space: pre-wrap`.
- Mentions, reactions, threading.
