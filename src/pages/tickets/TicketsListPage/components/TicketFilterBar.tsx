import { useRef, useState, useEffect, type ReactNode } from 'react';
import { useTicketStatuses } from '@/hooks/useTicketStatuses';
import { useRbacUsers } from '@/hooks/useRbacUsers';
import { useTicketAreas } from '@/hooks/useTicketAreas';
import type { TicketFilter } from '../hooks/useTicketsFilterUrl';
import styles from './TicketFilterBar.module.css';

const PRIORITY_OPTIONS = [
  { value: 'high',   label: 'Alta' },
  { value: 'medium', label: 'Media' },
  { value: 'low',    label: 'Baja' },
];

interface TicketFilterBarProps {
  filter: TicketFilter;
  onFilterChange: (patch: Partial<TicketFilter>) => void;
  /** Layout: 'horizontal' (top bar, default) or 'vertical' (right-side panel,
   *  matching the Prominense reference — controls stacked with labels). */
  variant?: 'horizontal' | 'vertical';
  /** When false, the bar omits its inline ActiveFilterChips — used by the
   *  disclosure (#46), which renders the chips OUTSIDE the collapsible panel so
   *  they stay visible while it's closed. Defaults to true (origin behavior). */
  showChips?: boolean;
}

export function TicketFilterBar({ filter, onFilterChange, variant = 'horizontal', showChips = true }: TicketFilterBarProps) {
  const { data: statuses = [] } = useTicketStatuses();
  const { data: allUsers = [] } = useRbacUsers();
  const { data: areas = [] } = useTicketAreas();

  // Debounced search input
  const [qInput, setQInput] = useState(filter.q ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQInput(filter.q ?? '');
  }, [filter.q]);

  function handleQChange(val: string) {
    setQInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onFilterChange({ q: val || undefined });
    }, 300);
  }

  const isVertical = variant === 'vertical';

  // In the vertical (panel) layout every control gets a stacked label, exactly
  // like the Prominense reference. In horizontal layout controls sit inline and
  // only the date inputs carry their small labels (origin behavior).
  function field(label: string, control: ReactNode) {
    if (!isVertical) return control;
    return (
      <div className={styles.field}>
        <span className={styles.fieldLabel}>{label}</span>
        {control}
      </div>
    );
  }

  return (
    <div className={`${styles.filterBar} ${isVertical ? styles.vertical : ''}`}>
      {isVertical && <h3 className={styles.panelTitle}>Filtros</h3>}
      <div className={`${styles.controls} ${isVertical ? styles.controlsVertical : ''}`}>
        {/* Estado — catalog-driven */}
        {field('Estado',
          <select
            value={filter.status ?? ''}
            onChange={e => onFilterChange({ status: e.target.value || undefined })}
            className={styles.select}
            aria-label="Estado"
          >
            <option value="">Todos los estados</option>
            {statuses.map(s => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        )}

        {/* Prioridad */}
        {field('Prioridad',
          <select
            value={filter.priority ?? ''}
            onChange={e => onFilterChange({ priority: e.target.value || undefined })}
            className={styles.select}
            aria-label="Prioridad"
          >
            <option value="">Cualquier prioridad</option>
            {PRIORITY_OPTIONS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        )}

        {/* Asignado */}
        {field('Asignado',
          <select
            value={filter.assignedTo ?? ''}
            onChange={e => onFilterChange({ assignedTo: e.target.value || undefined })}
            className={styles.select}
            aria-label="Asignado"
          >
            <option value="">Cualquier asignado</option>
            {allUsers.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        )}

        {/* Area — catalog-driven (#49, lesson #27: NEVER hardcode area values) */}
        {field('Area',
          <select
            value={filter.areaId ?? ''}
            onChange={e => onFilterChange({ areaId: e.target.value || undefined })}
            className={styles.select}
            aria-label="Area"
          >
            <option value="">Cualquier area</option>
            {areas.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}

        {/* Búsqueda */}
        {field('Búsqueda',
          <input
            type="search"
            value={qInput}
            onChange={e => handleQChange(e.target.value)}
            placeholder="Buscar tickets..."
            className={styles.searchInput}
            aria-label="Buscar"
          />
        )}

        {!isVertical && <div className={styles.spacer} />}

        {/* Período */}
        <label className={styles.dateLabel}>
          Desde
          <input
            type="date"
            value={filter.from ?? ''}
            onChange={e => onFilterChange({ from: e.target.value || undefined })}
            className={styles.dateInput}
            aria-label="Desde"
          />
        </label>
        <label className={styles.dateLabel}>
          Hasta
          <input
            type="date"
            value={filter.to ?? ''}
            onChange={e => onFilterChange({ to: e.target.value || undefined })}
            className={styles.dateInput}
            aria-label="Hasta"
          />
        </label>
      </div>

      {showChips && (
        <ActiveFilterChips filter={filter} statuses={statuses} users={allUsers} areas={areas} onFilterChange={onFilterChange} />
      )}
    </div>
  );
}

/** Count of filter keys currently set — drives the disclosure's badge (#46). */
export function countActiveFilters(filter: TicketFilter): number {
  return (['status', 'priority', 'assignedTo', 'q', 'customerId', 'from', 'to', 'areaId'] as const)
    .filter(k => filter[k] != null && filter[k] !== '').length;
}

interface ActiveFilterChipsProps {
  filter: TicketFilter;
  statuses: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string }>;
  areas: Array<{ id: string; name: string }>;
  onFilterChange: (patch: Partial<TicketFilter>) => void;
}

export function ActiveFilterChips({ filter, statuses, users, areas, onFilterChange }: ActiveFilterChipsProps) {
  const chips: Array<{ label: string; onRemove: () => void }> = [];

  if (filter.status) {
    const statusName = statuses.find(s => s.name === filter.status)?.name ?? filter.status;
    chips.push({ label: statusName, onRemove: () => onFilterChange({ status: undefined }) });
  }
  if (filter.priority) {
    const label = PRIORITY_OPTIONS.find(p => p.value === filter.priority)?.label ?? filter.priority;
    chips.push({ label: `Prioridad: ${label}`, onRemove: () => onFilterChange({ priority: undefined }) });
  }
  if (filter.assignedTo) {
    const user = users.find(u => u.id === filter.assignedTo);
    chips.push({
      label: `Asignado: ${user?.name ?? filter.assignedTo}`,
      onRemove: () => onFilterChange({ assignedTo: undefined }),
    });
  }
  if (filter.q) {
    chips.push({ label: `"${filter.q}"`, onRemove: () => onFilterChange({ q: undefined }) });
  }
  if (filter.customerId) {
    chips.push({ label: `Cliente: #${filter.customerId}`, onRemove: () => onFilterChange({ customerId: undefined }) });
  }
  if (filter.areaId) {
    const areaName = areas.find(a => a.id === filter.areaId)?.name ?? filter.areaId;
    chips.push({ label: `Area: ${areaName}`, onRemove: () => onFilterChange({ areaId: undefined }) });
  }
  if (filter.from) {
    chips.push({ label: `Desde: ${filter.from}`, onRemove: () => onFilterChange({ from: undefined }) });
  }
  if (filter.to) {
    chips.push({ label: `Hasta: ${filter.to}`, onRemove: () => onFilterChange({ to: undefined }) });
  }

  if (chips.length === 0) return null;

  return (
    <ul className={styles.chipList} aria-label="Filtros activos">
      {chips.map(chip => (
        <li key={chip.label} className={styles.chip}>
          <span>{chip.label}</span>
          <button
            type="button"
            className={styles.chipRemove}
            onClick={chip.onRemove}
            aria-label={`Quitar filtro ${chip.label}`}
          >
            ×
          </button>
        </li>
      ))}
      <li>
        <button
          type="button"
          className={styles.clearAll}
          onClick={() => onFilterChange({
            status: undefined,
            priority: undefined,
            assignedTo: undefined,
            q: undefined,
            customerId: undefined,
            from: undefined,
            to: undefined,
            areaId: undefined,
          })}
          aria-label="Limpiar filtros"
        >
          Limpiar filtros
        </button>
      </li>
    </ul>
  );
}
