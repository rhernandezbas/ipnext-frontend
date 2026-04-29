import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { useLeads } from '@/hooks/useLeads';
import type { Lead } from '@/types/lead';
import styles from './CrmDashboardPage.module.css';

const COLUMNS = [
  { label: 'Nombre', key: 'name' as keyof Lead },
  { label: 'Email', key: 'email' as keyof Lead },
  { label: 'Estado', key: 'status' as keyof Lead },
  { label: 'Fuente', key: 'source' as keyof Lead },
  { label: 'Fecha', key: 'createdAt' as keyof Lead },
];

export default function CrmDashboardPage() {
  const { data: leads = [], isLoading } = useLeads();

  const totalLeads = leads.length;
  const nuevos = leads.filter(l => l.status === 'new').length;
  const enProceso = leads.filter(
    l => l.status === 'contacted' || l.status === 'qualified' || l.status === 'proposal_sent',
  ).length;
  const ganados = leads.filter(l => l.status === 'won').length;
  const perdidos = leads.filter(l => l.status === 'lost').length;

  const recentLeads = [...leads]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>CRM — Panel</h1>

      <div className={styles.kpiGrid} aria-label="KPI cards">
        <div className={styles.kpiCard} style={{ '--kpi-color': '#2563eb' } as React.CSSProperties}>
          <div className={styles.kpiValue}>{totalLeads}</div>
          <div className={styles.kpiLabel}>Total leads</div>
        </div>
        <div className={styles.kpiCard} style={{ '--kpi-color': '#10b981' } as React.CSSProperties}>
          <div className={styles.kpiValue}>{nuevos}</div>
          <div className={styles.kpiLabel}>Nuevos</div>
        </div>
        <div className={styles.kpiCard} style={{ '--kpi-color': '#f59e0b' } as React.CSSProperties}>
          <div className={styles.kpiValue}>{enProceso}</div>
          <div className={styles.kpiLabel}>En proceso</div>
        </div>
        <div className={styles.kpiCard} style={{ '--kpi-color': '#8b5cf6' } as React.CSSProperties}>
          <div className={styles.kpiValue}>{ganados}</div>
          <div className={styles.kpiLabel}>Ganados</div>
        </div>
        <div className={styles.kpiCard} style={{ '--kpi-color': '#ef4444' } as React.CSSProperties}>
          <div className={styles.kpiValue}>{perdidos}</div>
          <div className={styles.kpiLabel}>Perdidos</div>
        </div>
      </div>

      <DataTable<Lead>
        columns={COLUMNS}
        data={recentLeads}
        loading={isLoading}
        emptyMessage="No hay leads registrados."
      />
    </div>
  );
}
