# Design — task-comments-attachments-merge

## Goals

1. Composer that feels like a chat input: textarea on top, a tidy "Adjuntar URL" affordance below, preview row of pending attachments, primary action on the right.
2. Comment item that reads top-to-bottom as `avatar + name + time → body → attachments row` with clear hierarchy.
3. Subtle motion (fade-in) on freshly posted comments. Nothing showy.
4. No new dependencies. Plain React + CSS Modules + existing tokens.

## Architectural decisions

### AD-1 — Single-file refactor of `TaskCommentsTimeline.tsx`

The composer and item live in the same file but are split into small internal components: `<Composer>`, `<CommentItem>`, `<AttachmentThumb>`, `<Lightbox>`. This keeps the public surface (`<TaskCommentsTimeline taskId={...} />`) stable and avoids dragging new files into the page directory.

Rationale: the entire feature is ~250 LOC of view code. Splitting into separate files would scatter the concept across the folder. The reference catalog pages follow the same single-file pattern with internal sub-components.

### AD-2 — Author derivation in the FE via a small helper

A pure helper `resolveAuthorName(user: AuthUser | null): string | null` that returns the first non-empty of `displayName, username, email`, or `null`. Lives at the top of the component file (no separate util module — it's used in exactly one place).

Rationale: trivial logic, exhaustively tested via the composer's behavior. Promoting it to `@/utils` would add ceremony without payoff.

### AD-3 — Image detection by URL extension allowlist

```ts
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif)(\?.*)?$/i;
function isImageUrl(url: string): boolean { return IMAGE_EXT.test(url); }
```

Rationale: cheap, predictable, no MIME sniffing required. Edge cases (extension-less URLs, query-string suffixes) handled by the regex. If detection misses, the chip rendering is still correct, just not visually rich.

### AD-4 — Lightbox via React `createPortal`, no library

A `<Lightbox>` internal component mounts via `createPortal(node, document.body)`, listens for Escape on `keydown`, and renders an overlay + image. Focus is moved to the close button on open and returned to the opener on close (saving the `HTMLElement | null` in a ref).

Rationale: the project convention already says portals for modals (DESIGN.md). One screen, no zoom/pan/swipe. Pulling in a library is overkill.

### AD-5 — Author wiring sends the resolved name (Option A)

The api call still receives `authorName` in the body. The change is purely client-side: the value comes from auth instead of an input. The backend route is untouched in this change.

Rationale: keeps the change focused on FE concerns. A follow-up issue will move authorship to the auth-resolved request user on the backend so the body field becomes ignored, then eventually removed.

### AD-6 — Optimistic UX: fade-in on new comments

The list animates new comments with a 150 ms `opacity 0 → 1` transition via a CSS keyframe applied on first render of each item (tracked by `comment.id` membership in a `Set<string>` ref). No layout shifts. No spring physics. Reduced-motion users get instant rendering via `@media (prefers-reduced-motion: reduce)`.

## Composer layout

```
┌─ Composer ──────────────────────────────────────────────────┐
│  ┌─ Textarea ──────────────────────────────────────────┐    │
│  │  Escribí un comentario…                              │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─ Pending attachments row (if any) ──────────────────┐    │
│  │ [thumb] cable.jpg ×   [thumb] photo.png ×            │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─ URL input row (visible when "Adjuntar" expanded) ──┐    │
│  │  [https://…] [nombre.ext (auto)]   [Agregar]         │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  [📎 Adjuntar URL]                          [Comentar →]    │
└──────────────────────────────────────────────────────────────┘
```

- **Textarea**: `min-height: 72px`, autosizes by `resize: vertical` (preserved from today).
- **Adjuntar URL toggle**: collapsed by default. Clicking it expands the URL row inline.
- **Pending attachments row**: only renders when ≥ 1 attachment is in the draft. Each chip shows a 40×40 thumbnail (or a generic file icon for non-images) + filename + remove ×.
- **Comentar button**: filled, primary color. Disabled per spec gating.
- **Auth-empty fallback**: when `user` is null, the button area renders `"Iniciá sesión para comentar"` in muted text instead of the button.

## Comment item layout

```
┌─ CommentItem ──────────────────────────────────────────────┐
│  ⬤  Ana Pérez · hace 5 min                          [×]   │
│                                                            │
│  Llegó el equipo, dejo las fotos del cableado.             │
│                                                            │
│  ┌────────┐ ┌────────┐ ┌────────┐ [📎 manual.pdf]          │
│  │ thumb  │ │ thumb  │ │ thumb  │                          │
│  └────────┘ └────────┘ └────────┘                          │
└────────────────────────────────────────────────────────────┘
```

- **Avatar**: 28×28 circle with the initials of the resolved author name on a tinted background (deterministic hash of `authorName` → hue). No external avatar fetching.
- **Header**: name + relative time ("hace 5 min", "hace 2 h", "ayer", absolute date if > 7 days). Hover reveals delete button.
- **Body**: `white-space: pre-wrap; word-break: break-word`. Plain text. Links not auto-linkified in this round.
- **Attachments row**: image thumbnails first (88×88, rounded), file chips after. Click thumbnail → lightbox. Click chip → opens link in new tab.

## CSS strategy

- Stick to existing tokens from `src/tokens/variables.css` (`--color-*`, `--space-*`, `--radius-*`, `--font-size-*`).
- New class names are scoped to `TaskCommentsTimeline.module.css` — no global selectors.
- Avatar background uses `oklch(...)` only inside a dedicated section (DESIGN.md guidance) and is computed inline-via-style as a justified dynamic override (one CSS variable set on the element).
- Lightbox z-index uses `var(--z-modal)` if available, else `1000` (we verify the token exists before referencing).

## State flow

```
useAuth() ─► user ─► resolveAuthorName() ─► authorName | null
                                                    │
useState:                                           ▼
  body, attachments[], expandedUrlRow, lightboxOpen, lightboxUrl, justAddedIds
                                                    │
form submit ─► useAddTaskComment.mutateAsync({ taskId, body, authorName, attachments })
                                                    │
                       on success ─► clear body + attachments
                                  └► track new comment id in justAddedIds for fade-in
```

## Test strategy

Two new test files. Vitest + Testing Library. Hooks mocked at `vi.mock('@/hooks/useTaskComments')` and `vi.mock('@/hooks/useAuth')`.

### `src/__tests__/scheduling/TaskCommentsTimeline.test.tsx`

- composer does NOT render any author input
- submit is disabled when body is empty and no attachments
- submit is enabled with body, calls mutateAsync with derived authorName from user.displayName
- displayName fallback to username when displayName empty
- displayName fallback to email when username also empty
- when user is null, submit area shows "Iniciá sesión para comentar"
- attachment URL row appears after clicking "Adjuntar URL"
- attachment with empty URL is dropped before submit
- filename auto-derives from URL pathname when blank
- image URL renders as `<img>` thumbnail (testing-library queries by role `img` and `src`)
- non-image URL renders as link chip
- onError on the thumbnail flips to a link chip
- clicking a thumbnail opens the lightbox dialog; Escape closes it
- existing delete-comment behavior still works

### `src/__tests__/scheduling/TaskTabs.test.tsx`

- the tab list contains exactly: `Detalles, Comentarios, Relacionado, Inventory, Registro de trabajo, Actividad`
- the tab list does NOT include `Adjuntos`
- selecting Comentarios mounts the timeline

## Open question

None — proposal Option A is the only path that keeps backend untouched.
