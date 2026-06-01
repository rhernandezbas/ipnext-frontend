import { useContractStats } from '../../hooks/useContracts';
import styles from './ContractStatsCards.module.css';

interface ContractStatsCardsProps {
  activeStatus: string;
  onStatusClick: (status: string) => void;
}

/**
 * Stat cards row above the Contratos table.
 * Renders "Contratos totales" + one card per status key returned by
 * GET /api/services/stats → { total, byStatus: { "<estado>": count } }.
 * Status keys are textual Gestión Real values (e.g. "Vigente", "Baja") —
 * rendered dynamically, never hardcoded.
 */
export function ContractStatsCards({ activeStatus, onStatusClick }: ContractStatsCardsProps) {
  const { data, isLoading } = useContractStats();

  const byStatus = data?.byStatus ?? {};

  return (
    <div className={styles.row} aria-label="Resumen de contratos por estado">
      {/* Total card */}
      <button
        type="button"
        className={`${styles.card} ${styles.total} ${activeStatus === '' ? styles.cardActive : ''}`}
        onClick={() => onStatusClick('')}
        aria-pressed={activeStatus === ''}
        aria-label={`Contratos totales: ${data?.total ?? 0}${activeStatus === '' ? ' (filtro activo)' : ''}`}
      >
        <span className={styles.value}>{isLoading ? '…' : (data?.total ?? 0).toLocaleString('es-AR')}</span>
        <span className={styles.label}>Contratos totales</span>
      </button>

      {/* One card per status key (dynamic) */}
      {Object.entries(byStatus).map(([status, count]) => {
        const isActive = activeStatus === status;
        return (
          <button
            key={status}
            type="button"
            className={`${styles.card} ${styles.status} ${isActive ? styles.cardActive : ''}`}
            onClick={() => onStatusClick(status)}
            aria-pressed={isActive}
            aria-label={`${status}: ${count}${isActive ? ' (filtro activo)' : ''}`}
          >
            <span className={styles.value}>{isLoading ? '…' : count.toLocaleString('es-AR')}</span>
            <span className={styles.label}>{status}</span>
          </button>
        );
      })}
    </div>
  );
}
