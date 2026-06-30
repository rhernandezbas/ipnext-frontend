/**
 * Photo attachment of a scheduling task (task-photos feature).
 *
 * Mirrors the backend Attachment DTO. `fileUrl` / `thumbUrl` are RELATIVE,
 * same-origin paths under `/api` — they are served by the auth-gated binary
 * endpoint (`GET /scheduling/attachments/:id/file`). Because they are
 * same-origin, a plain `<img src={...}>` sends the session cookie automatically
 * (the FE talks to the BE through the Vite dev proxy and the nginx `/api/`
 * location in prod — see the explore notes), so no blob-fetch dance is needed.
 */
export interface TaskAttachment {
  id: string;
  taskId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  /** Pixel width, or null when the BE could not derive it. */
  width: number | null;
  /** Pixel height, or null when the BE could not derive it. */
  height: number | null;
  uploadedById: string;
  createdAt: string;
  /** Auth-gated original binary — `/api/scheduling/attachments/{id}/file`. */
  fileUrl: string;
  /** Auth-gated thumbnail — `…/file?variant=thumb`. */
  thumbUrl: string;
}
