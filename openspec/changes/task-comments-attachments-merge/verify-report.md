# Verify report — task-comments-attachments-merge

## Status: PASS

## Coverage matrix (spec → test)

### task-comments

| Requirement | Scenario | Test (file: name) | Result |
|---|---|---|---|
| author derived from user | displayName | TaskCommentsTimeline.test.tsx: "submit calls mutateAsync with authorName derived from user.displayName" | PASS |
| fallback chain | username | "falls back to username when displayName is empty" | PASS |
| fallback chain | email | "falls back to email when displayName and username are empty" | PASS |
| null user | login prompt | "when user is null shows login prompt and does NOT render submit button" | PASS |
| no author input | absent | "does NOT render an Autor input field" | PASS |
| submit gating | empty / both empty | "submit button is disabled when body is empty and no attachments" | PASS |
| submit gating | body OR attachment | "body-only is allowed and body OR attachment enables submit" / "attachment-only (no body) is allowed" | PASS |

### task-attachments-on-comments

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Adjuntos tab removed | tabs list | TaskTabs.test.tsx: "renders exactly 6 tabs ... (no Adjuntos)" + "does not render an Adjuntos tab" | PASS |
| URL row reveal | toggle | TaskCommentsTimeline.test.tsx: "clicking \"Adjuntar URL\" reveals the URL row" | PASS |
| filename auto-derive | from URL | "submitting with one attachment sends it in the payload" (sends filename = cable-roto.jpg) | PASS |
| image URL → thumb | jpg uppercase | "image URL attachment renders as <img> thumbnail" | PASS |
| query-suffix URL | webp?v=2 | "image URL with query suffix is detected as image" | PASS |
| non-image → chip | pdf | "non-image URL attachment renders as a link chip, not an <img>" | PASS |
| onError fallback | broken image | "broken image (onError) falls back to a link chip" | PASS |
| lightbox dialog | open + Escape close | "clicking image thumbnail opens lightbox dialog; Escape closes it" | PASS |

## Suite-wide results

- `npx vitest run` — 154 files, 1243 tests passing, 1 todo, 0 failing.
- `npx tsc --noEmit` — pre-existing errors in unrelated files (StatsTab, NotasCreditoPage, InventoryLegacyPage, SettingsPage, TariffsPage, RadiusSessionsPage, CustomerSidebar — none in files this change touches).

## Findings

- **SUGGESTION**: The backend route `POST /scheduling/:taskId/comments` still reads `authorName` from the request body. With this FE change, that field is now always derived from auth. A follow-up issue should move authorship to the auth-resolved request user on the server and remove the field from the payload contract.
- **SUGGESTION**: Image uploads remain blocked by the absence of a multipart endpoint. If product wants drag-and-drop or paste-image-from-clipboard, a backend uploader (or S3 presigned-URL flow) is required.
- **NOTE**: A pre-existing test file `src/__tests__/scheduling/components/TaskCommentsTimeline.test.tsx` covered the deprecated "Autor" input behavior and was removed as superseded; coverage is now consolidated in `src/__tests__/scheduling/TaskCommentsTimeline.test.tsx`.

## Verdict

Implementation matches spec. Ready to archive.
