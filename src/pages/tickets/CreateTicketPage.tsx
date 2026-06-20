import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '../../components/atoms/Input/Input';
import { Button } from '../../components/atoms/Button/Button';
import { useCreateTicket } from '../../hooks/useTickets';
import { useTicketAreas } from '../../hooks/useTicketAreas';
import { useClientContracts } from '../../hooks/useCustomers';
import { buildContractLabel } from '../../lib/buildContractLabel';
import { getClients } from '../../api/customers.api';
import styles from './CreateTicketPage.module.css';

interface FormState {
  subject: string;
  clientId: string;
  clientSearch: string;
  contractId: string;
  priority: 'alta' | 'media' | 'baja' | '';
  description: string;
  assignedTo: string;
  areaId: string;
}

interface FormErrors {
  subject?: string;
  clientId?: string;
  contractId?: string;
  priority?: string;
  description?: string;
  areaId?: string;
}

/** Maps the BE error `code` (POST /tickets) to a clear, field-aware message. */
const BE_ERROR_MESSAGES: Record<string, string> = {
  CUSTOMER_NOT_FOUND: 'El cliente seleccionado no existe. Elegí otro cliente.',
  CONTRACT_NOT_FOUND: 'El contrato seleccionado no existe. Elegí otro contrato.',
  CONTRACT_CUSTOMER_MISMATCH: 'El contrato no pertenece al cliente seleccionado. Volvé a elegir el contrato.',
};

interface ClientOption { id: string; name: string; }

export default function CreateTicketPage() {
  const navigate = useNavigate();
  const { mutateAsync, isPending } = useCreateTicket();
  const {
    data: areas = [],
    isLoading: areasLoading,
    isError: areasError,
    refetch: refetchAreas,
  } = useTicketAreas();

  const [form, setForm] = useState<FormState>({
    subject: '',
    clientId: '',
    clientSearch: '',
    contractId: '',
    priority: '',
    description: '',
    assignedTo: '',
    areaId: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // Contracts of the selected client. Only fetched once a client is picked
  // (mirrors CreateTaskModal's `useClientContracts(customerId, !!customerId)`).
  const {
    data: contracts = [],
    isLoading: contractsLoading,
  } = useClientContracts(form.clientId, !!form.clientId);

  // Reset the contract whenever the client changes — a stale contract from the
  // previous client would never belong to the new one (BE → 422 MISMATCH).
  useEffect(() => {
    setForm((f) => ({ ...f, contractId: '' }));
  }, [form.clientId]);

  function handleClientSearch(value: string) {
    // Clearing/changing the client also clears the picked contract.
    setForm((f) => ({ ...f, clientSearch: value, clientId: '', contractId: '' }));
    if (searchTimer) clearTimeout(searchTimer);
    if (!value) { setClientOptions([]); return; }
    const timer = setTimeout(async () => {
      const result = await getClients({ search: value, pageSize: 10 });
      setClientOptions(result.data.map((c) => ({ id: String(c.id), name: c.name })));
    }, 300);
    setSearchTimer(timer);
  }

  function validate(): boolean {
    const errs: FormErrors = {};
    if (!form.subject.trim()) errs.subject = 'El asunto es requerido.';
    if (!form.clientId) errs.clientId = 'Seleccioná un cliente.';
    if (!form.contractId) errs.contractId = 'Seleccioná un contrato.';
    if (!form.priority) errs.priority = 'La prioridad es requerida.';
    if (!form.description.trim()) errs.description = 'La descripción es requerida.';
    if (!form.areaId) errs.areaId = 'El area es requerida.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setApiError(null);
    try {
      await mutateAsync({
        subject: form.subject,
        clientId: form.clientId,
        contractId: form.contractId,
        priority: form.priority as 'alta' | 'media' | 'baja',
        description: form.description,
        assignedTo: form.assignedTo || undefined,
        areaId: form.areaId,
      });
      navigate('/admin/tickets');
    } catch (err) {
      // Surface the BE validation code with a clear, contract-aware message; fall
      // back to a generic one for unmapped/transport errors.
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      setApiError(
        (code && BE_ERROR_MESSAGES[code]) ?? 'Error al crear el ticket. Intentá de nuevo.',
      );
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Nuevo Ticket</h1>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label className={styles.label}>Asunto *</label>
          <Input
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            error={errors.subject}
            placeholder="Asunto del ticket"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Cliente *</label>
          <Input
            value={form.clientSearch}
            onChange={(e) => handleClientSearch(e.target.value)}
            error={errors.clientId}
            placeholder="Buscar cliente..."
          />
          {clientOptions.length > 0 && !form.clientId && (
            <ul className={styles.suggestions}>
              {clientOptions.map((c) => (
                <li
                  key={c.id}
                  className={styles.suggestion}
                  onClick={() => {
                    setForm((f) => ({ ...f, clientId: c.id, clientSearch: c.name }));
                    setClientOptions([]);
                  }}
                >
                  {c.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="ticket-contract">Contrato *</label>
          <select
            id="ticket-contract"
            className={[styles.select, errors.contractId ? styles.selectError : ''].join(' ')}
            value={form.contractId}
            onChange={(e) => setForm((f) => ({ ...f, contractId: e.target.value }))}
            // No client → nothing to choose. Loading / empty contracts → also
            // non-selectable, so the placeholder explains why.
            disabled={!form.clientId || contractsLoading || contracts.length === 0}
            aria-label="Contrato"
          >
            <option value="">
              {!form.clientId
                ? 'Seleccioná un cliente primero'
                : contractsLoading
                  ? 'Cargando contratos…'
                  : contracts.length === 0
                    ? 'Este cliente no tiene contratos'
                    : 'Seleccioná un contrato'}
            </option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>{buildContractLabel(c)}</option>
            ))}
          </select>
          {form.clientId && !contractsLoading && contracts.length === 0 && (
            <span className={styles.error}>
              Este cliente no tiene contratos. No se puede crear el ticket.
            </span>
          )}
          {errors.contractId && <span className={styles.error}>{errors.contractId}</span>}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Prioridad *</label>
          <select
            className={[styles.select, errors.priority ? styles.selectError : ''].join(' ')}
            value={form.priority}
            onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as FormState['priority'] }))}
            aria-label="Prioridad"
          >
            <option value="">Seleccioná prioridad</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
          {errors.priority && <span className={styles.error}>{errors.priority}</span>}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Area *</label>
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
              className={[styles.select, errors.areaId ? styles.selectError : ''].join(' ')}
              value={form.areaId}
              onChange={(e) => setForm((f) => ({ ...f, areaId: e.target.value }))}
              disabled={areasLoading}
              aria-label="Area"
            >
              <option value="">
                {areasLoading ? 'Cargando areas…' : 'Selecciona un area'}
              </option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}
          {errors.areaId && <span className={styles.error}>{errors.areaId}</span>}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Descripción *</label>
          <textarea
            className={[styles.textarea, errors.description ? styles.selectError : ''].join(' ')}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={5}
            placeholder="Descripción del problema..."
          />
          {errors.description && <span className={styles.error}>{errors.description}</span>}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Asignado a (opcional)</label>
          <Input
            value={form.assignedTo}
            onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))}
            placeholder="ID de agente"
          />
        </div>

        {apiError && <p className={styles.apiError}>{apiError}</p>}

        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button type="submit" variant="primary" loading={isPending}>Crear Ticket</Button>
        </div>
      </form>
    </div>
  );
}
