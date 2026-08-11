import { useState } from 'react';
import type { Customer } from '../../../types/customer';
import { CLIENT_STATUS_LABELS } from '../clientStatusLabels';
import { formatDateTimeShort } from '@/utils/formatDate';
import { balanceState } from '@/utils/balanceState';
import styles from './InfoTab.module.css';

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
export function InfoTab({ customer }: Props) {
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

      {/* RIGHT COLUMN: Balance card + Comments + Información adicional */}
      <div className={styles.rightColumn}>
        <BalanceCard customer={customer} />

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
              : value === 'baja' ? 'baja'
              : 'inactive';
  // GR vocabulary for the client domain (Deudor/Incobrable/Bajas), with a safe
  // fallback to a capitalized raw value for any unexpected status.
  const labelText = CLIENT_STATUS_LABELS[value] ?? (value.charAt(0).toUpperCase() + value.slice(1));
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

/* ── Balance card ────────────────────────────────────────────────────────── */

const arsFormatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

function formatARS(amount: number): string {
  return arsFormatter.format(amount);
}

/**
 * `formatRelativeTime` guard (design.md §2 Decision 4): un `isoDate`
 * inválido produce `NaN` en cada paso de la cuenta (`new Date('x').getTime()`
 * ⇒ `NaN`). Antes de este guard el llamador imprimía el literal "hace NaN d"
 * — un error de datos NO le sirve al operador. Devolver `null` deja que el
 * llamador omita el bloque entero (misma convención que ya usa para
 * `lastBalanceAt` ausente).
 */
function formatRelativeTime(isoDate: string): string | null {
  const t = new Date(isoDate).getTime();
  if (!Number.isFinite(t)) return null;
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'hace un momento';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

const UNKNOWN_BALANCE_REASON =
  'el cliente no está vinculado a Gestión Real o su saldo nunca se sincronizó';

function BalanceCard({ customer }: { customer: Customer }) {
  const { balanceDue, balanceStale, lastBalanceAt } = customer;
  const state = balanceState(balanceDue);
  // FX4 (fix wave, R1 M4): MISMO gate que el chip de stale de abajo — sin
  // dato no hay nada que pueda estar "actualizado". El `lastBalanceAt` de un
  // cliente sin `grClienteId` marca el último INTENTO de sincronización, no
  // un saldo real; imprimir "Saldo no disponible · Actualizado hace 2 h" le
  // afirma al operador que hay un dato fresco que no existe.
  const relative = state.kind !== 'unknown' && lastBalanceAt ? formatRelativeTime(lastBalanceAt) : null;
  // CARD-4 (design §2 Decision 3): el chip de "desactualizado" sólo tiene
  // sentido cuando HAY un dato que pueda estar viejo — con balanceDue==null
  // el BE puede mandar balanceStale:true de forma permanente (cliente sin
  // grClienteId, nunca se refresca), y mostrar los dos avisos juntos se
  // contradice en pantalla.
  const showStale = state.kind !== 'unknown' && balanceStale === true;

  return (
    <section className={styles.card}>
      <header className={styles.cardHeader}>
        {/* FX7 (fix wave, R1 M7): el título era el literal "Saldo deudor" —
            coronaba un CRÉDITO ("Saldo deudor / A favor $ 5.000") y un cero
            medido con la palabra "deudor". Título NEUTRO, el MISMO rótulo que
            usa el sub-header de la página para el mismo dato; el estado sigue
            diciéndose donde corresponde (badge "Deudor" / "A favor" / "Sin
            deuda" / "Saldo no disponible"). Se eligió neutro sobre "por
            estado" porque ningún assert de CARD-1..4 matchea el título — el
            cambio es puramente aditivo en honestidad. */}
        <h2 className={styles.cardTitle}>Saldo de la cuenta</h2>
        {relative && (
          <span className={styles.balanceTimestamp} title={formatDateTimeShort(lastBalanceAt!)}>
            Actualizado {relative}
          </span>
        )}
        {showStale && (
          <span className={styles.balanceStaleChip} data-testid="balance-stale">
            <span aria-hidden>⚠</span> Desactualizado
          </span>
        )}
      </header>
      <div className={`${styles.cardBody} ${styles.balanceBody}`}>
        {state.kind === 'unknown' && (
          <div
            className={styles.balanceUnknown}
            data-testid="balance-unknown"
            title={`Saldo no disponible: ${UNKNOWN_BALANCE_REASON}`}
            aria-label={`Saldo no disponible: ${UNKNOWN_BALANCE_REASON}`}
          >
            <span aria-hidden>—</span> Saldo no disponible
          </div>
        )}
        {state.kind === 'credit' && (
          <div className={styles.balanceAmountWrap} data-testid="balance-credit">
            <span className={styles.balanceCreditBadge}>A favor</span>
            <span className={styles.balanceCredit}>{formatARS(state.amount)}</span>
          </div>
        )}
        {state.kind === 'settled' && (
          <div className={styles.balanceNeutral} data-testid="balance-no-debt">
            <span className={styles.balanceCheckIcon} aria-hidden>✓</span>
            Sin deuda
          </div>
        )}
        {state.kind === 'debt' && (
          <div className={styles.balanceAmountWrap}>
            <span className={styles.balanceDebtorBadge} aria-label="Estado deudor">Deudor</span>
            <span className={styles.balanceAmount} data-testid="balance-amount">
              {formatARS(state.amount)}
            </span>
          </div>
        )}
      </div>
    </section>
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
