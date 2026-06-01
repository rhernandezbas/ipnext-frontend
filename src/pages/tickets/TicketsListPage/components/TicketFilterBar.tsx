import { useRef, useState, useEffect } from 'react';
import { useTicketStatuses } from '@/hooks/useTicketStatuses';
import { useRbacUsers } from '@/hooks/useRbacUsers';
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
}

export function TicketFilterBar({ filter, onFilterChange }: TicketFilterBarProps) {
  const { data: statuses = [] } = useTicketStatuses();
  const { data: allUsers = [] } = useRbacUsers();

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

  return (
    <div className={styles.filterBar}>
      <div className={styles.controls}>
        {/* Estado — catalog-driven */}
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

        {/* Prioridad */}
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

        {/* Asignado */}
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

        {/* Búsqueda */}
        <input
          type="search"
          value={qInput}
          onChange={e => handleQChange(e.target.value)}
          placeholder="Buscar tickets..."
          className={styles.searchInput}
          aria-label="Buscar"
        />

        <div className={styles.spacer} />

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

      <ActiveFilterChips filter={filter} statuses={statuses} users={allUsers} onFilterChange={onFilterChange} />
    </div>
  );
}

interface ActiveFilterChipsProps {
  filter: TicketFilter;
  statuses: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string }>;
  onFilterChange: (patch: Partial<TicketFilter>) => void;
}

function ActiveFilterChips({ filter, statuses, users, onFilterChange }: ActiveFilterChipsProps) {
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
          })}
          aria-label="Limpiar filtros"
        >
          Limpiar filtros
        </button>
      </li>
    </ul>
  );
}
