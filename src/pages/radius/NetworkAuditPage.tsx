import { useState } from 'react';
import RadiusLogsPage from './RadiusLogsPage';
import Ne8000AuditPage from './Ne8000AuditPage';
import RadiusAuthErrorsPage from './RadiusAuthErrorsPage';
import PppoeNasMovesPage from './PppoeNasMovesPage';
import styles from './NetworkAuditPage.module.css';

/**
 * Contenedor "Auditoría / Logs RADIUS" — agrupa en una sola página, con tabs
 * internos por estado local, las vistas read-only de auditoría de red:
 * Logs RADIUS + Auditoría NE8000 + Errores de auth + Movimientos NAS.
 *
 * Decisión ui-ux (documentada): NO se agrega un <h1> contenedor.
 * Cada página interna ya trae su propio <h1> ("Logs RADIUS" / "Auditoría NE8000"),
 * así que un h1 extra sería un heading redundante visible en simultáneo con el de
 * la página activa. La tabbar (botones con aria-pressed + focus visible) hace de
 * navegación; eso evita ruido de headings duplicados en tests y en lectores de
 * pantalla, manteniendo una sola jerarquía de título por vista.
 */

type AuditTab = 'logs' | 'ne8000' | 'authErrors' | 'nasMoves';

const TABS: { key: AuditTab; label: string }[] = [
  { key: 'logs', label: 'Logs RADIUS' },
  { key: 'ne8000', label: 'Auditoría NE8000' },
  { key: 'authErrors', label: 'Errores de auth' },
  { key: 'nasMoves', label: 'Movimientos NAS' },
];

export default function NetworkAuditPage() {
  const [activeTab, setActiveTab] = useState<AuditTab>('logs');

  return (
    <div className={styles.page}>
      <div className={styles.tabbar} role="tablist" aria-label="Auditoría / Logs RADIUS">
        {TABS.map(tab => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              aria-pressed={active}
              className={`${styles.tab} ${active ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className={styles.panel}>
        {activeTab === 'logs' && <RadiusLogsPage />}
        {activeTab === 'ne8000' && <Ne8000AuditPage />}
        {activeTab === 'authErrors' && <RadiusAuthErrorsPage />}
        {activeTab === 'nasMoves' && <PppoeNasMovesPage />}
      </div>
    </div>
  );
}
