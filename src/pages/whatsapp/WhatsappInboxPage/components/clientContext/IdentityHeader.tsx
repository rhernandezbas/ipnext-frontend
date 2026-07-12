import { Link } from 'react-router-dom';
import type { WhatsappInboxClientSummary } from '@/types/whatsapp';
import { StatusBadge } from '@/components/atoms/StatusBadge/StatusBadge';
import { toStatusBadgeVariant } from './statusBadgeVariant';
import styles from '../ClientContextPanel.module.css';

interface IdentityHeaderProps {
  client: WhatsappInboxClientSummary;
}

/**
 * IdentityHeader — cabecera compacta (messaging-inbox-v2 F1.5, design §5.1):
 * avatar + nombre + StatusBadge + teléfono/email (tel:/mailto:, patrón
 * `CustomerCard.tsx`) + link a la ficha completa. Empty: "Sin dato" muted.
 */
export function IdentityHeader({ client }: IdentityHeaderProps) {
  return (
    <div className={styles['id-header']}>
      <div className={styles['id-row']}>
        <span className={styles['id-avatar']} aria-hidden="true">
          {client.name.charAt(0).toUpperCase()}
        </span>
        <div className={styles['id-info']}>
          <span className={styles['id-name']}>{client.name}</span>
          {/* Fix bug BAJO (review adversarial): `client.status` viaja como
              mirror del BE — `toStatusBadgeVariant` narrowea de forma
              defensiva (mismo patrón que `CandidatePicker`) en vez de pasar
              el string crudo a un átomo que exige un union cerrado. */}
          <StatusBadge status={toStatusBadgeVariant(client.status)} />
        </div>
      </div>
      <div className={styles['id-contactRows']}>
        <div className={styles['id-contactRow']}>
          <span className={styles['id-contactLabel']}>Tel</span>
          {client.phone ? (
            <a href={`tel:${client.phone}`} className={styles['id-contactLink']}>
              {client.phone}
            </a>
          ) : (
            <span className={styles['id-contactMuted']}>Sin dato</span>
          )}
        </div>
        <div className={styles['id-contactRow']}>
          <span className={styles['id-contactLabel']}>Email</span>
          {client.email ? (
            <a href={`mailto:${client.email}`} className={styles['id-contactLink']}>
              {client.email}
            </a>
          ) : (
            <span className={styles['id-contactMuted']}>Sin dato</span>
          )}
        </div>
      </div>
      <Link to={`/admin/customers/view/${client.fichaClientId}`} className={styles['id-link']}>
        Ver perfil →
      </Link>
    </div>
  );
}
