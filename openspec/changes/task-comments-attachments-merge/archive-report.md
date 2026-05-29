# Archive report — task-comments-attachments-merge

## Status: COMPLETED

## Phases

- explore — done (engram + openspec/explore.md)
- proposal — done (engram + openspec/proposal.md)
- spec — done (engram + openspec/specs/{task-comments.md, task-attachments-on-comments.md})
- design — done (engram + openspec/design.md)
- tasks — done (engram + openspec/tasks.md)
- apply — done (commit 99730ab)
- verify — PASS (engram + openspec/verify-report.md)
- archive — this file

## Final artifacts

- Branch: `feat/task-comments-attachments-merge` (worktree at `C:/Users/ronald/projects/ipnext/ipnext-frontend-task-comments-attachments-merge`)
- Commits:
  - `99730ab feat(scheduling)!: derive comment author from auth + merge adjuntos into comments`
  - `docs(scheduling): SDD artifacts for task-comments-attachments-merge` (this commit)

## Test results

- 154 test files passing, 1243 tests passing, 1 todo, 0 failing.
- 30 new tests added across the two new test files.
- `tsc --noEmit` introduces no new errors in the touched files; pre-existing TS noise in unrelated pages remains untouched.

## Follow-ups

- Backend: move `authorName` resolution to the auth-resolved request user on `POST /scheduling/:taskId/comments`. The FE will then stop sending the field; the body field can eventually be removed from the route contract.
- Backend: add a multipart upload endpoint (or S3 presigned-URL flow) if product wants drag-and-drop / paste-image-from-clipboard attachments.
