import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTechnicianStock } from '@/hooks/useTechnicianStock';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { AssignStockModal } from '@/components/inventory/AssignStockModal';
import type { DepotAssetDTO, DepotMaterialDTO } from '@/types/depot';
import styles from './InventoryTechnicianPage.module.css';

/**
 * What a single field technician currently holds: equipment and materials sitting
 * at their TECNICO location (EPIC #38, Wave 5a). The technician id comes from the
 * URL. There is no technician picker yet (no list endpoint) — the page is reached
 * directly by id; a nav entry point is deferred to W5b.
 *
 * In production a technician starts EMPTY, so the contextual empty states ARE the
 * primary UX. The "Asignar stock" action (gated on `inventory.write`) picks items
 * from the depot and issues them here; on success the sections refetch.
 */
export default function InventoryTechnicianPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { can } = useMyPermissions();
  const { data, isLoading, isError } = useTechnicianStock(id);
  const [assigning, setAssigning] = useState(false);

  const canIssue = can('inventory.write');
  const assets = data?.assets ?? [];
  const materials = data?.materials ?? [];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headingGroup}>
          <p className={styles.breadcrumb}>Inventario</p>
          <h1 className={styles.title}>Stock del técnico</h1>
          <p className={styles.subtitle}>
            Equipos y materiales que tiene asignados este técnico ahora mismo.
          </p>
        </div>
        {canIssue && (
          <button
            type="button"
            className={styles.assignBtn}
            onClick={() => setAssigning(true)}
          >
            <PlusIcon />
            Asignar stock
          </button>
        )}
      </header>

      {isError && (
        <p className={styles.errorBanner} role="alert">
          No pudimos cargar el stock del técnico. Reintentá en unos segundos.
        </p>
      )}

      <section className={styles.section} aria-labelledby="tech-assets-heading">
        <div className={styles.sectionHead}>
          <h2 id="tech-assets-heading" className={styles.sectionTitle}>
            Equipos asignados
          </h2>
          {assets.length > 0 && <span className={styles.count}>{assets.length}</span>}
        </div>

        {isLoading ? (
          <p className={styles.loading}>Cargando equipos…</p>
        ) : assets.length === 0 ? (
          <EmptyState
            icon={<EquipmentIcon />}
            title="Sin equipos asignados"
            body={
              canIssue
                ? 'Este técnico todavía no tiene equipos. Usá “Asignar stock” para entregarle equipos desde el depósito.'
                : 'Este técnico todavía no tiene equipos. Se le asignan desde el depósito por una persona con permiso de inventario.'
            }
          />
        ) : (
          <ul className={styles.assetList}>
            {assets.map(asset => (
              <AssetRow key={asset.id} asset={asset} />
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-labelledby="tech-materials-heading">
        <div className={styles.sectionHead}>
          <h2 id="tech-materials-heading" className={styles.sectionTitle}>
            Materiales
          </h2>
          {materials.length > 0 && <span className={styles.count}>{materials.length}</span>}
        </div>

        {isLoading ? (
          <p className={styles.loading}>Cargando materiales…</p>
        ) : materials.length === 0 ? (
          <EmptyState
            icon={<MaterialIcon />}
            title="Sin materiales asignados"
            body={
              canIssue
                ? 'No hay materiales asignados. Asignále cable, conectores u otros insumos desde el depósito.'
                : 'No hay materiales asignados. Se asignan desde el depósito por una persona con permiso de inventario.'
            }
          />
        ) : (
          <ul className={styles.materialList}>
            {materials.map(material => (
              <MaterialRow key={material.id} material={material} />
            ))}
          </ul>
        )}
      </section>

      {canIssue && (
        <AssignStockModal
          open={assigning}
          technicianId={id}
          onClose={() => setAssigning(false)}
        />
      )}
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

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
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
