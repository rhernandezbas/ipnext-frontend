import { useState } from 'react';
import { useConfirm } from '@/context/ConfirmContext';
import { useClientContracts, useAddContract, useUpdateContract, useDeleteContract } from '../../../hooks/useCustomers';
import type { Contract } from '../../../types/customer';
import type { AddContractData, UpdateContractData } from '../../../types/customer';
import { Can } from '../../../components/auth/Can';
import { ServiceInventorySection } from './ServiceInventorySection';
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

export function ContractsTab({ clientId, active }: Props) {
  const confirm = useConfirm();
  const { data, isLoading } = useClientContracts(clientId, active);
  const addContract = useAddContract();
  const updateContract = useUpdateContract();
  const deleteContract = useDeleteContract();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  function openAddForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEditForm(contract: Contract) {
    setEditingId(contract.id);
    setForm({
      type: contract.type,
      plan: contract.plan,
      ipAddress: contract.ipAddress ?? '',
      status: contract.status,
      startDate: contract.startDate,
      endDate: contract.endDate ?? '',
    });
    setShowForm(true);
  }

  function handleField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId !== null) {
      const data: UpdateContractData = {
        type: form.type,
        plan: form.plan,
        ipAddress: form.ipAddress || undefined,
        status: form.status,
        endDate: form.endDate || undefined,
      };
      updateContract.mutate(
        { clientId, contractId: editingId, data },
        { onSuccess: () => setShowForm(false) }
      );
    } else {
      const data: AddContractData = {
        type: form.type,
        plan: form.plan,
        ipAddress: form.ipAddress || undefined,
        status: form.status,
        startDate: form.startDate || undefined,
      };
      addContract.mutate(
        { clientId, data },
        { onSuccess: () => setShowForm(false) }
      );
    }
  }

  async function handleDelete(contractId: number) {
    if (await confirm({ message: '¿Eliminar este contrato?', tone: 'danger', confirmLabel: 'Eliminar' })) {
      deleteContract.mutate({ clientId, contractId });
    }
  }

  const isPending = addContract.isPending || updateContract.isPending;

  return (
    <div className={styles.tab}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <Can permission="clients.write">
          <button onClick={openAddForm} type="button">
            Agregar contrato
          </button>
        </Can>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd' }}>
          <h3>{editingId !== null ? 'Editar contrato' : 'Agregar contrato'}</h3>
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
                <td colSpan={7}>Este cliente no tiene contratos.</td>
              </tr>
            ) : (
              (data ?? []).map((contract) => (
                <tr key={contract.id}>
                  <td>{contract.type}</td>
                  <td>{contract.plan}</td>
                  <td>{contract.ipAddress ?? '—'}</td>
                  <td>{contract.status}</td>
                  <td>{contract.startDate}</td>
                  <td>{contract.endDate ?? '—'}</td>
                  <td>
                    <Can permission="clients.write">
                      <button type="button" onClick={() => openEditForm(contract)}>
                        Editar
                      </button>
                    </Can>
                    <Can permission="clients.delete">
                      <button
                        type="button"
                        onClick={() => handleDelete(contract.id)}
                        disabled={deleteContract.isPending}
                        style={{ marginLeft: '0.5rem' }}
                      >
                        Eliminar
                      </button>
                    </Can>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {!isLoading && (data ?? []).length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h4 style={{ margin: '0 0 0.5rem' }}>Inventario por contrato</h4>
          {(data ?? []).map((contract) => (
            <div key={`inv-${contract.id}`} style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                {contract.type} · {contract.plan}
              </div>
              <ServiceInventorySection serviceId={String(contract.id)} enabled={active} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
