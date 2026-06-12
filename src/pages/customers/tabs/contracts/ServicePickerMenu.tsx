import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useServiceCatalog } from '@/hooks/useServiceCatalog';
import { useAddContractService } from '@/hooks/useContractServices';
import type { ContractService } from '@/types/customer';
import styles from './ServicePickerMenu.module.css';

interface Props {
  contractId: string;
  clientId: string;
  /** Already-attached services — their catalog ids are filtered out. */
  services: ContractService[];
  /**
   * #47b — when true, picking the TV catalog entry opens the Gigared panel
   * instead of creating a plain ContractService (the BE reconcile creates the
   * local item when a pack is added). When false/omitted, TV behaves like any
   * other service: a plain item is created plus an informative hint.
   */
  divertTv?: boolean;
  /** Called when the TV entry is picked AND `divertTv` is true. */
  onPickTv?: () => void;
}

/** A catalog entry is the Gigared TV service when its `name` is exactly 'TV'. */
function isTvEntry(name: string): boolean {
  return name === 'TV';
}

/** Maps a mutation error onto a user-facing message (mapError pattern). */
function mapAddError(err: unknown): string {
  const e = err as { response?: { status?: number; data?: { code?: string } } };
  if (e.response?.status === 409 && e.response.data?.code === 'CONTRACT_SERVICE_DUPLICATE') {
    return 'Ese servicio ya está agregado al contrato.';
  }
  return 'No se pudo agregar el servicio.';
}

/** Menu sizing — kept in sync with .menu max-height in the CSS module. */
const MENU_MAX_HEIGHT = 280;

/**
 * Inline popover to attach a catalog service to the contract (#42, AD-4).
 * Lists active catalog entries not yet attached. Closes on outside click.
 * A duplicate (409 CONTRACT_SERVICE_DUPLICATE) surfaces an inline toast.
 *
 * Fix #58 — the menu/toast are rendered through a portal to <body> with
 * fixed positioning (StageSelect pattern) so they escape the ancestor
 * `.card { overflow: hidden }` that previously clipped them. The list has a
 * max-height with internal scroll so a growing catalog never overflows the
 * viewport, and the menu flips upward when there's no room below.
 */
export function ServicePickerMenu({ contractId, clientId, services, divertTv, onPickTv }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const { data: catalog = [] } = useServiceCatalog(true);
  const addService = useAddContractService(clientId);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  const attachedIds = useMemo(() => new Set(services.map(s => s.serviceCatalogId)), [services]);
  const options = useMemo(
    () => catalog.filter(c => c.active && !attachedIds.has(c.id)),
    [catalog, attachedIds],
  );

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    // The fixed-position menu would float away on scroll/resize — close it.
    // Ignore scroll originating INSIDE the menu so scrolling the options list
    // doesn't dismiss it before the user can pick.
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  function toggle() {
    if (open) { setOpen(false); return; }
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) {
      // Open upward if there isn't room below (menu max-height ~280).
      const below = window.innerHeight - r.bottom;
      const top =
        below < MENU_MAX_HEIGHT + 10 && r.top > below
          ? r.top - Math.min(MENU_MAX_HEIGHT, r.top - 8)
          : r.bottom + 4;
      setPos({ top, left: r.left });
    }
    setOpen(true);
  }

  async function handlePick(serviceCatalogId: string, name: string) {
    setOpen(false);
    // #47b — TV with Gigared active opens the panel; the pack add (and its
    // reconcile-created local item) happens there, NOT as a plain add here.
    if (isTvEntry(name) && divertTv) {
      onPickTv?.();
      return;
    }
    try {
      await addService.mutateAsync({ contractId, payload: { serviceCatalogId } });
      // TV without an active Gigared integration falls back to a plain local
      // item — make the operator aware the integration did not run.
      if (isTvEntry(name)) {
        showToast('Se agregó el ítem local; la integración Gigared no está activa.');
      }
    } catch (err: unknown) {
      showToast(mapAddError(err));
    }
  }

  return (
    <div className={styles.wrapper}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.addBtn}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        + Agregar servicio
      </button>
      {open && pos && createPortal(
        <ul
          ref={menuRef}
          className={styles.menu}
          role="menu"
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
        >
          {options.length === 0 ? (
            <li className={styles.emptyItem}>No hay servicios disponibles.</li>
          ) : (
            options.map(opt => (
              <li key={opt.id}>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.item}
                  onClick={() => handlePick(opt.id, opt.name)}
                >
                  {opt.label ?? opt.name}
                </button>
              </li>
            ))
          )}
        </ul>,
        document.body,
      )}
      {toast && (
        <p className={styles.toast} role="alert">
          {toast}
        </p>
      )}
    </div>
  );
}
