import { useState } from 'react';
import { Pagination } from '@/components/molecules/Pagination/Pagination';
import { useOwnershipCases } from '@/hooks/useActions';
import type { OwnershipCaseStatus } from '@/types/actions';
import { CaseCard } from './CaseCard';
import styles from './OwnershipCasesTab.module.css';

/**
 * Tab "Cambios de titular" — cards de caso con checklist (NO DataTable:
 * el checklist pide altura). Filtro por estado con pills + paginación.
 */

const PAGE_SIZE = 25;

const STATUS_FILTERS: Array<{ value: OwnershipCaseStatus | ''; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'ambiguous', label: 'Ambiguos' },
  { value: 'done', label: 'Completados' },
  { value: 'dismissed', label: 'Descartados' },
];

export function OwnershipCasesTab() {
  const [status, setStatus] = useState<OwnershipCaseStatus | ''>('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useOwnershipCases({
    ...(status ? { status } : {}),
    page,
    pageSize: PAGE_SIZE,
  });

  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  // M3 — clamp tras shrink: un flip a done (u otro filtro) puede achicar el
  // total mientras estamos en una página que ya no existe → quedaríamos
  // mirando un empty-state mentiroso. Ajuste de estado durante el render
  // (patrón React de derived state): re-renderiza antes de pintar.
  if (data && data.total > 0 && page > totalPages) {
    setPage(totalPages);
  }

  return (
    <div className={styles.tab}>
      <div className={styles.filters} role="group" aria-label="Filtrar por estado">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            aria-pressed={status === f.value}
            className={status === f.value ? styles.filterPillActive : styles.filterPill}
            onClick={() => {
              setStatus(f.value);
              setPage(1);
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isError ? (
        <p className={styles.error} role="alert">
          No se pudieron cargar los casos. Reintentá.
        </p>
      ) : isLoading ? (
        <p className={styles.state} role="status">
          Cargando casos…
        </p>
      ) : items.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>
            {status ? 'No hay casos con este estado.' : 'No hay casos todavía.'}
          </p>
          <p className={styles.emptyHint}>
            El detector corre tras cada sync de Gestión Real — los cambios de
            titularidad nuevos aparecen acá solos.
          </p>
        </div>
      ) : (
        <div className={styles.cardList}>
          {items.map((c) => (
            <CaseCard key={c.id} caso={c} />
          ))}
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
