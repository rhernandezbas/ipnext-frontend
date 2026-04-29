import { useState, ReactNode } from 'react';
import { KebabMenu } from '../../atoms/KebabMenu/KebabMenu';
import styles from './DataTable.module.css';

interface ColumnDef<T> {
  label: string;
  key: keyof T | string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
}

interface ActionDef<T> {
  label: string;
  onClick: (row: T) => void;
}

interface DataTableProps<T extends { id: string | number }> {
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  actions?: ActionDef<T>[];
  expandedContent?: (row: T) => ReactNode;
  expandable?: boolean;
  renderExpanded?: (row: T) => ReactNode;
  emptyMessage?: string;
  selectable?: boolean;
  onSelectionChange?: (selectedIds: string[]) => void;
  totals?: Record<string, ReactNode>;
}

type SortDir = 'asc' | 'desc';

export function DataTable<T extends { id: string | number }>({
  columns,
  data,
  loading = false,
  actions,
  expandedContent,
  expandable = false,
  renderExpanded,
  emptyMessage = 'No hay datos para mostrar.',
  selectable = false,
  onSelectionChange,
  totals,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function toggleExpand(id: string | number) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onSelectionChange?.([...next]);
      return next;
    });
  }

  function toggleAll() {
    const allIds = data.map((r) => String(r.id));
    const allSelected = allIds.every((id) => selectedIds.has(id));
    const next = allSelected ? new Set<string>() : new Set(allIds);
    setSelectedIds(next);
    onSelectionChange?.([...next]);
  }

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const av = (a as Record<string, unknown>)[sortKey];
    const bv = (b as Record<string, unknown>)[sortKey];
    const cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'es', { numeric: true });
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const allIds = data.map((r) => String(r.id));
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));

  const hasExpandCol = !!(expandedContent || (expandable && renderExpanded));
  const colCount = columns.length + (hasExpandCol ? 1 : 0) + (actions?.length ? 1 : 0) + (selectable ? 1 : 0);

  if (loading) {
    return (
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              {hasExpandCol && <th className={styles.expandCol} />}
              {columns.map((c) => <th key={String(c.key)}>{c.label}</th>)}
              {actions && <th className={styles.actionsCol} />}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className={styles.skeletonRow}>
                {Array.from({ length: colCount }).map((__, j) => (
                  <td key={j}><div className={styles.skeleton} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {selectable && (
              <th className={styles.checkboxCol}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Seleccionar todos"
                />
              </th>
            )}
            {hasExpandCol && <th className={styles.expandCol} />}
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={col.sortable ? styles.sortable : ''}
                onClick={col.sortable ? () => handleSort(String(col.key)) : undefined}
                aria-sort={sortKey === String(col.key) ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
              >
                {col.label}
                {col.sortable && sortKey === String(col.key) && (
                  <span className={styles.sortIcon}>{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>
                )}
              </th>
            ))}
            {actions && <th className={styles.actionsCol} />}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={colCount} className={styles.emptyState}>{emptyMessage}</td>
            </tr>
          ) : (
            sorted.map((row) => (
              <>
                <tr key={row.id} className={styles.row}>
                  {selectable && (
                    <td className={styles.checkboxCell}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(String(row.id))}
                        onChange={() => toggleRow(String(row.id))}
                        aria-label={`Seleccionar fila ${row.id}`}
                      />
                    </td>
                  )}
                  {expandedContent && (
                    <td className={styles.expandCell}>
                      <button
                        className={[styles.expandBtn, expandedRows.has(row.id) ? styles.expanded : ''].join(' ')}
                        onClick={() => toggleExpand(row.id)}
                        aria-label={expandedRows.has(row.id) ? 'Contraer' : 'Expandir'}
                      >
                        ›
                      </button>
                    </td>
                  )}
                  {expandable && renderExpanded && !expandedContent && (
                    <td className={styles.expandCell}>
                      <button
                        className={[styles.expandBtn, expandedRows.has(row.id) ? styles.expanded : ''].join(' ')}
                        onClick={() => toggleExpand(row.id)}
                        aria-label={expandedRows.has(row.id) ? 'Colapsar fila' : 'Expandir fila'}
                      >
                        ›
                      </button>
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={String(col.key)}>
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[String(col.key)] ?? '')}
                    </td>
                  ))}
                  {actions && (
                    <td className={styles.actionsCell}>
                      <KebabMenu
                        items={actions.map((a) => ({ label: a.label, onClick: () => a.onClick(row) }))}
                      />
                    </td>
                  )}
                </tr>
                {expandedContent && expandedRows.has(row.id) && (
                  <tr key={`${row.id}-expanded`} className={styles.expandedRow}>
                    <td colSpan={colCount}>{expandedContent(row)}</td>
                  </tr>
                )}
                {expandable && renderExpanded && !expandedContent && expandedRows.has(row.id) && (
                  <tr key={`${row.id}-expanded`} className={styles.expandedRow}>
                    <td colSpan={colCount}>{renderExpanded(row)}</td>
                  </tr>
                )}
              </>
            ))
          )}
        </tbody>
        {totals && (
          <tfoot>
            <tr>
              {selectable && <td />}
              {hasExpandCol && <td />}
              {columns.map((col) => (
                <td key={String(col.key)}>
                  {totals[String(col.key)] ?? ''}
                </td>
              ))}
              {actions && <td />}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
