import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Tabs } from '@/components/molecules/Tabs/Tabs';
import { Pagination } from '@/components/molecules/Pagination/Pagination';
import { useInventoryOverview, useInventoryMovements, useInventoryAlerts } from '@/hooks/useInventoryDashboard';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { NoPermissionPage } from '@/components/auth/NoPermissionPage';
import type { InventoryOverviewDTO, OverviewGroupDTO, MovementRowDTO, LowStockAlertDTO, MovementFilters, MovementType } from '@/types/inventoryDashboard';
import { formatDateShort } from '@/utils/formatDate';
import styles from './InventoryDashboardPage.module.css';

// ─── Ubicaciones tab ────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  DEPOSITO: 'Depósito',
  CLIENTE: 'Clientes',
  TECNICO: 'Técnicos',
  CAMIONETA: 'Camionetas',
};

function DepositoSection({ group }: { group: OverviewGroupDTO }) {
  if (group.locationCount === 0) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Depósito</h3>
        </div>
        <p className={styles.emptyMuted}>El depósito no tiene stock cargado</p>
      </section>
    );
  }
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Depósito</h3>
        <span className={styles.sectionMeta}>{group.totalAssets} equipos · {group.totalMaterialQty} materiales</span>
      </div>
      <div className={styles.depositoCard}>
        {group.locations.map(loc => (
          <div key={loc.locationId} className={styles.locationRow}>
            <span className={styles.locationLabel}>{loc.label ?? 'Depósito'}</span>
            <span className={styles.locationStat}>{loc.assetCount} equipos</span>
            <span className={styles.locationStat}>{loc.materialQty} materiales</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ClienteSection({ group }: { group: OverviewGroupDTO }) {
  if (group.locationCount === 0) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Clientes</h3>
        </div>
        <p className={styles.emptyMuted}>Sin stock</p>
      </section>
    );
  }
  // Collapse: summary row only — no 53 individual cards
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Clientes</h3>
      </div>
      <div className={styles.summaryRow}>
        <span>{group.locationCount} clientes con stock</span>
        <span className={styles.locationStat}>{group.totalAssets} equipos</span>
        <span className={styles.locationStat}>{group.totalMaterialQty} materiales</span>
      </div>
    </section>
  );
}

/**
 * Generic section for TECNICO and CAMIONETA groups.
 *
 * `linkTo`: destination for the "Ver todos" header link.
 *   - TECNICO rows link to /admin/inventory/technicians (the list page).
 *     The OverviewLocationDTO only carries `locationId` (StockLocation id),
 *     NOT the technician's user id, so we cannot build direct per-technician
 *     links here. A follow-up BE task is needed to extend OverviewLocationDTO
 *     with technicianId/vehicleId. Until then, we link to the list.
 *   - CAMIONETA rows link to /admin/inventory/settings#camionetas (config).
 */
function GenericSection({ group, linkTo }: { group: OverviewGroupDTO; linkTo?: string }) {
  const label = TYPE_LABELS[group.type] ?? group.type;
  if (group.locationCount === 0) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>{label}</h3>
          {linkTo && (
            <Link to={linkTo} className={styles.sectionLink}>Ver todos</Link>
          )}
        </div>
        <p className={styles.emptyMuted}>Sin stock</p>
      </section>
    );
  }
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>{label}</h3>
        <span className={styles.sectionMeta}>{group.locationCount} ubicaciones · {group.totalAssets} equipos · {group.totalMaterialQty} materiales</span>
        {linkTo && (
          <Link to={linkTo} className={styles.sectionLink}>Ver todos</Link>
        )}
      </div>
      <div className={styles.locationList}>
        {group.locations.map(loc => (
          <div key={loc.locationId} className={styles.locationRow}>
            <span className={styles.locationLabel}>{loc.label ?? '—'}</span>
            <span className={styles.locationStat}>{loc.assetCount} equipos</span>
            <span className={styles.locationStat}>{loc.materialQty} materiales</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function UbicacionesTab({ overview }: { overview: InventoryOverviewDTO }) {
  const byType = Object.fromEntries(overview.groups.map(g => [g.type, g]));
  const deposito = byType['DEPOSITO'];
  const cliente = byType['CLIENTE'];
  const tecnico = byType['TECNICO'];
  const camioneta = byType['CAMIONETA'];

  return (
    <div className={styles.tabContent}>
      {deposito && <DepositoSection group={deposito} />}
      {cliente && <ClienteSection group={cliente} />}
      {/* TECNICO: OverviewLocationDTO lacks technicianId — link to list, not per-id.
          Follow-up BE task needed to extend DTO with technicianId. */}
      {tecnico && <GenericSection group={tecnico} linkTo="/admin/inventory/technicians" />}
      {/* CAMIONETA: similarly no vehicleId in DTO — link to settings#camionetas.
          Follow-up BE task needed to extend DTO with vehicleId. */}
      {camioneta && <GenericSection group={camioneta} linkTo="/admin/inventory/settings#camionetas" />}
    </div>
  );
}

// ─── Movimientos tab ─────────────────────────────────────────────────────────

const MOVEMENT_TYPES: MovementType[] = ['ISSUE', 'TRANSFER', 'INSTALL', 'RETURN', 'CONSUME', 'ADJUST'];

const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  ISSUE: 'Despacho',
  TRANSFER: 'Transferencia',
  INSTALL: 'Instalación',
  RETURN: 'Devolución',
  CONSUME: 'Consumo',
  ADJUST: 'Ajuste',
};

function MovementTypeBadge({ type }: { type: MovementType }) {
  return <span className={`${styles.badge} ${styles[`badge${type}`]}`}>{MOVEMENT_TYPE_LABELS[type]}</span>;
}

interface MovimientosTabProps {
  filters: MovementFilters;
  onFiltersChange: (f: MovementFilters) => void;
  page: number;
  onPageChange: (p: number) => void;
}

function MovimientosTab({ filters, onFiltersChange, page, onPageChange }: MovimientosTabProps) {
  const { data, isLoading } = useInventoryMovements(filters, page);
  const movements: MovementRowDTO[] = data?.items ?? [];
  const total = data?.total ?? 0;
  const limit = data?.limit ?? 25;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  function setFilter<K extends keyof MovementFilters>(key: K, value: MovementFilters[K]) {
    onFiltersChange({ ...filters, [key]: value || undefined });
    onPageChange(1);
  }

  return (
    <div className={styles.tabContent}>
      {/* Filter bar */}
      <div className={styles.filterBar}>
        <select
          className={styles.filterSelect}
          value={filters.type ?? ''}
          onChange={e => setFilter('type', e.target.value as MovementType || undefined)}
          aria-label="Tipo de movimiento"
        >
          <option value="">Todos los tipos</option>
          {MOVEMENT_TYPES.map(t => (
            <option key={t} value={t}>{MOVEMENT_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <input
          className={styles.filterInput}
          type="date"
          value={filters.dateFrom ?? ''}
          onChange={e => setFilter('dateFrom', e.target.value || undefined)}
          aria-label="Desde"
          title="Desde"
        />
        <input
          className={styles.filterInput}
          type="date"
          value={filters.dateTo ?? ''}
          onChange={e => setFilter('dateTo', e.target.value || undefined)}
          aria-label="Hasta"
          title="Hasta"
        />
        <input
          className={styles.filterInput}
          type="text"
          value={filters.locationId ?? ''}
          onChange={e => setFilter('locationId', e.target.value || undefined)}
          placeholder="ID ubicación"
          aria-label="ID ubicación"
        />
        <input
          className={styles.filterInput}
          type="text"
          value={filters.materialCatalogId ?? ''}
          onChange={e => setFilter('materialCatalogId', e.target.value || undefined)}
          placeholder="ID material"
          aria-label="ID material"
        />
        <input
          className={styles.filterInput}
          type="text"
          value={filters.taskId ?? ''}
          onChange={e => setFilter('taskId', e.target.value || undefined)}
          placeholder="ID tarea"
          aria-label="ID tarea"
        />
      </div>

      {isLoading ? (
        <p className={styles.loading}>Cargando movimientos…</p>
      ) : movements.length === 0 ? (
        <p className={styles.emptyState}>Sin movimientos para estos filtros</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Material / Equipo</th>
                <th>Cant.</th>
                <th>Desde</th>
                <th>Hacia</th>
                <th>Tarea</th>
                <th>Origen</th>
              </tr>
            </thead>
            <tbody>
              {movements.map(m => (
                <tr key={m.id}>
                  <td>{formatDateShort(m.occurredAt)}</td>
                  <td><MovementTypeBadge type={m.type} /></td>
                  <td>{m.materialName ?? m.assetId ?? '—'}</td>
                  <td>{m.qty ?? '—'}</td>
                  <td>{m.fromLocationLabel ?? '—'}</td>
                  <td>{m.toLocationLabel ?? '—'}</td>
                  <td>{m.taskSeq != null ? `#${m.taskSeq}` : '—'}</td>
                  <td>{m.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}

// ─── Alertas tab ─────────────────────────────────────────────────────────────

function AlertasTab({ alerts, isLoading }: { alerts: LowStockAlertDTO[]; isLoading: boolean }) {
  if (isLoading) {
    return <p className={styles.loading}>Cargando alertas…</p>;
  }

  if (alerts.length === 0) {
    return (
      <div className={styles.tabContent}>
        <p className={styles.emptyState}>Sin alertas de stock bajo</p>
        <p className={styles.emptyHint}>
          Configurá un stock mínimo en los materiales para ver alertas
        </p>
      </div>
    );
  }

  return (
    <div className={styles.tabContent}>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Material</th>
              <th>Etiqueta</th>
              <th>Unidad</th>
              <th>Stock actual</th>
              <th>Stock mínimo</th>
              <th>Déficit</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map(a => (
              <tr key={a.materialCatalogId}>
                <td>{a.name}</td>
                <td>{a.label ?? '—'}</td>
                <td>{a.unit ?? '—'}</td>
                <td>{a.totalQty}</td>
                <td>{a.minStock}</td>
                <td className={styles.deficit}>{a.deficit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const TAB_IDS = ['ubicaciones', 'movimientos', 'alertas'];

export default function InventoryDashboardPage() {
  const { can, isLoading: permsLoading } = useMyPermissions();

  const [activeTab, setActiveTab] = useState('ubicaciones');
  const mountedIds = useRef<Set<string>>(new Set(['ubicaciones']));

  // Movimientos state (filters + page) lifted to page level so they survive tab switches
  const [movFilters, setMovFilters] = useState<MovementFilters>({});
  const [movPage, setMovPage] = useState(1);

  const { data: overviewData, isLoading: overviewLoading } = useInventoryOverview();
  const { data: alertsData, isLoading: alertsLoading } = useInventoryAlerts();

  useEffect(() => {
    mountedIds.current.add(activeTab);
  }, [activeTab]);

  // Permission gate
  if (!permsLoading && !can('inventory.read')) {
    return <NoPermissionPage />;
  }

  const overview: InventoryOverviewDTO = overviewData ?? {
    groups: [
      { type: 'DEPOSITO', locationCount: 0, totalAssets: 0, totalMaterialQty: 0, locations: [] },
      { type: 'CLIENTE', locationCount: 0, totalAssets: 0, totalMaterialQty: 0, locations: [] },
      { type: 'TECNICO', locationCount: 0, totalAssets: 0, totalMaterialQty: 0, locations: [] },
      { type: 'CAMIONETA', locationCount: 0, totalAssets: 0, totalMaterialQty: 0, locations: [] },
    ],
  };
  const alerts: LowStockAlertDTO[] = alertsData ?? [];
  const alertCount = alerts.length;

  const TABS = [
    {
      id: 'ubicaciones',
      label: 'Ubicaciones',
      content: overviewLoading ? (
        <p className={styles.loading}>Cargando ubicaciones…</p>
      ) : (
        <UbicacionesTab overview={overview} />
      ),
    },
    {
      id: 'movimientos',
      label: 'Movimientos',
      content: (
        <MovimientosTab
          filters={movFilters}
          onFiltersChange={setMovFilters}
          page={movPage}
          onPageChange={setMovPage}
        />
      ),
    },
    {
      id: 'alertas',
      label: alertCount > 0 ? `Alertas (${alertCount})` : 'Alertas',
      content: <AlertasTab alerts={alerts} isLoading={alertsLoading} />,
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>Inventario /</span>
          <h1 className={styles.title}>Dashboard</h1>
        </div>
      </div>

      <Tabs
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={id => {
          if (TAB_IDS.includes(id)) setActiveTab(id);
        }}
        mountMode="lazy"
        mountedIds={mountedIds.current}
        size="compact"
      />
    </div>
  );
}
