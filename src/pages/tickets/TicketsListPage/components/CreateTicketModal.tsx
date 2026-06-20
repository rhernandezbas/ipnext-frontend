import { useEffect, useState } from 'react';
import { useRbacUsers } from '@/hooks/useRbacUsers';
import { useTicketAreas } from '@/hooks/useTicketAreas';
import { useClientContracts } from '@/hooks/useCustomers';
import { buildContractLabel } from '@/lib/buildContractLabel';
import { CustomerPicker } from '@/pages/scheduling/SchedulingTasksPage/components/CustomerPicker';
import type { CreateTicketData } from '@/types/ticket';
import styles from './CreateTicketModal.module.css';

export interface CreateTicketModalProps {
  onClose: () => void;
  onCreate: (data: CreateTicketData) => Promise<unknown>;
  loading: boolean;
}

interface FormErrors {
  subject?: string;
  message?: string;
  priority?: string;
  customerId?: string;
  contractId?: string;
  areaId?: string;
}

export function CreateTicketModal({ onClose, onCreate, loading }: CreateTicketModalProps) {
  const { data: users = [] } = useRbacUsers();
  const {
    data: areas = [],
    isLoading: areasLoading,
    isError: areasError,
    refetch: refetchAreas,
  } = useTicketAreas();

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical' | ''>('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  // contractId is INTENTIONALLY never seeded — the operator must pick it.
  const [contractId, setContractId] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState('');
  const [areaId, setAreaId] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  // Contracts of the selected customer (mirrors CreateTaskModal).
  const {
    data: contracts = [],
    isLoading: contractsLoading,
  } = useClientContracts(customerId ?? '', !!customerId);

  // Reset the contract whenever the customer changes — a stale contract from the
  // previous customer would 422 (CONTRACT_CUSTOMER_MISMATCH) at the BE.
  useEffect(() => {
    setContractId(null);
  }, [customerId]);

  function validate(): boolean {
    const errs: FormErrors = {};
    if (!subject.trim()) errs.subject = 'El asunto es requerido.';
    if (!message.trim()) errs.message = 'El mensaje es requerido.';
    if (!customerId) errs.customerId = 'Seleccioná un cliente.';
    if (!contractId) errs.contractId = 'Seleccioná un contrato.';
    if (!areaId) errs.areaId = 'El area es requerida.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    // #28 follow-up — wire shape: `description` (the BE 400s without it),
    // `assigneeId` as the RbacUser id string (Number(uuid) was NaN), and a
    // clean null customerId ('' hit the FK).
    await onCreate({
      subject: subject.trim(),
      description: message.trim(),
      priority: (priority || 'medium') as CreateTicketData['priority'],
      customerId: customerId,
      // Required by the BE — validated above, so it's non-null here.
      contractId: contractId,
      assigneeId: assignedTo || undefined,
      areaId: areaId,
    });
    onClose();
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Nuevo ticket">
        <div className={styles.header}>
          <h2 className={styles.title}>Nuevo ticket</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar modal">×</button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor="ticket-subject" className={styles.label}>Asunto *</label>
            <input
              id="ticket-subject"
              className={[styles.input, errors.subject ? styles.inputError : ''].join(' ')}
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Asunto del ticket"
              disabled={loading}
              aria-label="Asunto"
            />
            {errors.subject && <span className={styles.error}>{errors.subject}</span>}
          </div>

          <div className={styles.field}>
            <label htmlFor="ticket-message" className={styles.label}>Mensaje *</label>
            <textarea
              id="ticket-message"
              className={[styles.textarea, errors.message ? styles.inputError : ''].join(' ')}
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={4}
              placeholder="Descripción del problema..."
              disabled={loading}
              aria-label="Mensaje"
            />
            {errors.message && <span className={styles.error}>{errors.message}</span>}
          </div>

          <div className={styles.field}>
            <label htmlFor="ticket-priority" className={styles.label}>Prioridad</label>
            <select
              id="ticket-priority"
              className={styles.select}
              value={priority}
              onChange={e => setPriority(e.target.value as typeof priority)}
              disabled={loading}
              aria-label="Prioridad"
            >
              <option value="">Seleccioná prioridad</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
            {errors.priority && <span className={styles.error}>{errors.priority}</span>}
          </div>

          <div className={styles.field}>
            <label htmlFor="ticket-area" className={styles.label}>Area *</label>
            {areasError ? (
              // Catalog failed to load: a blank required select would trap the
              // user with no explanation. Offer an explicit retry instead.
              <div className={styles.areaState} role="alert">
                <span className={styles.error}>No se pudieron cargar las areas.</span>
                <button
                  type="button"
                  className={styles.retry}
                  onClick={() => { void refetchAreas(); }}
                >
                  Reintentar
                </button>
              </div>
            ) : (
              <select
                id="ticket-area"
                className={[styles.select, errors.areaId ? styles.inputError : ''].join(' ')}
                value={areaId}
                onChange={e => setAreaId(e.target.value)}
                disabled={loading || areasLoading}
                aria-label="Area"
              >
                <option value="">
                  {areasLoading ? 'Cargando areas…' : 'Selecciona un area'}
                </option>
                {areas.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            )}
            {errors.areaId && <span className={styles.error}>{errors.areaId}</span>}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Cliente *</label>
            <CustomerPicker
              value={customerId}
              valueName={customerName}
              onChange={(id, name) => { setCustomerId(id); setCustomerName(name); }}
            />
            {errors.customerId && <span className={styles.error}>{errors.customerId}</span>}
          </div>

          <div className={styles.field}>
            <label htmlFor="ticket-contract" className={styles.label}>Contrato *</label>
            <select
              id="ticket-contract"
              className={[styles.select, errors.contractId ? styles.inputError : ''].join(' ')}
              value={contractId ?? ''}
              onChange={e => setContractId(e.target.value || null)}
              disabled={loading || !customerId || contractsLoading || contracts.length === 0}
              aria-label="Contrato"
            >
              <option value="">
                {!customerId
                  ? 'Seleccioná un cliente primero'
                  : contractsLoading
                    ? 'Cargando contratos…'
                    : contracts.length === 0
                      ? 'Este cliente no tiene contratos'
                      : 'Seleccioná un contrato'}
              </option>
              {contracts.map(c => (
                <option key={c.id} value={c.id}>{buildContractLabel(c)}</option>
              ))}
            </select>
            {customerId && !contractsLoading && contracts.length === 0 && (
              <span className={styles.error}>
                Este cliente no tiene contratos. No se puede crear el ticket.
              </span>
            )}
            {errors.contractId && <span className={styles.error}>{errors.contractId}</span>}
          </div>

          <div className={styles.field}>
            <label htmlFor="ticket-assigned" className={styles.label}>Asignado (opcional)</label>
            <select
              id="ticket-assigned"
              className={styles.select}
              value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
              disabled={loading}
              aria-label="Asignado"
            >
              <option value="">— Sin asignar —</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={loading}
            >
              {loading ? 'Creando…' : 'Crear ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
