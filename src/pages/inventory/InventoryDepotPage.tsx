import { useState } from 'react';
import { useDepotStock } from '@/hooks/useDepotStock';
import { Can } from '@/components/auth/Can';
import { AddDepotAssetModal } from '@/components/inventory/AddDepotAssetModal';
import { LoadDepotMaterialModal } from '@/components/inventory/LoadDepotMaterialModal';
import type { DepotAssetDTO, DepotMaterialDTO } from '@/types/depot';
import styles from './InventoryDepotPage.module.css';

/**
 * Read + write view of the depot (DEPOSITO): available equipment and stocked
 * materials (EPIC #38, Wave 3 → depot stock entry).
 *
 * Operators with `inventory.write` can:
 * - "Agregar equipo" → `AddDepotAssetModal` (POST /api/inventory/depot/assets)
 * - "Cargar material" → `LoadDepotMaterialModal` (POST /api/inventory/depot/materials)
 *
 * Empty states invite to load stock when `inventory.write` is held; remain
 * informational-only otherwise.
 */
export default function InventoryDepotPage() {
  const { data, isLoading, isError } = useDepotStock();

  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [materialModalOpen, setMaterialModalOpen] = useState(false);

  const assets = data?.assets ?? [];
  const materials = data?.materials ?? [];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.breadcrumb}>Inventario</p>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Depósito</h1>
          <Can permission="inventory.write">
            <div className={styles.headerActions}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => setAssetModalOpen(true)}
              >
                Agregar equipo
              </button>
              <button
                type="button"
                className={styles.actionBtnPrimary}
                onClick={() => setMaterialModalOpen(true)}
              >
                Cargar material
              </button>
            </div>
          </Can>
        </div>
        <p className={styles.subtitle}>
          Equipos y materiales disponibles hoy en el depósito.
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
          <Can
            permission="inventory.write"
            fallback={
              <EmptyState
                icon={<EquipmentIcon />}
                title="Sin equipos en el depósito"
                body="Acá vas a ver los equipos disponibles cuando se registre stock en el depósito."
              />
            }
          >
            <EmptyState
              icon={<EquipmentIcon />}
              title="Sin equipos en el depósito"
              body="El depósito está vacío. Cargá equipos o materiales para empezar."
              action={
                <button
                  type="button"
                  className={styles.emptyAction}
                  onClick={() => setAssetModalOpen(true)}
                >
                  Agregar equipo
                </button>
              }
            />
          </Can>
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
          <Can
            permission="inventory.write"
            fallback={
              <EmptyState
                icon={<MaterialIcon />}
                title="Sin materiales en stock"
                body="El stock de materiales va a aparecer acá cuando se registren existencias en el depósito."
              />
            }
          >
            <EmptyState
              icon={<MaterialIcon />}
              title="Sin materiales en stock"
              body="El depósito está vacío. Cargá equipos o materiales para empezar."
              action={
                <button
                  type="button"
                  className={styles.emptyAction}
                  onClick={() => setMaterialModalOpen(true)}
                >
                  Cargar material
                </button>
              }
            />
          </Can>
        ) : (
          <ul className={styles.materialList}>
            {materials.map(material => (
              <MaterialRow key={material.id} material={material} />
            ))}
          </ul>
        )}
      </section>

      <AddDepotAssetModal
        open={assetModalOpen}
        onClose={() => setAssetModalOpen(false)}
      />
      <LoadDepotMaterialModal
        open={materialModalOpen}
        onClose={() => setMaterialModalOpen(false)}
      />
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
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon} aria-hidden="true">
        {icon}
      </span>
      <p className={styles.emptyTitle}>{title}</p>
      <p className={styles.emptyBody}>{body}</p>
      {action && <div className={styles.emptyActionWrap}>{action}</div>}
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
