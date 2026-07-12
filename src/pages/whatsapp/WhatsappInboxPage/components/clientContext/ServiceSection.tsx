import type { WhatsappInboxContract } from '@/types/whatsapp';
import { StatusBadge } from '@/components/atoms/StatusBadge/StatusBadge';
import styles from '../ClientContextPanel.module.css';

interface ServiceSectionProps {
  contracts: WhatsappInboxContract[];
}

type ServiceStatusVariant = 'active' | 'late' | 'blocked' | 'inactive' | 'baja';

/**
 * Mapa `serviceStatus` (corte PPPoE, mirror-only) → StatusBadge (design §5.3).
 * `reduced` no tiene variante propia en el átomo compartido → reusa el
 * naranja `blocked` con label override "Reducido" (StatusBadge acepta
 * `label`, patrón ya usado en el repo).
 */
const SERVICE_STATUS_MAP: Record<
  NonNullable<WhatsappInboxContract['serviceStatus']>,
  { variant: ServiceStatusVariant; label: string }
> = {
  active: { variant: 'active', label: 'Activo' },
  reduced: { variant: 'blocked', label: 'Reducido' },
  blocked: { variant: 'blocked', label: 'Cortado' },
  baja: { variant: 'baja', label: 'Baja' },
  inactive: { variant: 'inactive', label: 'Inactivo' },
};

/**
 * ServiceSection — plan/tecnología/dirección/estado de servicio por contrato
 * (messaging-inbox-v2 F1.5, design §5.3). Cardinalidad chica (1-2 típico),
 * sin límite N (a diferencia de tickets/tareas/logs).
 */
export function ServiceSection({ contracts }: ServiceSectionProps) {
  // Fix bug BAJO (review adversarial): guard defensivo — si el BE degrada mal
  // y manda `contracts` undefined/null en vez de `[]`, `.length`/`.map` no
  // deben tirar TypeError.
  const items = contracts ?? [];

  return (
    // Fix bug MEDIO a11y (review adversarial): sub-sección SIN landmark
    // propio — solo el panel raíz es `<section>` (ver `FinancialSection.tsx`).
    <div className={styles['svc-section']}>
      <h3 className={styles['svc-title']}>
        Servicio
      </h3>
      {items.length === 0 ? (
        <p className={styles['svc-empty']}>Sin contratos activos</p>
      ) : (
        <ul className={styles['svc-list']}>
          {items.map((contract) => {
            const statusInfo = contract.serviceStatus ? SERVICE_STATUS_MAP[contract.serviceStatus] : null;
            return (
              <li key={contract.id} className={styles['svc-item']}>
                <div className={styles['svc-planRow']}>
                  <span className={styles['svc-plan']}>{contract.plan}</span>
                  {contract.technology && <span className={styles['svc-tech']}>{contract.technology}</span>}
                </div>
                {contract.address && <span className={styles['svc-address']}>{contract.address}</span>}
                {statusInfo && <StatusBadge status={statusInfo.variant} label={statusInfo.label} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
