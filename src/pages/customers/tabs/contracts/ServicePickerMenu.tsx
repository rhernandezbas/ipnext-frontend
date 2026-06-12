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

/**
 * Anchored position for the portaled menu/toast. The menu can be anchored
 * either by its `top` edge (opening downward from the trigger) or by its
 * `bottom` edge (flipping upward from the trigger). Bottom-anchoring is what
 * keeps a flipped menu glued to the trigger regardless of its own height —
 * the menu grows upward from the trigger instead of guessing its height.
 */
type MenuPos =
  | { left: number; top: number }
  | { left: number; bottom: number };

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

/** Menu sizing — kept in sync with .menu max-height/min-width in the CSS module. */
const MENU_MAX_HEIGHT = 280;
const MENU_MIN_WIDTH = 180;
/** Gap between viewport edge and the menu when clamping horizontally. */
const VIEWPORT_MARGIN = 8;

/** Clamp the menu's left edge so it never overflows the right viewport edge. */
function clampLeft(left: number): number {
  const max = window.innerWidth - MENU_MIN_WIDTH - VIEWPORT_MARGIN;
  return Math.max(VIEWPORT_MARGIN, Math.min(left, max));
}

/**
 * Inline popover to attach a catalog service to the contract (#42, AD-4).
 * Lists active catalog entries not yet attached. Closes on outside click.
 * A duplicate (409 CONTRACT_SERVICE_DUPLICATE) surfaces an inline toast.
 *
 * Fix #58 — both the menu AND the toast are rendered through a portal to
 * <body> with fixed positioning (StageSelect pattern) so they escape the
 * ancestor `.card { overflow: hidden }` that previously clipped them. The list
 * has a max-height with internal scroll so a growing catalog never overflows
 * the viewport. When there's no room below, the menu flips upward and anchors
 * by its `bottom` edge to the trigger, so a small catalog stays glued to the
 * trigger instead of floating ~200px above it.
 *
 * Keyboard (basic ARIA menu pattern): Escape closes and returns focus to the
 * trigger; opening focuses the first item; ArrowUp/ArrowDown move between items.
 */
export function ServicePickerMenu({ contractId, clientId, services, divertTv, onPickTv }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastPos, setToastPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const { data: catalog = [] } = useServiceCatalog(true);
  const addService = useAddContractService(clientId);

  function showToast(msg: string) {
    // Anchor the toast to the trigger so it escapes the card's overflow:hidden,
    // same as the menu (fix #58). Positioned just below the trigger.
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setToastPos({ top: r.bottom + 4, left: clampLeft(r.left) });
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  const attachedIds = useMemo(() => new Set(services.map(s => s.serviceCatalogId)), [services]);
  const options = useMemo(
    () => catalog.filter(c => c.active && !attachedIds.has(c.id)),
    [catalog, attachedIds],
  );

  /** Closes the menu and returns focus to the trigger (keyboard a11y). */
  function closeAndFocusTrigger() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    // The fixed-position menu would float away on scroll — close it. Ignore
    // scroll originating INSIDE the menu so scrolling the options list doesn't
    // dismiss it before the user can pick.
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    // Resize must NOT reuse onScroll: a ResizeEvent's target is `window`, which
    // is not a Node, so `menuRef.current.contains(window)` throws a TypeError
    // and the menu would never close (HIGH 1). The menu's anchor coords are also
    // stale after a resize — just close it directly.
    const onResize = () => setOpen(false);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  // Focus the first menu item when the menu opens (ARIA menu pattern).
  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    first?.focus();
  }, [open, pos]);

  function toggle() {
    if (open) { setOpen(false); return; }
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) {
      const left = clampLeft(r.left);
      // Open upward if there isn't room below (menu max-height ~280). When
      // flipping, anchor by `bottom` to the trigger top so the menu grows
      // upward from the trigger regardless of its own height (HIGH 2): a small
      // catalog (~100px) stays glued to the trigger instead of floating above it.
      const below = window.innerHeight - r.bottom;
      if (below < MENU_MAX_HEIGHT + 10 && r.top > below) {
        setPos({ left, bottom: window.innerHeight - r.top + 4 });
      } else {
        setPos({ left, top: r.bottom + 4 });
      }
    }
    setOpen(true);
  }

  /** ArrowUp/ArrowDown move between items; Escape closes and refocuses trigger. */
  function onMenuKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeAndFocusTrigger();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
    );
    if (items.length === 0) return;
    const idx = items.indexOf(document.activeElement as HTMLButtonElement);
    const delta = e.key === 'ArrowDown' ? 1 : -1;
    const next = (idx + delta + items.length) % items.length;
    items[next]?.focus();
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
          onKeyDown={onMenuKeyDown}
          style={{ position: 'fixed', ...pos }}
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
      {toast && toastPos && createPortal(
        <p
          className={styles.toast}
          role="alert"
          style={{ position: 'fixed', top: toastPos.top, left: toastPos.left }}
        >
          {toast}
        </p>,
        document.body,
      )}
    </div>
  );
}
