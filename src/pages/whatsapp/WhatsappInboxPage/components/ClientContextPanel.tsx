import { Link } from 'react-router-dom';
import type { WhatsappClientContext } from '@/types/whatsapp';
import styles from './ClientContextPanel.module.css';

interface ClientContextPanelProps {
  /** `undefined`/`null` cuando el detalle todavía no trae `clientContext` (design §3 CONTEXT-1, "contexto ausente"). */
  clientContext?: WhatsappClientContext | null;
}

const HEADING_ID = 'wa-context-heading';

function Heading() {
  return (
    <h2 id={HEADING_ID} className={styles.title}>
      Cliente
    </h2>
  );
}

function NeutralState({ message }: { message: string }) {
  return (
    <section className={styles.panel} aria-labelledby={HEADING_ID}>
      <Heading />
      <p className={styles.neutral}>{message}</p>
    </section>
  );
}

/**
 * ClientContextPanel — panel derecho (messaging-inbox F1, design §1, CONTEXT-1).
 * 3 estados excluyentes de `clientContext.status` + un estado neutro cuando
 * `clientContext` está ausente — extiende el patrón visual de `CustomerCard`
 * (`SchedulingTaskDetailPage`), que solo cubre 2 estados (con/sin cliente):
 * acá se agrega `ambiguous` como lista de candidatos, sin auto-elegir ninguno.
 */
export function ClientContextPanel({ clientContext }: ClientContextPanelProps) {
  if (!clientContext) {
    return <NeutralState message="Sin información de contexto disponible." />;
  }

  if (clientContext.status === 'unknown') {
    return (
      <section className={styles.panel} aria-labelledby={HEADING_ID}>
        <Heading />
        <p className={styles.neutral}>Contacto desconocido — sin cliente asociado.</p>
      </section>
    );
  }

  if (clientContext.status === 'ambiguous') {
    if (clientContext.clients.length === 0) {
      return <NeutralState message="Sin información de contexto disponible." />;
    }
    return (
      <section className={styles.panel} aria-labelledby={HEADING_ID}>
        <Heading />
        <p className={styles.hint}>Varios clientes posibles — elegí uno para confirmar.</p>
        <ul className={styles.candidateList}>
          {clientContext.clients.map((c) => (
            <li key={c.id} className={styles.candidateItem}>
              <span className={styles.candidateName}>{c.name}</span>
              <Link to={`/admin/customers/view/${c.id}`} className={styles.link}>
                Ver perfil →
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  // matched
  const client = clientContext.clients[0];
  if (!client) {
    return <NeutralState message="Sin información de contexto disponible." />;
  }

  return (
    <section className={styles.panel} aria-labelledby={HEADING_ID}>
      <Heading />
      <div className={styles.card}>
        <span className={styles.avatar} aria-hidden="true">
          {client.name.charAt(0).toUpperCase()}
        </span>
        <div className={styles.info}>
          <span className={styles.name}>{client.name}</span>
          <Link to={`/admin/customers/view/${client.id}`} className={styles.link}>
            Ver perfil →
          </Link>
        </div>
      </div>
    </section>
  );
}
