import type { SuricataTicketDetailDto } from '../api/suricataClient';
import styles from './SuricataClientDataTab.module.css';

interface Props {
  ticket: SuricataTicketDetailDto;
}

function PlaceholderSection({ title, reason }: { title: string; reason: string }) {
  return (
    <section className={styles.section} aria-label={title}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <p className={styles.placeholder}>{reason}</p>
    </section>
  );
}

/**
 * SuricataClientDataTab — UI-5, checklist "Análisis 360" de la skill
 * `atencion-suricata-ipnext` (5 secciones exactas del spec). Read-only por
 * construcción: este componente no renderiza NINGÚN control de escritura
 * (ni siquiera un link) — no hay forma de que "vincular a mano" ocurra desde
 * acá (design D13.b lo prohíbe explícitamente en este change).
 *
 * Las 3 secciones sin fuente de datos en este change (historial cruzado de
 * tickets, misma casuística, equipo/señal, deuda/estado administrativo)
 * muestran un placeholder honesto en vez de inventar datos — dependen de
 * otras integraciones (Gestión Real, SmartOLT/Ubiquiti) fuera de este change.
 */
export function SuricataClientDataTab({ ticket }: Props) {
  const firstCustomerMessage = ticket.messages.find((m) => m.authorKind === 'customer');

  return (
    <div className={styles.wrapper}>
      <section className={styles.section} aria-label="Datos de contacto (Suricata)">
        <h3 className={styles.sectionTitle}>Datos de contacto</h3>
        <dl className={styles.contactList}>
          <div className={styles.contactRow}>
            <dt>Nombre</dt>
            <dd>{ticket.customerName ?? '—'}</dd>
          </div>
          <div className={styles.contactRow}>
            <dt>Email</dt>
            <dd>{ticket.customerEmail ?? '—'}</dd>
          </div>
          <div className={styles.contactRow}>
            <dt>Teléfono</dt>
            <dd>{ticket.customerPhone ?? '—'}</dd>
          </div>
          <div className={styles.contactRow}>
            <dt>Ref. externa</dt>
            <dd>{ticket.externalClientRef ?? '—'}</dd>
          </div>
        </dl>
        {ticket.clientId ? (
          <p className={styles.matched}>Vinculado a un cliente de Prominense.</p>
        ) : (
          <p className={styles.unmatched}>Sin cliente vinculado en Prominense.</p>
        )}
      </section>

      <PlaceholderSection
        title="Historial de conversaciones previas"
        reason="No disponible en este panel todavía — requiere listar otros tickets del mismo cliente (fuera de este change)."
      />

      <section className={styles.section} aria-label="Resumen del reclamo actual">
        <h3 className={styles.sectionTitle}>Resumen del reclamo actual</h3>
        <p className={styles.summaryText}>{ticket.subject}</p>
        {firstCustomerMessage ? (
          <p className={styles.summaryExcerpt}>&ldquo;{firstCustomerMessage.body}&rdquo;</p>
        ) : (
          <p className={styles.placeholder}>Sin mensaje del cliente todavía.</p>
        )}
      </section>

      <PlaceholderSection
        title="¿Misma casuística que un reclamo anterior?"
        reason="No disponible todavía — requiere comparar contra el historial de reclamos (fuera de este change)."
      />
      <PlaceholderSection
        title="Estado de equipo / señal"
        reason="No disponible todavía — requiere integración con SmartOLT/Ubiquiti (fuera de este change)."
      />
      <PlaceholderSection
        title="Estado administrativo / deuda"
        reason="No disponible todavía — requiere integración con Gestión Real (fuera de este change)."
      />
    </div>
  );
}
