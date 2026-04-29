import styles from './Pagination.module.css';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: number[] = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <nav className={styles.nav} aria-label="Paginación">
      <button
        className={styles.btn}
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Anterior"
      >
        &lsaquo;
      </button>

      {start > 1 && (
        <>
          <button className={styles.btn} onClick={() => onPageChange(1)}>1</button>
          {start > 2 && <span className={styles.ellipsis}>…</span>}
        </>
      )}

      {pages.map((p) => (
        <button
          key={p}
          className={[styles.btn, p === currentPage ? styles.active : ''].join(' ')}
          onClick={() => onPageChange(p)}
          aria-current={p === currentPage ? 'page' : undefined}
        >
          {p}
        </button>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className={styles.ellipsis}>…</span>}
          <button className={styles.btn} onClick={() => onPageChange(totalPages)}>{totalPages}</button>
        </>
      )}

      <button
        className={styles.btn}
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Siguiente"
      >
        &rsaquo;
      </button>
    </nav>
  );
}
