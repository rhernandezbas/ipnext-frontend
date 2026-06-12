import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import { useUpdateContractService, useRemoveContractService } from '@/hooks/useContractServices';
import type { ContractService } from '@/types/customer';
import styles from './ContractServiceChips.module.css';

interface Props {
  contractId: string;
  clientId: string;
  services: ContractService[];
  /**
   * #47b — when provided, clicking the TV chip opens the Gigared management
   * panel instead of toggling the chip's active/inactive status. Other chips
   * keep their toggle behaviour.
   */
  onOpenTvManagement?: () => void;
  /**
   * #47k — when true, the TV chip reads as SUSPENDED (OTT disabled while packs
   * remain): amber variant + a "TV suspendida" title. Only affects the TV chip's
   * style/title; the click still opens the panel.
   */
  tvSuspended?: boolean;
}

/** A service line is the Gigared TV line when its `name` is exactly 'TV'. */
function isTvService(name: string): boolean {
  return name === 'TV';
}

/**
 * Service chips on a contract (#42, AD-5). Clicking a chip toggles its
 * active/inactive status; the "×" removes it behind a confirm. Read-only
 * (static chips) without `clients.write`.
 */
export function ContractServiceChips({ contractId, clientId, services, onOpenTvManagement, tvSuspended }: Props) {
  const { can } = useMyPermissions();
  const canWrite = can('clients.write');
  const confirm = useConfirm();
  const toggle = useUpdateContractService(clientId);
  const remove = useRemoveContractService(clientId);

  async function handleToggle(svc: ContractService) {
    const next = svc.status === 'active' ? 'inactive' : 'active';
    await toggle.mutateAsync({ contractId, id: svc.id, payload: { status: next } });
  }

  async function handleRemove(svc: ContractService) {
    const text = svc.label ?? svc.name;
    if (!(await confirm({ message: `¿Quitar el servicio "${text}"?`, tone: 'danger', confirmLabel: 'Quitar' }))) return;
    await remove.mutateAsync({ contractId, id: svc.id });
  }

  return (
    <>
      {services.map((svc) => {
        const text = svc.label ?? svc.name;
        const stateClass = svc.status === 'active' ? styles.active : styles.inactive;
        const isTvLine = isTvService(svc.name);
        const isTv = isTvLine && !!onOpenTvManagement;

        // #47b — the TV chip opens the Gigared panel (management mode) when
        // `onOpenTvManagement` is provided (Gigared active AND tv.read). The
        // panel itself gates write actions.
        if (isTv) {
          // #47k — suspended TV (OTT off + packs) → amber variant + "TV suspendida"
          // title so the operator sees the suspension without opening the panel.
          const chipClass = tvSuspended ? `${styles.chip} ${styles.suspended}` : `${styles.chip} ${stateClass}`;
          return (
            <span key={svc.id} className={chipClass}>
              <button
                type="button"
                className={styles.chipToggle}
                onClick={onOpenTvManagement}
                title={tvSuspended ? 'TV suspendida' : 'Gestionar TV'}
              >
                {text}
              </button>
            </span>
          );
        }

        // F3 — without the panel handler (no tv.read), the TV line is ALWAYS a
        // static chip: it must never become a plain toggle/remove chip, even
        // with clients.write — TV is managed exclusively through the panel.
        if (isTvLine) {
          return (
            <span key={svc.id} className={`${styles.chip} ${stateClass}`}>
              {text}
            </span>
          );
        }

        if (!canWrite) {
          return (
            <span key={svc.id} className={`${styles.chip} ${stateClass}`}>
              {text}
            </span>
          );
        }
        return (
          <span key={svc.id} className={`${styles.chip} ${stateClass}`}>
            <button
              type="button"
              className={styles.chipToggle}
              onClick={() => handleToggle(svc)}
              title={svc.status === 'active' ? 'Desactivar' : 'Activar'}
            >
              {text}
            </button>
            <button
              type="button"
              className={styles.chipRemove}
              onClick={() => handleRemove(svc)}
              aria-label={`Quitar ${text}`}
            >
              ×
            </button>
          </span>
        );
      })}
    </>
  );
}
