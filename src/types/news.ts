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

export interface NewsPost {
  id: string;
  title: string;
  /** Plain multiline text (v1) — render with `white-space: pre-wrap`, never as HTML. */
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
  createdAt: string;
  updatedAt: string;
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
