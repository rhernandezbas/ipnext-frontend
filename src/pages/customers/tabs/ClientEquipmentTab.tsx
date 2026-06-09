import { useMemo } from 'react';
import { useClientInstalledItems } from '@/hooks/useServiceInventory';
import type { ClientInstalledItem, InstalledItemStatus } from '@/types/serviceInventory';
import styles from './ClientEquipmentTab.module.css';

interface Props {
  clientId: string;
  /** Defer the query until the tab is actually shown. */
  active?: boolean;
}

const STATUS_LABEL: Record<InstalledItemStatus, string> = {
  active: 'active',
  removed: 'removed',
  replaced: 'replaced',
};

interface ContractGroup {
  contractId: string;
  plan: string;
  type: string;
  items: ClientInstalledItem[];
}

function groupByContract(items: ClientInstalledItem[]): ContractGroup[] {
  const order: string[] = [];
  const map = new Map<string, ContractGroup>();
  for (const it of items) {
    let g = map.get(it.contractId);
    if (!g) {
      g = { contractId: it.contractId, plan: it.contractPlan, type: it.contractType, items: [] };
      map.set(it.contractId, g);
      order.push(it.contractId);
    }
    g.items.push(it);
  }
  return order.map(id => map.get(id)!);
}

function dash(v: string | null): string {
  return v && v.trim() !== '' ? v : '—';
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-AR');
}

/**
 * "Equipos" — aggregated, read-only view of every device installed across all
 * of a client's contracts (EPIC #38 W2). Grouped by contract; active equipment
 * reads at full strength, removed/replaced rows are dimmed so the live fleet
 * stands out at a glance. No mutations: per-contract editing stays in the
 * Contratos tab.
 */
export function ClientEquipmentTab({ clientId, active = true }: Props) {
  const { data, isLoading } = useClientInstalledItems(clientId, active);
  const groups = useMemo(() => groupByContract(data ?? []), [data]);

  if (isLoading) {
    return <p className={styles.muted}>Cargando equipos…</p>;
  }

  if (groups.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>Sin equipos instalados</p>
        <p className={styles.emptyHint}>
          Este cliente no tiene equipos registrados en ninguno de sus contratos.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {groups.map(group => (
        <section key={group.contractId} className={styles.group} role="group" aria-label={`Contrato ${group.plan}`}>
          <header className={styles.groupHeader}>
            <span className={styles.plan}>{group.plan}</span>
            <span className={styles.type}>{group.type}</span>
            <span className={styles.count}>
              {group.items.length} {group.items.length === 1 ? 'equipo' : 'equipos'}
            </span>
          </header>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>SN</th>
                  <th>MAC</th>
                  <th>Modelo</th>
                  <th>Estado</th>
                  <th>Origen</th>
                  <th>Confirmado</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map(it => (
                  <tr key={it.id} data-status={it.status} className={it.status !== 'active' ? styles.dimmed : undefined}>
                    <td><span className={styles.tag}>{it.type}</span></td>
                    <td className={styles.mono}>{dash(it.serialNumber)}</td>
                    <td className={styles.mono}>{dash(it.mac)}</td>
                    <td>{dash(it.model)}</td>
                    <td>
                      <span className={`${styles.badge} ${it.status === 'active' ? styles.badgeActive : styles.badgeMuted}`}>
                        {STATUS_LABEL[it.status] ?? it.status}
                      </span>
                    </td>
                    <td className={styles.source}>{it.source}</td>
                    <td className={styles.muted}>{formatDate(it.confirmedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
