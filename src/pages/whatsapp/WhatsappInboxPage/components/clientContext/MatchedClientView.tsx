import type { WhatsappInboxClientSummary } from '@/types/whatsapp';
import { IdentityHeader } from './IdentityHeader';
import { FinancialSection } from './FinancialSection';
import { ServiceSection } from './ServiceSection';
import { InteractionsSection } from './InteractionsSection';
import styles from '../ClientContextPanel.module.css';

interface MatchedClientViewProps {
  client: WhatsappInboxClientSummary;
  isRefreshingBalance?: boolean;
  /** `isError && hay cache previa` (design §4, tabla de estados) — no rompe el
   * contenido, solo muestra un chip sutil "no se pudo actualizar". */
  hasStaleError?: boolean;
}

/**
 * MatchedClientView — composición de las 4 secciones cuando hay `client`
 * resuelto (matched, o ambiguous ya elegido). Design §1/§8.2: stagger de
 * entrada por sección (0/60/120/180ms vía clases `st-section0..3` del CSS
 * compartido), keyed por `client.id` para re-disparar la animación al
 * cambiar de cliente (el wrapper de contenido cambia de identidad en React).
 */
export function MatchedClientView({ client, isRefreshingBalance, hasStaleError }: MatchedClientViewProps) {
  return (
    <div key={client.id} className={styles['st-matched']}>
      {hasStaleError && (
        <p className={styles['st-staleChip']} role="status">
          no se pudo actualizar
        </p>
      )}
      <div className={styles['st-section0']}>
        <IdentityHeader client={client} />
      </div>
      <div className={styles['st-section1']}>
        <FinancialSection client={client} isRefreshingBalance={isRefreshingBalance} />
      </div>
      <div className={styles['st-section2']}>
        <ServiceSection contracts={client.contracts} />
      </div>
      <div className={styles['st-section3']}>
        <InteractionsSection client={client} />
      </div>
    </div>
  );
}
