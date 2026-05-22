import { useState } from 'react';
import type { Customer } from '../../../types/customer';
import styles from './InformacionTab.module.css';

interface Props { customer: Customer; active: boolean; }

/**
 * Splynx-style 2-column layout:
 *   Left  → Información principal (account + contact)
 *   Right → Comments / To-Dos + Información adicional (CRM-like custom fields)
 *
 * Fields are rendered as inline form inputs (read-only for now). Persisting
 * edits is deferred to a follow-up — the PATCH /api/clients/:id route still
 * uses the legacy in-memory store and was skipped in the refactor (see
 * clients.routes.test.ts TODO blocks). Marking inputs as `readOnly` keeps
 * the visual parity with Splynx without enabling broken writes.
 *
 * Custom attributes (Labels, Categoría, NIF, etc.) come from
 * customer.customAttributes JSON when present and degrade to empty.
 */
export function InformacionTab({ customer }: Props) {
  const attrs = (customer.customAttributes ?? {}) as Record<string, unknown>;

  return (
    <div className={styles.layout}>
      {/* LEFT COLUMN: Información principal */}
      <section className={styles.card}>
        <header className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Información principal</h2>
        </header>
        <div className={styles.cardBody}>
          <FieldRow label="ID" value={String(customer.id)} readOnly />
          <FieldRow label="Login del portal" value={customer.login ?? ''} />
          <FieldRowPassword label="Contraseña del portal" />
          <FieldRowStatus label="Estado" value={customer.status} />
          <FieldRowSelect
            label="Tipo de facturación"
            value={(attrs['billingType'] as string) ?? 'Pagos recurrentes'}
            options={['Pagos recurrentes', 'Prepago', 'Contado']}
          />
          <FieldRow label="Nombre completo" value={customer.name} />
          <FieldRowIcon
            label="Correo Electrónico"
            value={customer.email}
            icon="mail"
            href={`mailto:${customer.email}`}
          />
          <FieldRowIcon
            label="Correo electrónico de facturación"
            value={(attrs['billingEmail'] as string) ?? customer.email}
            icon="mail"
            href={`mailto:${(attrs['billingEmail'] as string) ?? customer.email}`}
          />
          <FieldRowIcon
            label="Número de teléfono"
            value={customer.phone}
            icon="phone"
            href={`tel:${customer.phone}`}
          />
          <FieldRowSelect
            label="Socio"
            value={(attrs['partner'] as string) ?? 'Main'}
            options={['Main', 'Sucursal 1', 'Sucursal 2']}
          />
          <FieldRow label="Ubicación" value={customer.city || '—'} />
          <FieldRow label="Calle" value={customer.address || '—'} />
          <FieldRow label="País" value={customer.country || 'Argentina'} />
        </div>
      </section>

      {/* RIGHT COLUMN: Comments + Información adicional */}
      <div className={styles.rightColumn}>
        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Comments / To-Dos</h2>
            <button type="button" className={styles.addBtn} aria-label="Agregar comentario">+</button>
          </header>
          <div className={styles.cardBody}>
            <p className={styles.emptyState}>No comments.</p>
          </div>
        </section>

        <CollapsibleCard title="Información adicional" defaultOpen>
          <FieldRowLabels label="Labels" value={(attrs['labels'] as string[]) ?? []} />
          <FieldRowSelect
            label="Categoría"
            value={(attrs['category'] as string) ?? 'Particular'}
            options={['Particular', 'Empresa', 'Gobierno', 'Cooperativa']}
          />
          <FieldRow label="Fecha de nacimiento" value={(attrs['birthDate'] as string) ?? ''} type="date" />
          <FieldRow label="NIF / Pasaporte" value={(attrs['nif'] as string) ?? ''} />
          <FieldRow label="Hotspot MAC" value={(attrs['hotspotMac'] as string) ?? ''} />
          <FieldRowSelect
            label="Agent"
            value={(attrs['agent'] as string) ?? ''}
            options={['', 'Agente 1', 'Agente 2']}
            placeholder="Elija la opción .."
          />
          <FieldRowAction
            label="GPON ONT"
            value={(attrs['gponOnt'] as string) ?? ''}
            actionLabel="Ver / Establecer"
          />
          <FieldRow label="Social ID" value={(attrs['socialId'] as string) ?? ''} />
          <FieldRow label="Comment" value={(attrs['comment'] as string) ?? ''} />
        </CollapsibleCard>
      </div>
    </div>
  );
}

/* ── Row primitives ─────────────────────────────────────────────────────── */

function FieldRow({ label, value, readOnly = false, type = 'text' }: { label: string; value: string; readOnly?: boolean; type?: string }) {
  return (
    <div className={styles.row}>
      <label className={styles.rowLabel}>{label}</label>
      <input
        type={type}
        className={`${styles.input} ${readOnly ? styles.inputReadOnly : ''}`}
        defaultValue={value}
        readOnly
        aria-label={label}
      />
    </div>
  );
}

function FieldRowPassword({ label }: { label: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className={styles.row}>
      <label className={styles.rowLabel}>{label}</label>
      <div className={styles.inputWithButton}>
        <input
          type={shown ? 'text' : 'password'}
          className={styles.input}
          defaultValue={shown ? '••••••••' : ''}
          readOnly
        />
        <button type="button" className={styles.linkBtn} onClick={() => setShown(s => !s)}>
          {shown ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
    </div>
  );
}

function FieldRowStatus({ label, value }: { label: string; value: string }) {
  const tone = value === 'active' ? 'active'
              : value === 'inactive' ? 'inactive'
              : value === 'blocked' ? 'blocked'
              : value === 'late' ? 'late'
              : 'inactive';
  const labelText = value.charAt(0).toUpperCase() + value.slice(1);
  return (
    <div className={styles.row}>
      <label className={styles.rowLabel}>{label}</label>
      <div className={styles.statusWrap}>
        <span className={`${styles.statusBadge} ${styles[`badge_${tone}`]}`}>{labelText}</span>
        <span className={styles.chevron} aria-hidden>▾</span>
      </div>
    </div>
  );
}

function FieldRowSelect({ label, value, options, placeholder }: { label: string; value: string; options: string[]; placeholder?: string }) {
  return (
    <div className={styles.row}>
      <label className={styles.rowLabel}>{label}</label>
      <select className={styles.input} defaultValue={value} aria-label={label}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o} value={o}>{o || (placeholder ?? '—')}</option>)}
      </select>
    </div>
  );
}

function FieldRowIcon({ label, value, icon, href }: { label: string; value: string; icon: 'mail' | 'phone'; href?: string }) {
  return (
    <div className={styles.row}>
      <label className={styles.rowLabel}>{label}</label>
      <div className={styles.inputWithIcon}>
        <input type="text" className={styles.input} defaultValue={value} readOnly aria-label={label} />
        <a href={href} className={styles.iconBtn} aria-label={icon === 'mail' ? 'Enviar correo' : 'Llamar'}>
          {icon === 'mail'
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          }
        </a>
      </div>
    </div>
  );
}

function FieldRowLabels({ label, value }: { label: string; value: string[] }) {
  return (
    <div className={styles.row}>
      <label className={styles.rowLabel}>{label}</label>
      <div className={styles.labelsWrap}>
        {value.length === 0 && <span className={styles.emptyTag}>—</span>}
        {value.map(l => (
          <span key={l} className={styles.tag}>{l} <button type="button" className={styles.tagRemove} aria-label={`Quitar ${l}`}>×</button></span>
        ))}
      </div>
    </div>
  );
}

function FieldRowAction({ label, value, actionLabel }: { label: string; value: string; actionLabel: string }) {
  return (
    <div className={styles.row}>
      <label className={styles.rowLabel}>{label}</label>
      <div className={styles.inputWithButton}>
        <input type="text" className={styles.input} defaultValue={value} readOnly aria-label={label} />
        <button type="button" className={styles.linkBtn}>{actionLabel}</button>
      </div>
    </div>
  );
}

function CollapsibleCard({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={styles.card}>
      <header className={styles.cardHeader} onClick={() => setOpen(o => !o)} role="button" tabIndex={0}>
        <h2 className={styles.cardTitle}>{title}</h2>
        <span className={styles.chevron} aria-hidden>{open ? '⌄' : '›'}</span>
      </header>
      {open && <div className={styles.cardBody}>{children}</div>}
    </section>
  );
}
