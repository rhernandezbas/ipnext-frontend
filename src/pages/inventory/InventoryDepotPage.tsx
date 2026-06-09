import { useDepotStock } from '@/hooks/useDepotStock';
import type { DepotAssetDTO, DepotMaterialDTO } from '@/types/depot';
import styles from './InventoryDepotPage.module.css';

/**
 * Read-only view of what's sitting in the depot (DEPOSITO) right now: available
 * equipment and stocked materials (EPIC #38, Wave 3). No mutations — movements
 * arrive in Wave 4.
 *
 * In production the depot is currently empty, so the two contextual empty states
 * are the primary UX. Each one explains *why* the section is empty and what will
 * fill it, rather than a generic "no data" line.
 */
export default function InventoryDepotPage() {
  const { data, isLoading, isError } = useDepotStock();

  const assets = data?.assets ?? [];
  const materials = data?.materials ?? [];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.breadcrumb}>Inventario</p>
        <h1 className={styles.title}>Depósito</h1>
        <p className={styles.subtitle}>
          Equipos y materiales disponibles hoy en el depósito. Solo lectura.
        </p>
      </header>

      {isError && (
        <p className={styles.errorBanner} role="alert">
          No pudimos cargar el stock del depósito. Reintentá en unos segundos.
        </p>
      )}

      <section className={styles.section} aria-labelledby="depot-assets-heading">
        <div className={styles.sectionHead}>
          <h2 id="depot-assets-heading" className={styles.sectionTitle}>
            Equipos disponibles
          </h2>
          {assets.length > 0 && (
            <span className={styles.count}>{assets.length}</span>
          )}
        </div>

        {isLoading ? (
          <p className={styles.loading}>Cargando equipos…</p>
        ) : assets.length === 0 ? (
          <EmptyState
            icon={<EquipmentIcon />}
            title="Sin equipos en el depósito"
            body="Acá vas a ver los equipos disponibles a medida que vuelvan al depósito por retiros desde una tarea. Esa devolución llega con los movimientos de la Wave 4."
          />
        ) : (
          <ul className={styles.assetList}>
            {assets.map(asset => (
              <AssetRow key={asset.id} asset={asset} />
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-labelledby="depot-materials-heading">
        <div className={styles.sectionHead}>
          <h2 id="depot-materials-heading" className={styles.sectionTitle}>
            Materiales
          </h2>
          {materials.length > 0 && (
            <span className={styles.count}>{materials.length}</span>
          )}
        </div>

        {isLoading ? (
          <p className={styles.loading}>Cargando materiales…</p>
        ) : materials.length === 0 ? (
          <EmptyState
            icon={<MaterialIcon />}
            title="Sin materiales en stock"
            body="El stock de materiales va a aparecer acá cuando se cargue stock al depósito. Por ahora no hay existencias registradas."
          />
        ) : (
          <ul className={styles.materialList}>
            {materials.map(material => (
              <MaterialRow key={material.id} material={material} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AssetRow({ asset }: { asset: DepotAssetDTO }) {
  const typeLabel = asset.deviceTypeLabel ?? asset.deviceTypeName;
  return (
    <li className={styles.assetRow}>
      <div className={styles.assetMain}>
        <span className={styles.serial}>{asset.serialNumber}</span>
        <span className={styles.assetType}>{typeLabel}</span>
      </div>
      <div className={styles.assetMeta}>
        {asset.mac && <span className={styles.mac}>{asset.mac}</span>}
        <span className={styles.statusPill}>Disponible</span>
      </div>
    </li>
  );
}

function MaterialRow({ material }: { material: DepotMaterialDTO }) {
  const name = material.label ?? material.name;
  return (
    <li className={styles.materialRow}>
      <span className={styles.materialName}>{name}</span>
      <span className={styles.materialQty}>
        {material.qty}
        {material.unit && <span className={styles.materialUnit}> {material.unit}</span>}
      </span>
    </li>
  );
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon} aria-hidden="true">
        {icon}
      </span>
      <p className={styles.emptyTitle}>{title}</p>
      <p className={styles.emptyBody}>{body}</p>
    </div>
  );
}

function EquipmentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
      <rect x="3" y="4" width="18" height="6" rx="1.5" />
      <rect x="3" y="14" width="18" height="6" rx="1.5" />
      <path d="M7 7h.01M7 17h.01" />
    </svg>
  );
}

function MaterialIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />
    </svg>
  );
}
