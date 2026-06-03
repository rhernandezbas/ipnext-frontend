import { useState } from 'react';
import type { TaskInventorySuggestion } from '@/types/serviceInventory';
import { useDeviceTypes } from '@/hooks/useDeviceTypes';
import styles from './SuggestionCard.module.css';

const FALLBACK_TYPE = 'OTROS';

const sourceLabel = (s: string): string =>
  s === 'OCR' ? 'OCR' : s === 'CHECKLIST_TEXT' ? 'texto' : 'IClass';

interface Props {
  suggestion: TaskInventorySuggestion;
  onConfirm: (id: string, type: string) => void;
  onDiscard: (id: string) => void;
  isPending: boolean;
  canWrite: boolean;
}

/**
 * One inventory suggestion. While `pending` it's editable: photo + type dropdown
 * (options from the active DeviceType catalog ordered by sortOrder) + SN/MAC +
 * Confirmar/Descartar. Once resolved (confirmed or discarded) it keeps the SAME
 * rich layout — photo, SN/MAC — but read-only: the type is shown as static text
 * (the raw deviceType stored, including possibly inactive types) and the actions
 * become a status badge.
 */
export function SuggestionCard({ suggestion: s, onConfirm, onDiscard, isPending, canWrite }: Props) {
  const { data: deviceTypes = [], isLoading } = useDeviceTypes();

  // Active types ordered by sortOrder (for the dropdown)
  const activeTypes = deviceTypes
    .filter(dt => dt.active)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Compute a valid initial type: prefer the suggestion's deviceType if it exists
  // in the catalog (active or not); fall back to OTROS or the first active type.
  const resolveInitialType = (raw: string | null): string => {
    if (!raw) return activeTypes[0]?.name ?? FALLBACK_TYPE;
    // If catalog not loaded yet, keep raw value
    if (isLoading || deviceTypes.length === 0) return raw;
    // Accept the value if it appears anywhere in the catalog (active or inactive)
    const inCatalog = deviceTypes.some(dt => dt.name === raw);
    if (inCatalog) return raw;
    // Not in catalog — fall back to OTROS if present, else first active
    const otros = activeTypes.find(dt => dt.name === FALLBACK_TYPE);
    return otros?.name ?? activeTypes[0]?.name ?? FALLBACK_TYPE;
  };

  const isDevice = s.kind === 'DEVICE';
  const resolved = s.status !== 'pending';
  const [type, setType] = useState<string>(() => resolveInitialType(s.deviceType));
  const qwenDiffers = !resolved && isDevice && !!s.qwenDeviceType && s.qwenDeviceType !== type;

  return (
    <div className={styles.card}>
      {isDevice && s.photoUrl ? (
        <a href={s.photoUrl} target="_blank" rel="noreferrer" className={styles.thumbLink}>
          <img className={styles.thumb} src={s.photoUrl} alt="foto del equipo" />
        </a>
      ) : (
        <div className={styles.thumbPlaceholder}>{isDevice ? 'sin foto' : '📦'}</div>
      )}

      <div className={styles.body}>
        {isDevice ? (
          <>
            <div className={styles.typeRow}>
              {resolved ? (
                // Resolved: show the raw stored deviceType (may be inactive/legacy)
                <span className={styles.typeStatic}>{s.deviceType ?? FALLBACK_TYPE}</span>
              ) : (
                <select
                  className={styles.typeSelect}
                  aria-label="tipo de equipo"
                  value={type}
                  disabled={!canWrite}
                  onChange={e => setType(e.target.value)}
                >
                  {activeTypes.map(dt => (
                    <option key={dt.id} value={dt.name}>{dt.name}</option>
                  ))}
                  {/* If the current value is not in active types (inactive/legacy), show it */}
                  {!isLoading && activeTypes.length > 0 && !activeTypes.some(dt => dt.name === type) && (
                    <option value={type}>{type}</option>
                  )}
                </select>
              )}
              {qwenDiffers && <span className={styles.qwenBadge}>qwen sugiere: {s.qwenDeviceType}</span>}
            </div>
            <div className={styles.meta}>
              <span><span className={styles.metaLabel}>SN:</span> {s.serialNumber ?? '—'}</span>
              <span><span className={styles.metaLabel}>MAC:</span> {s.mac ?? '—'}</span>
            </div>
          </>
        ) : (
          <div className={styles.meta}>
            <strong>{s.materialDesc ?? 'Material'}</strong>
            {s.quantity != null && <span>× {s.quantity}{s.unit ? ` ${s.unit}` : ''}</span>}
          </div>
        )}
        <span className={styles.source}>{sourceLabel(s.source)}</span>
      </div>

      {resolved ? (
        <span
          className={`${styles.statusBadge} ${s.status === 'confirmed' ? styles.confirmedBadge : styles.discardedBadge}`}
        >
          {s.status === 'confirmed' ? '✓ Confirmado' : '✕ Descartado'}
        </span>
      ) : canWrite ? (
        <div className={styles.actions}>
          <button type="button" className={styles.confirmBtn} onClick={() => onConfirm(s.id, type)} disabled={isPending}>
            Confirmar
          </button>
          <button type="button" className={styles.discardBtn} onClick={() => onDiscard(s.id)} disabled={isPending}>
            Descartar
          </button>
        </div>
      ) : null}
    </div>
  );
}
