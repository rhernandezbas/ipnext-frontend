import { useBillingSummary, useMonthlyBilling } from '../../hooks/useBilling';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/atoms/Button/Button';
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
import styles from './FinanzasDashboardPage.module.css';

function Currency({ amount }: { amount: number }) {
  return <>${amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</>;
}

export function FinanzasDashboardPage() {
  const { data: summary, isLoading } = useBillingSummary();
  const { data: monthly, isLoading: monthlyLoading } = useMonthlyBilling();
  const navigate = useNavigate();

  const chartData = monthly
    ? [
        { name: monthly.lastMonth.label, Facturado: monthly.lastMonth.invoiced, Pagado: monthly.lastMonth.paid },
        { name: monthly.currentMonth.label, Facturado: monthly.currentMonth.invoiced, Pagado: monthly.currentMonth.paid },
        { name: monthly.nextMonth.label, Facturado: monthly.nextMonth.invoiced, Pagado: monthly.nextMonth.paid },
      ]
    : [];

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Finanzas</h1>
      {isLoading ? (
        <div className={styles.loading}>Cargando resumen...</div>
      ) : (
        <div className={styles.cards}>
          <div className={[styles.card, styles.green].join(' ')}>
            <span className={styles.cardLabel}>Ingresos del mes</span>
            <span className={styles.cardValue}>
              <Currency amount={summary?.paidThisMonth ?? 0} />
            </span>
          </div>
          <div className={[styles.card, styles.yellow].join(' ')}>
            <span className={styles.cardLabel}>Pendiente de cobro</span>
            <span className={styles.cardValue}>
              <Currency amount={summary?.pendingAmount ?? 0} />
            </span>
          </div>
          <div className={[styles.card, styles.red].join(' ')}>
            <span className={styles.cardLabel}>Facturas vencidas</span>
            <span className={styles.cardValue}>
              <Currency amount={summary?.overdueAmount ?? 0} />
            </span>
          </div>
          <div className={styles.card}>
            <span className={styles.cardLabel}>Notas de crédito</span>
            <span className={styles.cardValue}>
              <Currency amount={summary?.creditNotesAmount ?? 0} />
            </span>
          </div>
          <div className={[styles.card, styles.green].join(' ')}>
            <span className={styles.cardLabel}>Facturas proforma pagadas</span>
            <span className={styles.cardValue}>
              <Currency amount={summary?.proformaPaidAmount ?? 0} />
            </span>
          </div>
          <div className={[styles.card, styles.yellow].join(' ')}>
            <span className={styles.cardLabel}>Facturas proforma no pagadas</span>
            <span className={styles.cardValue}>
              <Currency amount={summary?.proformaUnpaidAmount ?? 0} />
            </span>
          </div>
        </div>
      )}

      {monthlyLoading && (
        <div className={styles.loading}>Cargando datos...</div>
      )}

      {!monthlyLoading && monthly && (
        <div className={styles.monthlySection}>
          <h2 className={styles.sectionTitle}>Comparación mensual</h2>
          <table className={styles.monthlyTable}>
            <thead>
              <tr>
                <th></th>
                <th>Último mes</th>
                <th>Mes actual</th>
                <th>Próximo mes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Facturado</td>
                <td><Currency amount={monthly.lastMonth.invoiced} /></td>
                <td><Currency amount={monthly.currentMonth.invoiced} /></td>
                <td><Currency amount={monthly.nextMonth.invoiced} /></td>
              </tr>
              <tr>
                <td>Pagado</td>
                <td><Currency amount={monthly.lastMonth.paid} /></td>
                <td><Currency amount={monthly.currentMonth.paid} /></td>
                <td><Currency amount={monthly.nextMonth.paid} /></td>
              </tr>
            </tbody>
          </table>

          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Facturado" fill="#4a90e2" />
                <Bar dataKey="Pagado" fill="#28a745" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className={styles.quickLinks}>
        <Button
          variant="secondary"
          size="md"
          onClick={() => navigate('/admin/finance/invoices')}
        >
          Ver facturas
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={() => navigate('/admin/finance/payments')}
        >
          Ver pagos
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={() => navigate('/admin/finance/transactions')}
        >
          Ver transacciones
        </Button>
      </div>
    </div>
  );
}
