import { useState } from 'react';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useUpdateContractService, useRemoveContractService } from '@/hooks/useContractServices';
import { ServiceRemovalReasonModal } from '@/components/molecules/ServiceRemovalReasonModal/ServiceRemovalReasonModal';
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
  /**
   * When provided, clicking the INTERNET chip opens the InternetPanel instead
   * of toggling the chip's active/inactive status.
   */
  onOpenInternetManagement?: () => void;
}

/** A service line is the Gigared TV line when its `name` is exactly 'TV'. */
function isTvService(name: string): boolean {
  return name === 'TV';
}

/** A service line is the INTERNET line when its `name` is exactly 'INTERNET'. */
function isInternetService(name: string): boolean {
  return name === 'INTERNET';
}

/**
 * Service chips on a contract (#42, AD-5). Clicking a chip toggles its
 * active/inactive status; the "×" removes it behind a confirm. Read-only
 * (static chips) without `clients.write`.
 */
export function ContractServiceChips({ contractId, clientId, services, onOpenTvManagement, tvSuspended, onOpenInternetManagement }: Props) {
  const { can } = useMyPermissions();
  const canWrite = can('clients.write');
  const toggle = useUpdateContractService(clientId);
  const remove = useRemoveContractService(clientId);

  // #127 — modal state: which service is pending removal (null = closed).
  const [pendingRemoval, setPendingRemoval] = useState<ContractService | null>(null);

  async function handleToggle(svc: ContractService) {
    const next = svc.status === 'active' ? 'inactive' : 'active';
    await toggle.mutateAsync({ contractId, id: svc.id, payload: { status: next } });
  }

  function handleRemoveClick(svc: ContractService) {
    setPendingRemoval(svc);
  }

  async function handleRemoveConfirm(reason: string) {
    if (!pendingRemoval) return;
    setPendingRemoval(null);
    await remove.mutateAsync({ contractId, id: pendingRemoval.id, reason });
  }

  function handleRemoveCancel() {
    setPendingRemoval(null);
  }

  return (
    <>
      <ServiceRemovalReasonModal
        open={pendingRemoval !== null}
        serviceName={pendingRemoval ? (pendingRemoval.label ?? pendingRemoval.name) : ''}
        onConfirm={handleRemoveConfirm}
        onCancel={handleRemoveCancel}
      />
      {services.map((svc) => {
        const text = svc.label ?? svc.name;
        const stateClass = svc.status === 'active' ? styles.active : styles.inactive;
        const isTvLine = isTvService(svc.name);
        const isTv = isTvLine && !!onOpenTvManagement;
        const isInternetLine = isInternetService(svc.name);
        const isInternet = isInternetLine && !!onOpenInternetManagement;

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

        // INTERNET chip: opens the InternetPanel when `onOpenInternetManagement` is provided.
        if (isInternet) {
          return (
            <span key={svc.id} className={`${styles.chip} ${stateClass}`}>
              <button
                type="button"
                className={styles.chipToggle}
                onClick={onOpenInternetManagement}
                title="Gestionar Internet"
              >
                {text}
              </button>
            </span>
          );
        }

        // Without the panel handler, INTERNET is always a static chip — managed
        // exclusively through the panel when the user has the permission.
        if (isInternetLine) {
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
              onClick={() => handleRemoveClick(svc)}
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
