import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ServiceInstalledItem } from '@/types/serviceInventory';
import styles from './RetireEquipmentModal.module.css';

interface Props {
  open: boolean;
  items: ServiceInstalledItem[];
  isPending: boolean;
  onConfirm: (selectedIds: string[]) => void;
  onCancel: () => void;
}

/**
 * Multi-select picker for manually retiring contract equipment back to depot (#39).
 * Shows only active CIIs. Confirm is disabled until at least one item is selected.
 * Keyboard: Esc closes/cancels.
 */
export function RetireEquipmentModal({ open, items, isPending, onConfirm, onCancel }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const firstCheckRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    firstCheckRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onCancel]);

  if (!open) return null;

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const activeItems = items.filter(it => it.status === 'active');
  const allSelected = activeItems.length > 0 && selected.size === activeItems.length;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(activeItems.map(it => it.id)));
    }
  }

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="retire-modal-title"
    >
      <div className={styles.dialog}>
        <div className={styles.header}>
          <h2 id="retire-modal-title" className={styles.title}>Retirar equipos al depósito</h2>
          <button type="button" className={styles.closeBtn} onClick={onCancel} aria-label="Cerrar">✕</button>
        </div>

        {activeItems.length === 0 ? (
          <p className={styles.empty}>Sin equipos activos para retirar.</p>
        ) : (
          <>
            <div className={styles.selectAll}>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Seleccionar todos"
                />
                <span className={styles.selectAllLabel}>
                  Seleccionar todos ({activeItems.length})
                </span>
              </label>
            </div>

            <ul className={styles.list} role="list">
              {activeItems.map((item, idx) => (
                <li key={item.id} className={styles.listItem}>
                  <label className={styles.checkRow}>
                    <input
                      ref={idx === 0 ? firstCheckRef : undefined}
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggle(item.id)}
                      aria-label={item.serialNumber ?? item.mac ?? item.type}
                    />
                    <div className={styles.itemInfo}>
                      <span className={styles.itemType}>{item.type}</span>
                      {item.serialNumber && (
                        <span className={styles.itemDetail}>{item.serialNumber}</span>
                      )}
                      {item.mac && !item.serialNumber && (
                        <span className={styles.itemDetail}>{item.mac}</span>
                      )}
                      {item.model && (
                        <span className={styles.itemModel}>{item.model}</span>
                      )}
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}

        {selected.size > 0 && (
          <p className={styles.summary}>
            Vas a retirar {selected.size} equipo{selected.size !== 1 ? 's' : ''} al depósito.
          </p>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onCancel}
            disabled={isPending}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={() => onConfirm([...selected])}
            disabled={selected.size === 0 || isPending}
          >
            {isPending ? 'Retirando…' : 'Confirmar retiro'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
