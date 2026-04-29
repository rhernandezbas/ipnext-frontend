import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '../../components/atoms/Input/Input';
import { Button } from '../../components/atoms/Button/Button';
import { useCreateTicket } from '../../hooks/useTickets';
import { getClients } from '../../api/clients.api';
import styles from './CreateTicketPage.module.css';

interface FormState {
  subject: string;
  clientId: string;
  clientSearch: string;
  priority: 'alta' | 'media' | 'baja' | '';
  description: string;
  assignedTo: string;
}

interface FormErrors {
  subject?: string;
  clientId?: string;
  priority?: string;
  description?: string;
}

interface ClientOption { id: string; name: string; }

export default function CreateTicketPage() {
  const navigate = useNavigate();
  const { mutateAsync, isPending } = useCreateTicket();

  const [form, setForm] = useState<FormState>({
    subject: '',
    clientId: '',
    clientSearch: '',
    priority: '',
    description: '',
    assignedTo: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  function handleClientSearch(value: string) {
    setForm((f) => ({ ...f, clientSearch: value, clientId: '' }));
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
    if (!form.priority) errs.priority = 'La prioridad es requerida.';
    if (!form.description.trim()) errs.description = 'La descripción es requerida.';
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
        priority: form.priority as 'alta' | 'media' | 'baja',
        description: form.description,
        assignedTo: form.assignedTo || undefined,
      });
      navigate('/admin/tickets');
    } catch {
      setApiError('Error al crear el ticket. Intentá de nuevo.');
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
          <label className={styles.label}>Prioridad *</label>
          <select
            className={[styles.select, errors.priority ? styles.selectError : ''].join(' ')}
            value={form.priority}
            onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as FormState['priority'] }))}
          >
            <option value="">Seleccioná prioridad</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
          {errors.priority && <span className={styles.error}>{errors.priority}</span>}
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
