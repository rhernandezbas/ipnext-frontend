import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMaterialTypes } from '@/hooks/useMaterialTypes';
import { useLoadDepotMaterial } from '@/hooks/useDepotEntry';
import type { LoadDepotMaterialResponse } from '@/api/depotEntry.api';
import styles from './LoadDepotMaterialModal.module.css';

interface LoadDepotMaterialModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * "Cargar material" — load material quantity into the depot (EPIC #38 depot stock entry).
 *
 * The operator picks a material from the catalog, enters a quantity > 0.
 * On success it shows the new total qty (from the BE response) as a confirmation
 * before closing. On 404 MATERIAL_NOT_FOUND it shows a clear error.
 */
export function LoadDepotMaterialModal({ open, onClose }: LoadDepotMaterialModalProps) {
  const { data: materialTypes, isLoading: loadingTypes } = useMaterialTypes();
  const loadMaterial = useLoadDepotMaterial();

  const [materialCatalogId, setMaterialCatalogId] = useState('');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<LoadDepotMaterialResponse | null>(null);

  const selectRef = useRef<HTMLSelectElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setMaterialCatalogId('');
      setQty('');
      setNote('');
      setLocalError(null);
      setSuccessData(null);
      loadMaterial.reset();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus the select when it opens
  useEffect(() => {
    if (open) {
      setTimeout(() => selectRef.current?.focus(), 50);
    }
  }, [open]);

  // Body scroll lock + Escape
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

  if (!open) return null;

  const activeTypes = materialTypes?.filter(mt => mt.active) ?? [];
  const selectedType = activeTypes.find(mt => mt.id === materialCatalogId) ?? null;

  // FIX 4: use parseFloat so fractional quantities are accepted (e.g. 12.5 m of cable).
  // parseInt would silently truncate '12.5' → 12, losing precision for decimal materials.
  const parsedQty = parseFloat(qty);
  const qtyValid = Number.isFinite(parsedQty) && parsedQty > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);

    if (!materialCatalogId) {
      setLocalError('Seleccioná un material del catálogo.');
      return;
    }
    if (!qtyValid) {
      setLocalError('La cantidad debe ser un número mayor a 0.');
      return;
    }
    if (loadMaterial.isPending) return;

    loadMaterial.mutate(
      {
        materialCatalogId,
        qty: parsedQty,
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      {
        onSuccess: (data) => {
          setSuccessData(data);
          // Auto-close after a short confirmation window
          setTimeout(() => onClose(), 1400);
        },
        onError: (err: unknown) => {
          const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
          if (code === 'MATERIAL_NOT_FOUND') {
            setLocalError('No se encontró ese material en el catálogo. Actualizá la página y reintentá.');
          } else {
            setLocalError('Ocurrió un error al cargar el material. Reintentá.');
          }
        },
      },
    );
  }

  const canSubmit = !loadMaterial.isPending && !!materialCatalogId && qtyValid;

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
        aria-labelledby="load-depot-material-title"
        onSubmit={handleSubmit}
      >
        <header className={styles.head}>
          <h2 id="load-depot-material-title" className={styles.title}>
            Cargar material
          </h2>
          <p className={styles.subtitle}>
            Agregá stock de un material al depósito.
          </p>
        </header>

        <div className={styles.body}>
          {/* Material select */}
          <div className={styles.field}>
            <label htmlFor="load-material-type" className={styles.label}>
              Material <span className={styles.req} aria-hidden="true">*</span>
            </label>
            {loadingTypes ? (
              <p className={styles.loadingTypes}>Cargando materiales…</p>
            ) : (
              <select
                id="load-material-type"
                ref={selectRef}
                className={styles.select}
                value={materialCatalogId}
                onChange={e => setMaterialCatalogId(e.target.value)}
                disabled={loadMaterial.isPending || !!successData}
                required
              >
                <option value="">— Elegí un material —</option>
                {activeTypes.map(mt => (
                  <option key={mt.id} value={mt.id}>
                    {mt.label ?? mt.name}
                    {mt.unit ? ` (${mt.unit})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Quantity */}
          <div className={styles.field}>
            <label htmlFor="load-material-qty" className={styles.label}>
              Cantidad <span className={styles.req} aria-hidden="true">*</span>
              {selectedType?.unit && (
                <span className={styles.unit}> en {selectedType.unit}</span>
              )}
            </label>
            <input
              id="load-material-qty"
              type="number"
              min={0.0001}
              step="any"
              inputMode="decimal"
              className={styles.input}
              value={qty}
              onChange={e => setQty(e.target.value)}
              disabled={loadMaterial.isPending || !!successData}
              placeholder="ej. 100"
            />
          </div>

          {/* Note */}
          <div className={styles.field}>
            <label htmlFor="load-material-note" className={styles.label}>
              Nota <span className={styles.optional}>(opcional)</span>
            </label>
            <input
              id="load-material-note"
              type="text"
              className={styles.input}
              value={note}
              onChange={e => setNote(e.target.value)}
              disabled={loadMaterial.isPending || !!successData}
              placeholder="ej. Compra junio 2026"
            />
          </div>

          {/* Error */}
          {localError && (
            <p className={styles.error} role="alert">
              {localError}
            </p>
          )}

          {/* Success confirmation */}
          {successData && (
            <p className={styles.success} role="status">
              Stock cargado. Nuevo total: <strong>{successData.newQty}</strong>
              {selectedType?.unit ? ` ${selectedType.unit}` : ''}.
            </p>
          )}
        </div>

        <footer className={styles.actions}>
          <button
            type="button"
            className={styles.cancel}
            onClick={onClose}
            disabled={loadMaterial.isPending}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className={styles.submit}
            disabled={!canSubmit || !!successData}
          >
            {loadMaterial.isPending ? 'Cargando…' : 'Cargar stock'}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
