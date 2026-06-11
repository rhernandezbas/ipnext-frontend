import { useEffect, useMemo, useRef, useState } from 'react';
import { useServiceCatalog } from '@/hooks/useServiceCatalog';
import { useAddContractService } from '@/hooks/useContractServices';
import type { ContractService } from '@/types/customer';
import styles from './ServicePickerMenu.module.css';

interface Props {
  contractId: string;
  clientId: string;
  /** Already-attached services — their catalog ids are filtered out. */
  services: ContractService[];
}

/** Maps a mutation error onto a user-facing message (mapError pattern). */
function mapAddError(err: unknown): string {
  const e = err as { response?: { status?: number; data?: { code?: string } } };
  if (e.response?.status === 409 && e.response.data?.code === 'CONTRACT_SERVICE_DUPLICATE') {
    return 'Ese servicio ya está agregado al contrato.';
  }
  return 'No se pudo agregar el servicio.';
}

/**
 * Inline popover to attach a catalog service to the contract (#42, AD-4).
 * Lists active catalog entries not yet attached. Closes on outside click.
 * A duplicate (409 CONTRACT_SERVICE_DUPLICATE) surfaces an inline toast.
 */
export function ServicePickerMenu({ contractId, clientId, services }: Props) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
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
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function handlePick(serviceCatalogId: string) {
    setOpen(false);
    try {
      await addService.mutateAsync({ contractId, payload: { serviceCatalogId } });
    } catch (err: unknown) {
      showToast(mapAddError(err));
    }
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button type="button" className={styles.addBtn} onClick={() => setOpen(o => !o)}>
        + Agregar servicio
      </button>
      {open && (
        <ul className={styles.menu} role="menu">
          {options.length === 0 ? (
            <li className={styles.emptyItem}>No hay servicios disponibles.</li>
          ) : (
            options.map(opt => (
              <li key={opt.id}>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.item}
                  onClick={() => handlePick(opt.id)}
                >
                  {opt.label ?? opt.name}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      {toast && (
        <p className={styles.toast} role="alert">
          {toast}
        </p>
      )}
    </div>
  );
}
