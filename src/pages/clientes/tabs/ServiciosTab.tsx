import { useState } from 'react';
import { useClientServices, useAddService, useUpdateService, useDeleteService } from '../../../hooks/useClients';
import type { Service } from '../../../types/customer';
import type { AddServiceData, UpdateServiceData } from '../../../types/customer';
import styles from './Tab.module.css';

interface Props { clientId: string; active: boolean; }

const SERVICE_TYPES = ['internet', 'voz', 'tv'];
const SERVICE_STATUSES = ['active', 'suspended', 'cancelled'];

interface FormState {
  type: string;
  plan: string;
  ipAddress: string;
  status: string;
  startDate: string;
  endDate: string;
}

const EMPTY_FORM: FormState = {
  type: 'internet',
  plan: '',
  ipAddress: '',
  status: 'active',
  startDate: '',
  endDate: '',
};

export function ServiciosTab({ clientId, active }: Props) {
  const { data, isLoading } = useClientServices(clientId, active);
  const addService = useAddService();
  const updateService = useUpdateService();
  const deleteService = useDeleteService();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  function openAddForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEditForm(service: Service) {
    setEditingId(service.id);
    setForm({
      type: service.type,
      plan: service.plan,
      ipAddress: service.ipAddress ?? '',
      status: service.status,
      startDate: service.startDate,
      endDate: service.endDate ?? '',
    });
    setShowForm(true);
  }

  function handleField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId !== null) {
      const data: UpdateServiceData = {
        type: form.type,
        plan: form.plan,
        ipAddress: form.ipAddress || undefined,
        status: form.status,
        endDate: form.endDate || undefined,
      };
      updateService.mutate(
        { clientId, serviceId: editingId, data },
        { onSuccess: () => setShowForm(false) }
      );
    } else {
      const data: AddServiceData = {
        type: form.type,
        plan: form.plan,
        ipAddress: form.ipAddress || undefined,
        status: form.status,
        startDate: form.startDate || undefined,
      };
      addService.mutate(
        { clientId, data },
        { onSuccess: () => setShowForm(false) }
      );
    }
  }

  function handleDelete(serviceId: number) {
    if (window.confirm('¿Eliminar este servicio?')) {
      deleteService.mutate({ clientId, serviceId });
    }
  }

  const isPending = addService.isPending || updateService.isPending;

  return (
    <div className={styles.tab}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button onClick={openAddForm} type="button">
          Agregar servicio
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd' }}>
          <h3>{editingId !== null ? 'Editar servicio' : 'Agregar servicio'}</h3>
          <div>
            <label>
              Tipo
              <select
                value={form.type}
                onChange={(e) => handleField('type', e.target.value)}
                required
              >
                {SERVICE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <label>
              Plan
              <input
                type="text"
                value={form.plan}
                onChange={(e) => handleField('plan', e.target.value)}
                required
              />
            </label>
          </div>
          <div>
            <label>
              IP (opcional)
              <input
                type="text"
                value={form.ipAddress}
                onChange={(e) => handleField('ipAddress', e.target.value)}
              />
            </label>
          </div>
          <div>
            <label>
              Estado
              <select
                value={form.status}
                onChange={(e) => handleField('status', e.target.value)}
              >
                {SERVICE_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          {editingId === null && (
            <div>
              <label>
                Fecha inicio
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => handleField('startDate', e.target.value)}
                />
              </label>
            </div>
          )}
          <div style={{ marginTop: '0.5rem' }}>
            <button type="submit" disabled={isPending}>
              {isPending ? 'Guardando...' : 'Guardar'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={{ marginLeft: '0.5rem' }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p>Cargando...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Plan</th>
              <th>IP</th>
              <th>Estado</th>
              <th>Fecha inicio</th>
              <th>Fecha fin</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).length === 0 ? (
              <tr>
                <td colSpan={7}>Este cliente no tiene servicios.</td>
              </tr>
            ) : (
              (data ?? []).map((service) => (
                <tr key={service.id}>
                  <td>{service.type}</td>
                  <td>{service.plan}</td>
                  <td>{service.ipAddress ?? '—'}</td>
                  <td>{service.status}</td>
                  <td>{service.startDate}</td>
                  <td>{service.endDate ?? '—'}</td>
                  <td>
                    <button type="button" onClick={() => openEditForm(service)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(service.id)}
                      disabled={deleteService.isPending}
                      style={{ marginLeft: '0.5rem' }}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
