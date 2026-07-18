/**
 * internal-news (FE apply) — types for the internal news board.
 *
 * Mirrors the REAL BE contract verified live against `ipnext-backend` main
 * (`src/application/dto/news.dto.ts` + `src/infrastructure/http/routes/news.routes.ts`,
 * commit range e2c1f004..dfa0904a, deployed). Notably:
 *   - the read-state field is `read` (NOT `isRead`).
 *   - GET /api/news has NO pagination (no `page`/`limit` query params).
 *   - the category filter query param is `category` (NOT `categoryId`).
 */

export interface NewsCategory {
  id: string;
  name: string;
  /** 6-digit hex, e.g. "#6366f1". */
  color: string;
}

/**
 * An attachment of a news post (N2 BE contract).
 *  - binaries (`image` | `file`): `fileUrl` = BE-proxy path `/api/news/attachments/:id/file`;
 *    `url` is null.
 *  - `link`: `url` = the external URL; `fileUrl` is null.
 */
export type NewsAttachmentKind = 'image' | 'file' | 'link';

export interface NewsAttachment {
  id: string;
  kind: NewsAttachmentKind;
  filename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  /** External URL — links only, null for binaries. */
  url: string | null;
  /** BE-proxy path to the binary — binaries only, null for links. Already includes `/api`. */
  fileUrl: string | null;
  uploadedById: string;
  createdAt: string;
}

/** Result of POST /api/news/:id/broadcast — the WhatsApp NOC diffusion. */
export interface NewsBroadcastResult {
  sent: boolean;
  /** The absolute deep link included in the broadcast message. */
  link: string;
}

export interface NewsPost {
  id: string;
  title: string;
  /**
   * MARKDOWN source (N2). Rendered via a safe React-node renderer
   * (`SafeMarkdown`) — never `dangerouslySetInnerHTML`, no raw HTML interpreted.
   */
  body: string;
  category: NewsCategory;
  authorId: string | null;
  /** Snapshot — survives the author user being deleted. */
  authorName: string;
  pinned: boolean;
  publishedAt: string;
  archivedAt: string | null;
  /** Per-requesting-user read state. */
  read: boolean;
  /** N2 — attachments (images/files/links). Present in GET /:id and each GET / item. */
  attachments: NewsAttachment[];
  /** N2 — ISO of the last NOC broadcast, or null if never broadcast. */
  lastBroadcastAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Body for adding a LINK attachment (POST /api/news/:id/attachments, JSON branch). */
export interface AddNewsLinkInput {
  url: string;
  filename?: string;
}

export interface ListNewsPostsResult {
  items: NewsPost[];
  unreadCount: number;
}

/** Query params accepted by GET /api/news — server-side filters, no pagination. */
export interface NewsListFilters {
  categoryId?: string;
  unreadOnly?: boolean;
  archived?: boolean;
}

export interface CreateNewsPostInput {
  title: string;
  body: string;
  categoryId: string;
  pinned?: boolean;
}

export type UpdateNewsPostInput = Partial<CreateNewsPostInput>;

export interface CreateNewsCategoryInput {
  name: string;
  color: string;
}

export type UpdateNewsCategoryInput = Partial<CreateNewsCategoryInput>;
