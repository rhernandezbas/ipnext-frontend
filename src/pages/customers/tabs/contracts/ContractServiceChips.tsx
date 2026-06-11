import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import { useUpdateContractService, useRemoveContractService } from '@/hooks/useContractServices';
import type { ContractService } from '@/types/customer';
import styles from './ContractServiceChips.module.css';

interface Props {
  contractId: string;
  clientId: string;
  services: ContractService[];
}

/**
 * Service chips on a contract (#42, AD-5). Clicking a chip toggles its
 * active/inactive status; the "×" removes it behind a confirm. Read-only
 * (static chips) without `clients.write`.
 */
export function ContractServiceChips({ contractId, clientId, services }: Props) {
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
