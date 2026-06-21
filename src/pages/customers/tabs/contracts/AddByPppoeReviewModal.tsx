import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { InspectPppoeDevicesResult, AddInstalledItemInput } from '@/types/serviceInventory';
import styles from './AddByPppoeReviewModal.module.css';

interface AddByPppoeReviewModalProps {
  contractId: string;
  result: InspectPppoeDevicesResult;
  onClose: () => void;
  /** Called once per device to add. Should call the add-inventory mutation/api. */
  onCreate: (input: AddInstalledItemInput) => Promise<void>;
}

/**
 * Review modal for "Agregar por PPPoE" (#add-by-pppoe).
 *
 * Shows the discovered antenna + router from the live PPPoE inspection.
 * The operator can toggle each device on/off and edit the model field before
 * confirming. On confirm, calls `onCreate` for each included device.
 *
 * Patterns match InstalledItemFormModal: portal to body, Esc closes,
 * backdrop click closes, scroll lock, focus on mount.
 */
export function AddByPppoeReviewModal({
  result,
  onClose,
  onCreate,
}: AddByPppoeReviewModalProps) {
  const { antenna, router, warnings } = result;

  // Per-device inclusion toggles (default on when the device has a MAC to register).
  // Sin MAC la antena no aporta nada al inventario → default off + toggle deshabilitado.
  const [includeAntenna, setIncludeAntenna] = useState(antenna.mac !== null);
  const [includeRouter, setIncludeRouter] = useState(router !== null);

  // Editable model fields
  const [antennaModel, setAntennaModel] = useState(antenna.model ?? '');
  const [routerModel, setRouterModel] = useState(router?.brand ?? '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  async function handleConfirm() {
    setSaving(true);
    setError(null);

    const tasks: Array<AddInstalledItemInput> = [];

    if (includeAntenna) {
      tasks.push({
        type: 'ANTENA',
        mac: antenna.mac ?? undefined,
        model: antennaModel.trim() || undefined,
      });
    }

    if (includeRouter && router !== null) {
      tasks.push({
        type: 'ROUTER',
        mac: router.mac,
        model: routerModel.trim() || undefined,
      });
    }

    let firstError: string | null = null;

    for (const input of tasks) {
      try {
        await onCreate(input);
      } catch (err: unknown) {
        const apiMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        const msg = apiMsg ?? (err instanceof Error ? err.message : null) ?? 'Error al agregar equipo';
        if (!firstError) firstError = msg;
        // Continue trying the remaining devices — don't abort on first failure
      }
    }

    setSaving(false);

    if (firstError) {
      setError(firstError);
    } else {
      onClose();
    }
  }

  const nothingSelected = !includeAntenna && !includeRouter;

  return createPortal(
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="abp-review-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        {/* ── Header ──────────────────────────────────────────────────── */}
        <header className={styles.header}>
          <div>
            <h2 id="abp-review-title" className={styles.title}>
              Equipos detectados
            </h2>
            <p className={styles.subtitle}>
              Revisá y editá los datos antes de guardar.
            </p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar"
          >
            {/* SVG × icon */}
            <svg className={styles.icon} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
            </svg>
          </button>
        </header>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className={styles.body}>
          {/* Warnings banner */}
          {warnings.length > 0 && (
            <div className={styles.warningsBanner} role="status">
              <svg className={styles.icon} width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                <path d="M7.5 1.5L13.5 12.5H1.5L7.5 1.5Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
                <path d="M7.5 6v3M7.5 11v.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
              </svg>
              <ul>
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          {/* Antenna card */}
          <div className={styles.deviceCard}>
            <div className={`${styles.deviceCardHeader} ${!includeAntenna ? styles.unchecked : ''}`}>
              <input
                type="checkbox"
                id="abp-include-antenna"
                className={styles.deviceToggle}
                checked={includeAntenna}
                onChange={(e) => setIncludeAntenna(e.target.checked)}
                disabled={!antenna.mac}
                aria-label="Antena"
              />
              <label htmlFor="abp-include-antenna" className={styles.deviceLabel}>
                <span className={styles.typeTag}>ANTENA</span>
                Antena
              </label>
            </div>
            <div className={`${styles.deviceCardBody} ${!includeAntenna ? styles.dimmed : ''}`}>
              <div className={styles.row}>
                <div className={styles.field}>
                  <span className={styles.label}>MAC</span>
                  {antenna.mac
                    ? <span className={styles.macValue}>{antenna.mac}</span>
                    : <span className={styles.macValueNull}>No detectada</span>
                  }
                </div>
                <div className={styles.field}>
                  <label htmlFor="abp-antenna-model" className={styles.label}>
                    Modelo (Antena)
                  </label>
                  <input
                    id="abp-antenna-model"
                    type="text"
                    className={styles.control}
                    value={antennaModel}
                    onChange={(e) => setAntennaModel(e.target.value)}
                    placeholder="Ej. Mimosa C5x"
                    autoComplete="off"
                    disabled={!includeAntenna}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Router card or "no router" note */}
          {router !== null ? (
            <div className={styles.deviceCard}>
              <div className={`${styles.deviceCardHeader} ${!includeRouter ? styles.unchecked : ''}`}>
                <input
                  type="checkbox"
                  id="abp-include-router"
                  className={styles.deviceToggle}
                  checked={includeRouter}
                  onChange={(e) => setIncludeRouter(e.target.checked)}
                  aria-label="Router"
                />
                <label htmlFor="abp-include-router" className={styles.deviceLabel}>
                  <span className={styles.typeTag}>ROUTER</span>
                  Router
                </label>
              </div>
              <div className={`${styles.deviceCardBody} ${!includeRouter ? styles.dimmed : ''}`}>
                <div className={styles.row}>
                  <div className={styles.field}>
                    <span className={styles.label}>MAC</span>
                    <span className={styles.macValue}>{router.mac}</span>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="abp-router-model" className={styles.label}>
                      Modelo (Router)
                    </label>
                    <input
                      id="abp-router-model"
                      type="text"
                      className={styles.control}
                      value={routerModel}
                      onChange={(e) => setRouterModel(e.target.value)}
                      placeholder="Ej. TP-Link TL-WR840N"
                      autoComplete="off"
                      disabled={!includeRouter}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.noRouter}>
              <svg className={styles.icon} width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.25"/>
                <path d="M7.5 5v2.5L9 9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              No se detectó router del cliente
            </div>
          )}

          {error && (
            <p className={styles.errorBanner} role="alert">{error}</p>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={styles.submitBtn}
            onClick={handleConfirm}
            disabled={saving || nothingSelected}
          >
            {saving ? 'Guardando…' : 'Agregar equipos'}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
