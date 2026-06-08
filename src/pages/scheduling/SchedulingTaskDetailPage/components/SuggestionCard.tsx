import { useState } from 'react';
import type { TaskInventorySuggestion } from '@/types/serviceInventory';
import { useDeviceTypes } from '@/hooks/useDeviceTypes';
import { Can } from '@/components/auth/Can';
import styles from './SuggestionCard.module.css';

const FALLBACK_TYPE = 'OTROS';

const sourceLabel = (s: string): string => {
  if (s === 'OCR') return 'OCR';
  if (s === 'MANUAL') return 'Manual';
  if (s === 'CHECKLIST_TEXT') return 'texto';
  return 'IClass';
};

interface Props {
  suggestion: TaskInventorySuggestion;
  onConfirm: (id: string, type: string) => void;
  onDiscard: (id: string) => void;
  isPending: boolean;
  canWrite: boolean;
  /** Called when same_device: links to existing item (resolution:'link_existing'). */
  onLinkExisting?: (id: string) => void;
  /** Called when same_type: replaces the matched item with this suggestion. */
  onReplace?: (id: string, type: string) => void;
  /** Called when the admin corrects the type of an already-confirmed DEVICE. */
  onCorrectType?: (id: string, type: string) => void;
  /** True while the PATCH correctSuggestionType mutation is in-flight. */
  isCorrecting?: boolean;
}

/**
 * Inline match badge — no permission gate (read-only, covered by listing gate).
 * Shows in both pending and resolved variants.
 */
function MatchBadge({ match, deviceType }: {
  match: NonNullable<TaskInventorySuggestion['match']>;
  deviceType: string | null;
}) {
  if (match.status === 'same_device') {
    return (
      <span className={styles.matchBadgeWarning} data-testid="match-badge">
        ⚠️ Ya instalado: el mismo equipo{match.serial ? ` · ${match.serial}` : ''}
      </span>
    );
  }
  // same_type
  return (
    <span className={styles.matchBadgeInfo} data-testid="match-badge">
      Ya hay un/a {deviceType ?? FALLBACK_TYPE}
    </span>
  );
}

/**
 * One inventory suggestion. While `pending` it's editable: photo + type dropdown
 * (options from the active DeviceType catalog ordered by sortOrder) + SN/MAC +
 * Confirmar/Descartar. Once resolved (confirmed or discarded) it keeps the SAME
 * rich layout — photo, SN/MAC — but read-only: the type is shown as static text
 * (the raw deviceType stored, including possibly inactive types) and the actions
 * become a status badge.
 *
 * For confirmed DEVICE cards, admins with `inventory.manage` see an inline type
 * editor (toggle into edit mode → select + Guardar) that calls `onCorrectType`.
 */
export function SuggestionCard({
  suggestion: s,
  onConfirm,
  onDiscard,
  isPending,
  canWrite,
  onLinkExisting,
  onReplace,
  onCorrectType,
  isCorrecting = false,
}: Props) {
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
  // #18: a DEVICE needs SN or MAC; a MATERIAL needs a description. Otherwise confirming
  // is blocked (the backend rejects it with 422 — this mirrors that fail-closed guard).
  const incomplete = isDevice
    ? (!s.serialNumber?.trim() && !s.mac?.trim())
    : !s.materialDesc?.trim();
  const [type, setType] = useState<string>(() => resolveInitialType(s.deviceType));
  const qwenDiffers = !resolved && isDevice && !!s.qwenDeviceType && s.qwenDeviceType !== type;

  // State for the inline type editor (resolved DEVICE variant, admin only)
  const [editingType, setEditingType] = useState(false);
  const [editType, setEditType] = useState<string>(s.deviceType ?? FALLBACK_TYPE);

  const handleGuardar = () => {
    onCorrectType?.(s.id, editType);
    setEditingType(false);
  };

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
                <>
                  {/* Admin: inline type editor, gated by inventory.manage */}
                  <Can
                    permission="inventory.manage"
                    fallback={
                      // Non-admin: static span, unchanged
                      <span className={styles.typeStatic}>{s.deviceType ?? FALLBACK_TYPE}</span>
                    }
                  >
                    {editingType ? (
                      <>
                        <select
                          className={styles.typeSelect}
                          aria-label="tipo de equipo"
                          value={editType}
                          onChange={e => setEditType(e.target.value)}
                        >
                          {activeTypes.map(dt => (
                            <option key={dt.id} value={dt.name}>{dt.name}</option>
                          ))}
                          {/* Include current value if not in active types (inactive/legacy) */}
                          {!isLoading && activeTypes.length > 0 && !activeTypes.some(dt => dt.name === editType) && (
                            <option value={editType}>{editType}</option>
                          )}
                        </select>
                        <button
                          type="button"
                          className={styles.confirmBtn}
                          onClick={handleGuardar}
                          disabled={isCorrecting}
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          className={styles.discardBtn}
                          onClick={() => setEditingType(false)}
                          disabled={isCorrecting}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <span className={styles.typeStatic}>{s.deviceType ?? FALLBACK_TYPE}</span>
                        <button
                          type="button"
                          aria-label="Editar tipo"
                          className={styles.discardBtn}
                          onClick={() => {
                            setEditType(s.deviceType ?? activeTypes[0]?.name ?? FALLBACK_TYPE);
                            setEditingType(true);
                          }}
                        >
                          Editar tipo
                        </button>
                      </>
                    )}
                  </Can>
                </>
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

        {/* Match badge — shown in both pending and resolved variants, no permission gate */}
        {s.match != null && (
          <MatchBadge match={s.match} deviceType={s.deviceType} />
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
          {incomplete && (
            <span className={styles.incompleteHint}>
              {isDevice ? 'Falta SN o MAC para confirmar' : 'Falta una descripción'}
            </span>
          )}
          {isDevice && s.match?.status === 'same_device' ? (
            <>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={() => onLinkExisting?.(s.id)}
                disabled={isPending || incomplete}
              >
                Marcar como ya instalado
              </button>
              <button type="button" className={styles.discardBtn} onClick={() => onDiscard(s.id)} disabled={isPending}>
                Descartar
              </button>
            </>
          ) : isDevice && s.match?.status === 'same_type' ? (
            <>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={() => onConfirm(s.id, type)}
                disabled={isPending || incomplete}
              >
                Agregar
              </button>
              <Can permission="inventory.write">
                <button
                  type="button"
                  className={styles.discardBtn}
                  onClick={() => onReplace?.(s.id, type)}
                  disabled={isPending || incomplete}
                >
                  Reemplazar la actual
                </button>
              </Can>
              <button type="button" className={styles.discardBtn} onClick={() => onDiscard(s.id)} disabled={isPending}>
                Descartar
              </button>
            </>
          ) : (
            <>
              <button type="button" className={styles.confirmBtn} onClick={() => onConfirm(s.id, type)} disabled={isPending || incomplete}>
                Confirmar
              </button>
              <button type="button" className={styles.discardBtn} onClick={() => onDiscard(s.id)} disabled={isPending}>
                Descartar
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
