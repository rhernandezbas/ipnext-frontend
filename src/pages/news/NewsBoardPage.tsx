import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNewsList, useNewsCategories, useMarkNewsRead } from '@/hooks/useNews';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { Can } from '@/components/auth/Can';
import type { NewsPost } from '@/types/news';
import { NewsCard } from './components/NewsCard';
import { NewsDetailDrawer } from './components/NewsDetailDrawer';
import { NewsPostModal } from './components/NewsPostModal';
import styles from './NewsBoardPage.module.css';

/**
 * NewsBoardPage (internal-news FE apply — `/admin/news`, gated news.read).
 *
 * Server-side filters only (categoryId/unreadOnly/archived go straight to
 * GET /api/news — no client-side re-sort: the BE already orders
 * `pinned DESC, publishedAt DESC`, NEWS-FE-BD-2). "Archivadas" is gated
 * news.manage (the BE 403s ?archived=true without it, NEWS-FE-BD-4).
 */
export default function NewsBoardPage() {
  const { can } = useMyPermissions();
  const canManage = can('news.manage');

  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [archived, setArchived] = useState(false);
  // M1 review fix: a LOCAL snapshot of the opened post, taken once at open
  // time — NOT derived from `items` on every render. Under `unreadOnly`,
  // mark-read invalidates ['news'] and the refetched list drops the (now
  // read) post; deriving `selectedPost = items.find(...)` would then go
  // null and unmount the drawer out from under the user mid-read. The
  // snapshot stays stable until the user explicitly closes it.
  const [openPost, setOpenPost] = useState<NewsPost | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPost, setEditingPost] = useState<NewsPost | null>(null);

  const filters = useMemo(
    () => ({ categoryId, unreadOnly, archived: canManage ? archived : false }),
    [categoryId, unreadOnly, archived, canManage],
  );

  const { data, isLoading, isError, refetch } = useNewsList(filters);
  const { data: categories = [] } = useNewsCategories();
  const markRead = useMarkNewsRead();

  const items = data?.items ?? [];

  function handleOpen(id: string) {
    const post = items.find((p) => p.id === id);
    if (post) setOpenPost(post);
  }

  function handleMarkRead(id: string) {
    markRead.mutate(id);
  }

  function handleEdit(post: NewsPost) {
    setEditingPost(post);
    setOpenPost(null);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Noticias</h1>
          <p className={styles.subtitle}>Tablón interno del equipo — anuncios, campañas y novedades.</p>
        </div>
        <div className={styles.headerActions}>
          <Can permission="news.manage">
            <Link to="/admin/news/settings" className={styles.linkBtn}>Categorías</Link>
            <button type="button" className={styles.btnPrimary} onClick={() => setShowCreateModal(true)}>
              + Nueva noticia
            </button>
          </Can>
        </div>
      </div>

      <div className={styles.filters}>
        <div className={styles.chipRow}>
          <button
            type="button"
            className={styles.chip}
            aria-pressed={categoryId === undefined}
            data-active={categoryId === undefined || undefined}
            onClick={() => setCategoryId(undefined)}
          >
            Todas
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={styles.chip}
              aria-pressed={categoryId === cat.id}
              data-active={categoryId === cat.id || undefined}
              onClick={() => setCategoryId(cat.id)}
            >
              <span className={styles.chipDot} style={{ background: cat.color }} aria-hidden="true" />
              {cat.name}
            </button>
          ))}
        </div>

        <div className={styles.toggleRow}>
          <button
            type="button"
            className={styles.toggle}
            aria-pressed={unreadOnly}
            data-active={unreadOnly || undefined}
            onClick={() => setUnreadOnly((v) => !v)}
          >
            Solo no leídas
          </button>
          {canManage && (
            <button
              type="button"
              className={styles.toggle}
              aria-pressed={archived}
              data-active={archived || undefined}
              onClick={() => setArchived((v) => !v)}
            >
              Archivadas
            </button>
          )}
        </div>
      </div>

      {isLoading && <NewsBoardSkeleton />}

      {!isLoading && isError && (
        <div className={styles.stateBox}>
          <p>No se pudo cargar las noticias. Intentá de nuevo.</p>
          <button type="button" className={styles.btnSecondary} onClick={() => refetch()}>
            Reintentar
          </button>
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <div className={styles.stateBox}>
          <p>No hay noticias para mostrar.</p>
          <Can permission="news.manage">
            <button type="button" className={styles.btnPrimary} onClick={() => setShowCreateModal(true)}>
              + Nueva noticia
            </button>
          </Can>
        </div>
      )}

      {!isLoading && !isError && items.length > 0 && (
        <div className={styles.grid}>
          {items.map((post) => (
            <NewsCard key={post.id} post={post} onOpen={handleOpen} />
          ))}
        </div>
      )}

      {openPost && (
        <NewsDetailDrawer
          key={openPost.id}
          post={openPost}
          onClose={() => setOpenPost(null)}
          onMarkRead={handleMarkRead}
          onEdit={handleEdit}
        />
      )}

      {(showCreateModal || editingPost) && (
        <NewsPostModal
          categories={categories}
          initial={editingPost ?? undefined}
          onClose={() => {
            setShowCreateModal(false);
            setEditingPost(null);
          }}
        />
      )}
    </div>
  );
}

function NewsBoardSkeleton() {
  return (
    <div className={styles.grid} data-testid="news-board-skeleton" aria-busy="true" aria-label="Cargando noticias">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={styles.skeletonCard}>
          <div className={styles.skeletonLine} style={{ width: '40%' }} />
          <div className={styles.skeletonLine} style={{ width: '80%', height: 18 }} />
          <div className={styles.skeletonLine} style={{ width: '95%' }} />
          <div className={styles.skeletonLine} style={{ width: '60%' }} />
        </div>
      ))}
    </div>
  );
}
