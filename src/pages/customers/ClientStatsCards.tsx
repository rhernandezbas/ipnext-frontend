import { useClientStats } from '../../hooks/useCustomers';
import styles from './ClientStatsCards.module.css';

interface ClientStatsCardsProps {
  activeStatus: string;
  onStatusClick: (status: string) => void;
}

/**
 * Stat cards row that sits above the Clientes table. Each card shows the
 * total count for a ClientStatus and acts as a one-click filter — clicking
 * a card toggles the FilterBar status filter to the corresponding value
 * (clicking the active card clears it).
 */
export function ClientStatsCards({ activeStatus, onStatusClick }: ClientStatsCardsProps) {
  const { data, isLoading } = useClientStats();

  const cards = [
    { key: '',         label: 'Total',       value: data?.total    ?? 0, tone: 'total'    as const },
    { key: 'active',   label: 'Activos',     value: data?.active   ?? 0, tone: 'active'   as const },
    { key: 'inactive', label: 'Inactivos',   value: data?.inactive ?? 0, tone: 'inactive' as const },
    { key: 'late',     label: 'Atrasados',   value: data?.late     ?? 0, tone: 'late'     as const },
    { key: 'blocked',  label: 'Bloqueados',  value: data?.blocked  ?? 0, tone: 'blocked'  as const },
  ];

  return (
    <div className={styles.row} aria-label="Resumen de clientes por estado">
      {cards.map(card => {
        const isActive = activeStatus === card.key;
        return (
          <button
            key={card.label}
            type="button"
            className={`${styles.card} ${styles[card.tone]} ${isActive ? styles.cardActive : ''}`}
            onClick={() => onStatusClick(card.key)}
            aria-pressed={isActive}
            aria-label={`${card.label}: ${card.value} ${isActive ? '(filtro activo)' : ''}`}
          >
            <span className={styles.value}>{isLoading ? '…' : card.value.toLocaleString('es-AR')}</span>
            <span className={styles.label}>{card.label}</span>
          </button>
        );
      })}
    </div>
  );
}
