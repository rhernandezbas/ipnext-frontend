import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import type { PermissionModule } from '@/types/rolePermissions';
import styles from './PermissionMatrix.module.css';

export interface PermissionMatrixProps {
  modules: PermissionModule[];
  selectedIds: Set<string>;
  onChange: (permissionId: string, checked: boolean) => void;
  roleCode?: string;
  isSaving?: boolean;
}

const SUPER_ADMIN = 'super_admin';

// ── Highlight matched substring ──────────────────────────────────────────────

function highlight(text: string, query: string) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <strong className={styles.match}>{text.slice(idx, idx + query.length)}</strong>
      {text.slice(idx + query.length)}
    </>
  );
}

// ── Module row ────────────────────────────────────────────────────────────────

interface ModuleRowProps {
  module: PermissionModule;
  selectedIds: Set<string>;
  onChange: (id: string, checked: boolean) => void;
  isSuperAdmin: boolean;
  isSaving: boolean;
  query: string;
  rowIndex: number;
  onCellKeyDown: (e: KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) => void;
}

function ModuleRow({
  module,
  selectedIds,
  onChange,
  isSuperAdmin,
  isSaving,
  query,
  rowIndex,
  onCellKeyDown,
}: ModuleRowProps) {
  const [expanded, setExpanded] = useState(true);

  const grantedCount = module.actions.filter(a => {
    const id = module.actionToId[a];
    return id && selectedIds.has(id);
  }).length;

  const totalCount = module.actions.length;

  function selectAll() {
    module.actions.forEach(a => {
      const id = module.actionToId[a];
      if (id) onChange(id, true);
    });
  }

  function selectNone() {
    module.actions.forEach(a => {
      const id = module.actionToId[a];
      if (id) onChange(id, false);
    });
  }

  return (
    <div className={styles.moduleGroup} role="rowgroup" aria-label={module.moduleLabel}>
      {/* Module header */}
      <div className={styles.moduleHeader} role="row">
        <button
          type="button"
          className={styles.moduleToggle}
          aria-expanded={expanded}
          onClick={() => setExpanded(v => !v)}
        >
          <span className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`} aria-hidden="true">›</span>
          <span className={styles.moduleLabel}>
            {highlight(module.moduleLabel, query)}
          </span>
          <span className={styles.moduleCode}>{module.moduleCode}</span>
        </button>

        <div className={styles.moduleHeaderRight}>
          {!isSuperAdmin && (
            <div className={styles.bulkBtns} aria-hidden="false">
              <button
                type="button"
                className={styles.bulkBtn}
                onClick={selectAll}
                tabIndex={-1}
              >
                Todo
              </button>
              <button
                type="button"
                className={styles.bulkBtn}
                onClick={selectNone}
                tabIndex={-1}
              >
                Nada
              </button>
            </div>
          )}
          <span className={styles.badge} title={`${grantedCount} de ${totalCount} permisos activos`}>
            {grantedCount}/{totalCount}
          </span>
        </div>
      </div>

      {/* Cells row */}
      {expanded && (
        <div className={styles.cellsRow} role="row" aria-label={`Permisos de ${module.moduleLabel}`}>
          {module.actions.map((action, colIdx) => {
            const permId = module.actionToId[action];
            const isChecked = isSuperAdmin ? true : (permId ? selectedIds.has(permId) : false);
            const isDisabled = isSuperAdmin || isSaving || !permId;

            return (
              <div
                key={action}
                className={styles.cell}
                role="gridcell"
              >
                <label className={styles.cellLabel} title={action}>
                  <input
                    type="checkbox"
                    className={styles.cellCheckbox}
                    checked={isChecked}
                    disabled={isDisabled}
                    aria-checked={isChecked}
                    aria-label={`${module.moduleLabel} — ${action}`}
                    onChange={e => permId && onChange(permId, e.target.checked)}
                    onKeyDown={e => onCellKeyDown(e, rowIndex, colIdx)}
                  />
                  <span className={styles.actionLabel}>{action}</span>
                </label>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PermissionMatrix({
  modules,
  selectedIds,
  onChange,
  roleCode,
  isSaving = false,
}: PermissionMatrixProps) {
  const [query, setQuery] = useState('');
  const gridRef = useRef<HTMLDivElement>(null);
  const isSuperAdmin = roleCode === SUPER_ADMIN;

  const filteredModules = query
    ? modules.filter(
        m =>
          m.moduleLabel.toLowerCase().includes(query.toLowerCase()) ||
          m.moduleCode.toLowerCase().includes(query.toLowerCase())
      )
    : modules;

  // Keyboard navigation: arrows move between cells, space toggles
  const handleCellKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) => {
      if (!gridRef.current) return;
      const allCells = Array.from(gridRef.current.querySelectorAll<HTMLInputElement>(
        'input[type="checkbox"]:not([disabled])'
      ));
      const currentIdx = rowIdx * (filteredModules[rowIdx]?.actions.length ?? 1) + colIdx;

      switch (e.key) {
        case 'ArrowRight': {
          e.preventDefault();
          allCells[currentIdx + 1]?.focus();
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          allCells[Math.max(0, currentIdx - 1)]?.focus();
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          const colCount = filteredModules[rowIdx]?.actions.length ?? 1;
          allCells[currentIdx + colCount]?.focus();
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const colCountUp = filteredModules[rowIdx]?.actions.length ?? 1;
          allCells[Math.max(0, currentIdx - colCountUp)]?.focus();
          break;
        }
      }
    },
    [filteredModules]
  );

  return (
    <div className={styles.matrix}>
      {/* Search bar */}
      <div className={styles.searchBar}>
        <span className={styles.searchIcon} aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </span>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Buscar módulo..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Filtrar módulos"
        />
        {query && (
          <button
            type="button"
            className={styles.clearSearch}
            onClick={() => setQuery('')}
            aria-label="Limpiar búsqueda"
          >
            ×
          </button>
        )}
      </div>

      {/* Super admin lock banner */}
      {isSuperAdmin && (
        <div className={styles.superAdminBanner} role="status" aria-live="polite">
          <span className={styles.lockIcon} aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="7" width="10" height="8" rx="2" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </span>
          <span>Acceso total por sistema — los permisos de Super Administrador no pueden modificarse</span>
        </div>
      )}

      {/* Grid */}
      <div
        className={`${styles.grid} ${isSaving ? styles.gridSaving : ''}`}
        role="grid"
        aria-rowcount={filteredModules.length}
        aria-busy={isSaving}
        ref={gridRef}
      >
        {filteredModules.length === 0 ? (
          <div className={styles.emptySearch}>
            No hay módulos que coincidan con "{query}"
          </div>
        ) : (
          filteredModules.map((mod, rowIdx) => (
            <ModuleRow
              key={mod.moduleCode}
              module={mod}
              selectedIds={selectedIds}
              onChange={onChange}
              isSuperAdmin={isSuperAdmin}
              isSaving={isSaving}
              query={query}
              rowIndex={rowIdx}
              onCellKeyDown={handleCellKeyDown}
            />
          ))
        )}
      </div>
    </div>
  );
}
