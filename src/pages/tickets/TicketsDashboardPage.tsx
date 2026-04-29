import { useState } from 'react';
import { useTicketStats, useTicketList } from '../../hooks/useTickets';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/atoms/Button/Button';
import { DataTable } from '../../components/organisms/DataTable/DataTable';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import styles from './TicketsDashboardPage.module.css';

const TICKET_COLUMNS = [
  { label: 'ID', key: 'id' as const },
  { label: 'Asunto', key: 'subject' as const },
  { label: 'Estado', key: 'status' as const },
  { label: 'Prioridad', key: 'priority' as const },
];

const STATS_DATA = [
  { day: 'Lun', Abiertos: 3, Resueltos: 2 },
  { day: 'Mar', Abiertos: 5, Resueltos: 4 },
  { day: 'Mié', Abiertos: 2, Resueltos: 6 },
  { day: 'Jue', Abiertos: 4, Resueltos: 3 },
  { day: 'Vie', Abiertos: 6, Resueltos: 5 },
  { day: 'Sáb', Abiertos: 1, Resueltos: 2 },
  { day: 'Dom', Abiertos: 0, Resueltos: 1 },
];

export default function TicketsDashboardPage() {
  const { data: stats, isLoading } = useTicketStats();
  const { data: myTicketsData, isLoading: myTicketsLoading } = useTicketList({ status: 'open', limit: 10 });
  const { data: adminTicketsData, isLoading: adminTicketsLoading } = useTicketList({ status: 'open', limit: 25 });
  const navigate = useNavigate();

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(weekAgo);
  const [dateTo, setDateTo] = useState(today);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Tickets</h1>
        <Button variant="primary" size="md" onClick={() => navigate('/admin/tickets/new')}>
          Nuevo Ticket
        </Button>
      </div>

      <div className={styles.statsSection}>
        <h2 className={styles.sectionTitle}>Estadísticas</h2>
        <div className={styles.dateRange}>
          <label htmlFor="date-desde">Desde</label>
          <input
            id="date-desde"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={styles.dateInput}
          />
          <label htmlFor="date-hasta">Hasta</label>
          <input
            id="date-hasta"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={styles.dateInput}
          />
        </div>
        <div className={styles.chartContainer}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={STATS_DATA}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Abiertos" fill="#e55353" />
              <Bar dataKey="Resueltos" fill="#28a745" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {isLoading ? (
        <div className={styles.loading}>Cargando estadísticas...</div>
      ) : (
        <div className={styles.cards}>
          <div className={styles.card}>
            <span className={styles.cardLabel}>Tickets abiertos</span>
            <span className={styles.cardValue} data-testid="kpi-open">{stats?.open ?? 0}</span>
          </div>
          <div className={[styles.card, styles.alta].join(' ')}>
            <span className={styles.cardLabel}>Cerrados hoy</span>
            <span className={styles.cardValue} data-testid="kpi-closedToday">{stats?.closedToday ?? 0}</span>
          </div>
          <div className={[styles.card, styles.baja].join(' ')}>
            <span className={styles.cardLabel}>Tiempo prom. resolución</span>
            <span className={styles.cardValue} data-testid="kpi-avgResolutionTime">{stats?.avgResolutionTime ?? '—'}</span>
          </div>
          <div className={[styles.card, styles.media].join(' ')}>
            <span className={styles.cardLabel}>Sin asignar</span>
            <span className={styles.cardValue} data-testid="kpi-unassigned">{stats?.unassigned ?? 0}</span>
          </div>
        </div>
      )}

      <div className={styles.listSection}>
        <h2 className={styles.sectionTitle}>Tickets activos</h2>
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/tickets/opened')}>
          Ver todos →
        </Button>
      </div>

      <div className={styles.listSection}>
        <h2 className={styles.sectionTitle}>Tickets recientes</h2>
        <DataTable
          columns={TICKET_COLUMNS}
          data={myTicketsData?.data?.slice(0, 5) ?? []}
          loading={myTicketsLoading}
          emptyMessage="Sin tickets recientes."
        />
      </div>

      <div className={styles.listSection}>
        <h2 className={styles.sectionTitle}>Por categoría</h2>
        <table>
          <tbody>
            <tr><td>Soporte técnico</td></tr>
            <tr><td>Facturación</td></tr>
            <tr><td>Conectividad</td></tr>
            <tr><td>General</td></tr>
          </tbody>
        </table>
      </div>

      <div className={styles.assignmentSection}>
        <h3>Asignado a mí</h3>
        <DataTable
          columns={TICKET_COLUMNS}
          data={myTicketsData?.data ?? []}
          loading={myTicketsLoading}
          emptyMessage="Sin tickets asignados."
        />
      </div>

      <div className={styles.assignmentSection}>
        <h3>Asignados a administradores</h3>
        <DataTable
          columns={TICKET_COLUMNS}
          data={adminTicketsData?.data ?? []}
          loading={adminTicketsLoading}
          emptyMessage="Sin tickets asignados a administradores."
        />
      </div>
    </div>
  );
}
