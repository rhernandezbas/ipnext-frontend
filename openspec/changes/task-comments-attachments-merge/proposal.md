# Proposal — task-comments-attachments-merge

## Why

The task detail page has two rough edges that hurt the day-to-day:

1. The comment composer asks for a free-text **Autor** every time. The user is already logged in — the author is known. The input is noise at best and a spoofing surface at worst.
2. The **Adjuntos** tab is dead UI (`ComingSoonPanel`) and the backend has no upload endpoint. Meanwhile the comments endpoint already accepts URL-based attachments. Two surfaces for the same concept, one of them empty.

## What changes

### Capability: `task-comments`

- **REMOVED**: the manual `authorName` input in the comment composer.
- **ADDED**: the composer derives `authorName` from `useAuth().user` (fallback chain `displayName → username → email`).
- **MODIFIED**: the submit button is disabled when `useAuth().user` is null or when the body is empty (no more author validation).
- **MODIFIED**: each comment item shows the author derived from the persisted `authorName` field unchanged (backend contract unchanged).

### Capability: `task-attachments-on-comments`

- **REMOVED**: the standalone "Adjuntos" tab from `TaskTabs`.
- **ADDED**: an attachment composer integrated into the comment form — URL-paste only (no file picker, no drag-and-drop), one input row at a time, with thumbnail preview for URLs that resolve to images.
- **ADDED**: inline rendering of image attachments as thumbnails on each comment item. Click a thumbnail to open a lightweight in-page lightbox (overlay + image at natural size + Esc/click-to-close). Non-image attachments stay as link chips.
- **ADDED**: `onError` fallback — broken image URLs collapse to a link chip with the filename instead of a broken `<img>`.

## Impact

- **User-facing**: composer is shorter (one less field) and the comments tab now carries everything that lived in "Adjuntos" without the dead surface. Image-heavy comments are scannable at a glance.
- **Backend**: no change. Backend keeps reading `authorName` from the body; we send the derived name. Follow-up ticket suggested to move authorship to the auth-resolved request user on the server.
- **Tests**: new specs for the composer (no author input, submit disabled until logged-in + non-empty body, attachment URL row, thumbnail preview, broken-image fallback) and for `TaskTabs` (Adjuntos tab no longer rendered).

## Out of scope

- Multipart file uploads.
- Mentions, reactions, threading.
- Rich text editor for the body.
- Moving authorship to the auth context on the backend (follow-up).
