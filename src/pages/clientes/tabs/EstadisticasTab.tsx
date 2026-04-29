import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import styles from './Tab.module.css';

interface Props {
  clientId: string;
  active: boolean;
}

type Period = 7 | 30 | 90;

function generateMockData(days: number) {
  const data = [];
  const base = new Date(2026, 0, 1);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    // deterministic pseudo-random using index
    const seed = i * 7 + 13;
    data.push({
      fecha: `${day}/${month}`,
      descarga: 5 + (seed % 45),
      carga: 1 + (seed % 9),
    });
  }
  return data;
}

const ALL_DATA = generateMockData(90);
const CURRENT_SPEED = { descarga: 32, carga: 7 };
const PERIODS: Period[] = [7, 30, 90];

export function EstadisticasTab(_props: Props) {
  const [period, setPeriod] = useState<Period>(30);

  const data = ALL_DATA.slice(ALL_DATA.length - period);

  return (
    <div className={styles.tab}>
      <h2 className={styles.sectionTitle}>Estadísticas de tráfico</h2>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            aria-pressed={period === p}
            style={{
              padding: '0.375rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: period === p ? 'var(--color-primary)' : 'transparent',
              color: period === p ? '#fff' : 'var(--color-text-primary)',
              cursor: 'pointer',
              fontWeight: period === p ? 600 : 400,
            }}
          >
            {p} días
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
          <YAxis unit=" Mbps" tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: number) => `${v} Mbps`} />
          <Legend />
          <Line
            type="monotone"
            dataKey="descarga"
            name="Descarga"
            stroke="#3b82f6"
            dot={false}
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="carga"
            name="Carga"
            stroke="#f97316"
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>

      <div style={{ marginTop: '1.5rem' }}>
        <h3
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: '0.75rem',
          }}
        >
          Velocidad actual
        </h3>
        <div className={styles.summaryCards}>
          <div className={styles.card}>
            <span className={styles.cardLabel}>Descarga</span>
            <span className={styles.cardValue}>{CURRENT_SPEED.descarga} Mbps</span>
          </div>
          <div className={styles.card}>
            <span className={styles.cardLabel}>Carga</span>
            <span className={styles.cardValue}>{CURRENT_SPEED.carga} Mbps</span>
          </div>
        </div>
      </div>
    </div>
  );
}
