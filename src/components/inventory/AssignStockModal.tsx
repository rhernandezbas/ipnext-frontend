import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDepotStock } from '@/hooks/useDepotStock';
import { useIssueStock } from '@/hooks/useTechnicianStock';
import type { IssueStockItem } from '@/types/technician';
import styles from './AssignStockModal.module.css';

interface AssignStockModalProps {
  open: boolean;
  technicianId: string;
  onClose: () => void;
}

/**
 * "Asignar stock" — assign equipment and materials from the depot to a technician
 * (EPIC #38, Wave 5a). The picker is sourced from the depot stock (Wave 3
 * `useDepotStock`): assets are discrete, so they're checkboxes; materials are
 * quantities, so each gets a number input bounded by what the depot holds.
 *
 * Submit packs the selection into the `items[]` issue payload and calls
 * `useIssueStock`, which invalidates both the technician and depot stock on
 * success. The modal closes once the mutation resolves.
 */
export function AssignStockModal({ open, technicianId, onClose }: AssignStockModalProps) {
  const { data, isLoading } = useDepotStock();
  const issue = useIssueStock(technicianId);

  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [materialQty, setMaterialQty] = useState<Record<string, number>>({});

  // Reset the form every time the modal opens so a prior selection never leaks in.
  useEffect(() => {
    if (open) {
      setSelectedAssetIds(new Set());
      setMaterialQty({});
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const assets = data?.assets ?? [];
  const materials = data?.materials ?? [];
  const depotEmpty = !isLoading && assets.length === 0 && materials.length === 0;

  const items = useMemo<IssueStockItem[]>(() => {
    const out: IssueStockItem[] = [];
    for (const id of selectedAssetIds) out.push({ assetId: id });
    for (const [materialCatalogId, qty] of Object.entries(materialQty)) {
      if (qty > 0) out.push({ materialCatalogId, qty });
    }
    return out;
  }, [selectedAssetIds, materialQty]);

  if (!open) return null;

  function toggleAsset(id: string) {
    setSelectedAssetIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setQty(materialCatalogId: string, raw: string, max: number) {
    const parsed = Math.floor(Number(raw));
    setMaterialQty(prev => {
      const next = { ...prev };
      if (!Number.isFinite(parsed) || parsed <= 0) {
        delete next[materialCatalogId];
      } else {
        next[materialCatalogId] = Math.min(parsed, max);
      }
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0 || issue.isPending) return;
    issue.mutate({ items }, { onSuccess: () => onClose() });
  }

  const canSubmit = items.length > 0 && !issue.isPending;

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-stock-title"
        onSubmit={handleSubmit}
      >
        <header className={styles.head}>
          <h2 id="assign-stock-title" className={styles.title}>
            Asignar stock
          </h2>
          <p className={styles.subtitle}>
            Elegí equipos y materiales del depósito para entregarle a este técnico.
          </p>
        </header>

        <div className={styles.body}>
          {isLoading ? (
            <p className={styles.loading}>Cargando stock del depósito…</p>
          ) : depotEmpty ? (
            <p className={styles.depotEmpty}>
              No hay stock en el depósito para asignar. Cargá equipos o materiales al
              depósito antes de asignar.
            </p>
          ) : (
            <>
              {assets.length > 0 && (
                <fieldset className={styles.group}>
                  <legend className={styles.groupLabel}>Equipos</legend>
                  <ul className={styles.list}>
                    {assets.map(asset => {
                      const label = asset.deviceTypeLabel ?? asset.deviceTypeName ?? '';
                      return (
                        <li key={asset.id} className={styles.assetItem}>
                          <label className={styles.assetLabel}>
                            <input
                              type="checkbox"
                              className={styles.checkbox}
                              checked={selectedAssetIds.has(asset.id)}
                              onChange={() => toggleAsset(asset.id)}
                              aria-label={`${asset.serialNumber} ${label}`}
                            />
                            <span className={styles.assetMain}>
                              <span className={styles.serial}>{asset.serialNumber}</span>
                              <span className={styles.assetType}>{label}</span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </fieldset>
              )}

              {materials.length > 0 && (
                <fieldset className={styles.group}>
                  <legend className={styles.groupLabel}>Materiales</legend>
                  <ul className={styles.list}>
                    {materials.map(material => {
                      const name = material.label ?? material.name ?? '';
                      const value = materialQty[material.materialCatalogId] ?? '';
                      return (
                        <li key={material.id} className={styles.materialItem}>
                          <span className={styles.materialMain}>
                            <span className={styles.materialName}>{name}</span>
                            <span className={styles.materialAvail}>
                              {material.qty} disp.
                              {material.unit ? ` · ${material.unit}` : ''}
                            </span>
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={material.qty}
                            step={1}
                            inputMode="numeric"
                            className={styles.qtyInput}
                            value={value}
                            placeholder="0"
                            aria-label={`Cantidad de ${name}`}
                            onChange={e =>
                              setQty(material.materialCatalogId, e.target.value, material.qty)
                            }
                          />
                        </li>
                      );
                    })}
                  </ul>
                </fieldset>
              )}
            </>
          )}
        </div>

        <footer className={styles.actions}>
          <button
            type="button"
            className={styles.cancel}
            onClick={onClose}
            disabled={issue.isPending}
          >
            Cancelar
          </button>
          <button type="submit" className={styles.submit} disabled={!canSubmit}>
            {issue.isPending ? 'Asignando…' : 'Asignar'}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
