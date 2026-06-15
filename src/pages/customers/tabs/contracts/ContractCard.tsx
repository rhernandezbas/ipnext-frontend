import { useState } from 'react';
import { StatusBadge } from '@/components/atoms/StatusBadge/StatusBadge';
import { CLIENT_STATUS_LABELS } from '@/pages/customers/clientStatusLabels';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useGigaredConfig, useGigaredCustomerAccount } from '@/hooks/useGigared';
import type { Contract } from '@/types/customer';
import { ServiceInventorySection } from '../ServiceInventorySection';
import { InlineNameEdit } from './InlineNameEdit';
import { ContractServiceChips } from './ContractServiceChips';
import { ServicePickerMenu } from './ServicePickerMenu';
import { GigaredPanel } from './GigaredPanel';
import { ServiceHistoryModal } from '@/components/molecules/ServiceHistoryModal/ServiceHistoryModal';
import { formatDateShort } from '@/utils/formatDate';
import styles from './ContractCard.module.css';

interface Props {
  contract: Contract;
  clientId: string;
  active: boolean;
  /**
   * The Prominense customer (#47e). Threaded to the GigaredPanel so its
   * "Registrar cuenta nueva" form prefills name/email from the real client.
   */
  customer?: { name: string; email: string; grClienteId?: string | null };
}

type BadgeStatus = 'active' | 'late' | 'blocked' | 'inactive' | 'baja';

/** Map the GR customer status onto a StatusBadge presentation variant. */
function badgeStatus(status: string): BadgeStatus {
  switch (status) {
    case 'active':
      return 'active';
    case 'blocked':
      return 'blocked';
    case 'baja':
      return 'baja';
    default:
      return 'inactive';
  }
}

function formatDateRange(start: string, end: string | null): string {
  const from = formatDateShort(start);
  return end ? `${from} → ${formatDateShort(end)}` : `Desde ${from}`;
}

export function ContractCard({ contract, clientId, active, customer }: Props) {
  const { can } = useMyPermissions();
  const canWrite = can('clients.write');
  const display = contract.name ?? contract.plan;
  const variant = badgeStatus(contract.status);

  // #47b — TV is managed from the contract. When Gigared is configured AND
  // enabled, picking the TV catalog entry (or clicking the TV chip) opens the
  // GigaredPanel scoped to THIS contract instead of creating a plain item.
  // F3 — but only when the user can READ TV: without tv.read the chip stays
  // static and the picker does NOT divert (plain item path).
  const canReadTv = can('tv.read');
  const { data: gigaredConfig } = useGigaredConfig();
  const gigaredActive = !!gigaredConfig?.configured && !!gigaredConfig?.enabled && canReadTv;
  const [tvPanelOpen, setTvPanelOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // #47k — the TV chip reflects suspension: when the linked Gigared account has
  // OTT disabled while it still holds packs, the chip turns amber ("TV
  // suspendida"). Only queried when Gigared is active (avoids a stray fetch).
  //
  // LOW (review) — coherence with the panel: the GigaredPanel treats an OTT
  // whose status is null (unknown) as SUSPENDED (it shows "Reactivar TV"), so
  // the chip must agree. We fold `status === null` into the amber condition.
  // NOTE: this only fires when an OTT object IS present with an explicit null
  // status — `ott === null` (no OTT account at all) yields `undefined` here, so
  // it stays the normal "Gestionar TV": there is nothing to reactivate.
  const { data: gigaredAccount } = useGigaredCustomerAccount(clientId, gigaredActive);
  const tvAccount = gigaredAccount?.account ?? null;
  const tvSuspended =
    !!tvAccount &&
    (tvAccount.ott?.status === 'disabled' || tvAccount.ott?.status === null) &&
    tvAccount.services.length > 0;

  return (
    <article className={styles.card}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <InlineNameEdit
            contractId={contract.id}
            display={display}
            name={contract.name}
            clientId={clientId}
          />
          {contract.code && (
            <span className={styles.codeBadge} title="Código de contrato (IClass)">
              {contract.code}
            </span>
          )}
          <StatusBadge status={variant} label={CLIENT_STATUS_LABELS[contract.status]} />
          {can('clients.read') && (
            <button
              type="button"
              className={styles.historyButton}
              onClick={() => setHistoryOpen(true)}
            >
              Historial
            </button>
          )}
        </div>
      </div>

      <div className={styles.metadata}>
        {contract.name && (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Plan</span>
            <span className={styles.fieldValue}>{contract.plan}</span>
          </div>
        )}
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Instalación</span>
          <span className={styles.fieldValue}>{contract.address || '—'}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>IP</span>
          <span className={styles.fieldValue}>{contract.ip || '—'}</span>
        </div>
        {contract.technology && (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Tecnología</span>
            <span className={styles.fieldValue}>{contract.technology}</span>
          </div>
        )}
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Vigencia</span>
          <span className={styles.fieldValue}>{formatDateRange(contract.startDate, contract.endDate)}</span>
        </div>
      </div>

      <div className={styles.services}>
        <div className={styles.sectionLabel}>Servicios</div>
        <div className={styles.chips}>
          {contract.services.length === 0 && !canWrite && (
            <span className={styles.emptyHint}>Sin servicios.</span>
          )}
          {contract.services.length === 0 && canWrite && (
            <span className={styles.emptyHint}>Agregá un servicio.</span>
          )}
          {/* #5A — filter out inactive TV rows: after a baja the reconcile leaves a
              status='inactive' TV ContractService row but does NOT delete it. That stale
              row must NOT produce a TV chip (clicking it would open the Gigared panel in
              an inconsistent state). Non-TV inactive rows are left alone — only the TV
              row carries this post-baja sentinel behavior. */}
          <ContractServiceChips
            contractId={contract.id}
            clientId={clientId}
            services={contract.services.filter(
              (s) => !(s.name === 'TV' && s.status === 'inactive'),
            )}
            onOpenTvManagement={gigaredActive ? () => setTvPanelOpen(true) : undefined}
            tvSuspended={tvSuspended}
          />
          {canWrite && (
            <ServicePickerMenu
              contractId={contract.id}
              clientId={clientId}
              services={contract.services}
              divertTv={gigaredActive}
              onPickTv={() => setTvPanelOpen(true)}
            />
          )}
        </div>
      </div>

      <div className={styles.equipment}>
        <ServiceInventorySection serviceId={contract.id} enabled={active} />
      </div>

      {tvPanelOpen && (
        <GigaredPanel
          customerId={clientId}
          contractId={contract.id}
          customer={customer}
          grContratoId={contract.code}
          onClose={() => setTvPanelOpen(false)}
        />
      )}
      {historyOpen && (
        <ServiceHistoryModal
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          contractId={contract.id}
          contractName={contract.name ?? contract.code ?? undefined}
        />
      )}
    </article>
  );
}
