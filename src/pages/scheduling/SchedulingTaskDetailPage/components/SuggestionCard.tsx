import { useState } from 'react';
import type { TaskInventorySuggestion, InstalledItemType } from '@/types/serviceInventory';
import styles from './SuggestionCard.module.css';

const TYPES: InstalledItemType[] = ['ONU', 'ROUTER', 'ANTENA', 'REPETIDOR', 'OTROS'];
const toValidType = (t: string | null): InstalledItemType =>
  t && (TYPES as string[]).includes(t) ? (t as InstalledItemType) : 'OTROS';

const sourceLabel = (s: string): string =>
  s === 'OCR' ? 'OCR' : s === 'CHECKLIST_TEXT' ? 'texto' : 'IClass';

interface Props {
  suggestion: TaskInventorySuggestion;
  onConfirm: (id: string, type: InstalledItemType) => void;
  onDiscard: (id: string) => void;
  isPending: boolean;
  canWrite: boolean;
}

/** One pending inventory suggestion: photo + type dropdown (with qwen badge) + SN/MAC + actions. */
export function SuggestionCard({ suggestion: s, onConfirm, onDiscard, isPending, canWrite }: Props) {
  const isDevice = s.kind === 'DEVICE';
  const [type, setType] = useState<InstalledItemType>(toValidType(s.deviceType));
  const qwenDiffers = isDevice && !!s.qwenDeviceType && s.qwenDeviceType !== type;

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
              <select
                className={styles.typeSelect}
                aria-label="tipo de equipo"
                value={type}
                disabled={!canWrite}
                onChange={e => setType(e.target.value as InstalledItemType)}
              >
                {TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
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

      {canWrite && (
        <div className={styles.actions}>
          <button type="button" className={styles.confirmBtn} onClick={() => onConfirm(s.id, type)} disabled={isPending}>
            Confirmar
          </button>
          <button type="button" className={styles.discardBtn} onClick={() => onDiscard(s.id)} disabled={isPending}>
            Descartar
          </button>
        </div>
      )}
    </div>
  );
}
