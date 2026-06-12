import { useState } from 'react';
import { useTicketStatuses } from '@/hooks/useTicketStatuses';
import { useRbacUsers } from '@/hooks/useRbacUsers';
import { useTicketAreas } from '@/hooks/useTicketAreas';
import { TicketFilterBar, ActiveFilterChips, countActiveFilters } from './TicketFilterBar';
import type { TicketFilter } from '../hooks/useTicketsFilterUrl';
import styles from './TicketFilterDisclosure.module.css';

interface TicketFilterDisclosureProps {
  filter: TicketFilter;
  onFilterChange: (patch: Partial<TicketFilter>) => void;
}

function IconSliders() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

/**
 * Collapsible filter panel (#46, AD-8). Closed by default behind a "Filtros"
 * button with a badge of the active-filter count. The active chips render
 * OUTSIDE the panel and stay visible while it's collapsed; removing a chip
 * updates the filter without forcing the panel open. The panel transitions on
 * `max-height` + `opacity` (200ms ease-out), so no layout property animates.
 */
export function TicketFilterDisclosure({ filter, onFilterChange }: TicketFilterDisclosureProps) {
  const [open, setOpen] = useState(false);
  const { data: statuses = [] } = useTicketStatuses();
  const { data: users = [] } = useRbacUsers();
  const { data: areas = [] } = useTicketAreas();

  const activeCount = countActiveFilters(filter);

  return (
    <div className={styles.disclosure}>
      <div className={styles.bar}>
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-controls="ticket-filter-panel"
        >
          <IconSliders />
          <span>Filtros</span>
          {activeCount > 0 && (
            <span className={styles.badge} data-testid="filter-count-badge">{activeCount}</span>
          )}
          <span className={styles.chevron} data-open={open} aria-hidden="true">⌄</span>
        </button>

        {/* Chips live OUTSIDE the panel — always visible, even when collapsed. */}
        <ActiveFilterChips
          filter={filter}
          statuses={statuses}
          users={users}
          areas={areas}
          onFilterChange={onFilterChange}
        />
      </div>

      <div
        id="ticket-filter-panel"
        className={styles.panel}
        data-open={open}
        // Keep the region out of the a11y tree AND unmount the controls when
        // closed, so a collapsed panel can't be tabbed into and tests can assert
        // the controls are absent.
        hidden={!open}
      >
        {open && (
          <TicketFilterBar
            filter={filter}
            onFilterChange={onFilterChange}
            variant="horizontal"
            showChips={false}
          />
        )}
      </div>
    </div>
  );
}
