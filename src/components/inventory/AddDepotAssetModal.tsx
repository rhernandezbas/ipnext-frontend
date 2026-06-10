import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDeviceTypes } from '@/hooks/useDeviceTypes';
import { useAddDepotAsset } from '@/hooks/useDepotEntry';
import styles from './AddDepotAssetModal.module.css';

interface AddDepotAssetModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * "Agregar equipo" — load a device asset into the depot (EPIC #38 depot stock entry).
 *
 * The operator picks a device type from the catalog, then provides at least one
 * of serial number or MAC address (BE rule, enforced client-side too). On 409
 * ASSET_ALREADY_EXISTS the form stays open with a clear error; on success the
 * depot stock refreshes automatically via mutation invalidation.
 */
export function AddDepotAssetModal({ open, onClose }: AddDepotAssetModalProps) {
  const { data: deviceTypes, isLoading: loadingTypes } = useDeviceTypes();
  const addAsset = useAddDepotAsset();

  const [deviceTypeId, setDeviceTypeId] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [mac, setMac] = useState('');
  const [note, setNote] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const selectRef = useRef<HTMLSelectElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setDeviceTypeId('');
      setSerialNumber('');
      setMac('');
      setNote('');
      setLocalError(null);
      addAsset.reset();
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

  const serialTrimmed = serialNumber.trim();
  const macTrimmed = mac.trim();
  const hasAtLeastOne = serialTrimmed !== '' || macTrimmed !== '';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);

    if (!deviceTypeId) {
      setLocalError('Seleccioná un tipo de equipo.');
      return;
    }
    if (!hasAtLeastOne) {
      setLocalError('Ingresá al menos el número de serie o la dirección MAC.');
      return;
    }
    if (addAsset.isPending) return;

    addAsset.mutate(
      {
        deviceTypeId,
        ...(serialTrimmed ? { serialNumber: serialTrimmed } : {}),
        ...(macTrimmed ? { mac: macTrimmed } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      {
        onSuccess: () => onClose(),
        onError: (err: unknown) => {
          const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
          if (code === 'ASSET_ALREADY_EXISTS') {
            setLocalError('Ya existe un equipo con ese serial o MAC en el sistema.');
          } else {
            setLocalError('Ocurrió un error al guardar el equipo. Reintentá.');
          }
        },
      },
    );
  }

  const activeTypes = deviceTypes?.filter(dt => dt.active) ?? [];
  const canSubmit = !addAsset.isPending && !!deviceTypeId && hasAtLeastOne;

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
        aria-labelledby="add-depot-asset-title"
        onSubmit={handleSubmit}
      >
        <header className={styles.head}>
          <h2 id="add-depot-asset-title" className={styles.title}>
            Agregar equipo
          </h2>
          <p className={styles.subtitle}>
            Cargá un equipo nuevo al depósito. Necesitás al menos el serial o la MAC.
          </p>
        </header>

        <div className={styles.body}>
          {/* Device type */}
          <div className={styles.field}>
            <label htmlFor="add-asset-type" className={styles.label}>
              Tipo de equipo <span className={styles.req} aria-hidden="true">*</span>
            </label>
            {loadingTypes ? (
              <p className={styles.loadingTypes}>Cargando tipos…</p>
            ) : (
              <select
                id="add-asset-type"
                ref={selectRef}
                className={styles.select}
                value={deviceTypeId}
                onChange={e => setDeviceTypeId(e.target.value)}
                disabled={addAsset.isPending}
                required
              >
                <option value="">— Elegí un tipo —</option>
                {activeTypes.map(dt => (
                  <option key={dt.id} value={dt.id}>
                    {dt.label ?? dt.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Serial number */}
          <div className={styles.field}>
            <label htmlFor="add-asset-serial" className={styles.label}>
              Número de serie
              <span className={styles.hint}> (requerido si no hay MAC)</span>
            </label>
            <input
              id="add-asset-serial"
              type="text"
              className={styles.input}
              value={serialNumber}
              onChange={e => setSerialNumber(e.target.value)}
              disabled={addAsset.isPending}
              placeholder="ej. SN-AAA-001"
              autoComplete="off"
            />
          </div>

          {/* MAC address */}
          <div className={styles.field}>
            <label htmlFor="add-asset-mac" className={styles.label}>
              Dirección MAC
              <span className={styles.hint}> (requerida si no hay serial)</span>
            </label>
            <input
              id="add-asset-mac"
              type="text"
              className={styles.input}
              value={mac}
              onChange={e => setMac(e.target.value)}
              disabled={addAsset.isPending}
              placeholder="ej. AA:BB:CC:DD:EE:FF"
              autoComplete="off"
            />
          </div>

          {/* Client-side at-least-one hint */}
          {!hasAtLeastOne && (serialNumber !== '' || mac !== '') && (
            <p className={styles.fieldHint} role="alert">
              Ingresá al menos el número de serie o la dirección MAC.
            </p>
          )}

          {/* Note */}
          <div className={styles.field}>
            <label htmlFor="add-asset-note" className={styles.label}>
              Nota <span className={styles.optional}>(opcional)</span>
            </label>
            <input
              id="add-asset-note"
              type="text"
              className={styles.input}
              value={note}
              onChange={e => setNote(e.target.value)}
              disabled={addAsset.isPending}
              placeholder="ej. Equipo reacondicionado"
            />
          </div>

          {/* Error */}
          {localError && (
            <p className={styles.error} role="alert">
              {localError}
            </p>
          )}
        </div>

        <footer className={styles.actions}>
          <button
            type="button"
            className={styles.cancel}
            onClick={onClose}
            disabled={addAsset.isPending}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className={styles.submit}
            disabled={!canSubmit}
          >
            {addAsset.isPending ? 'Guardando…' : 'Agregar equipo'}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
