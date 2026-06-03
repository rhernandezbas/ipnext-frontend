import { useState } from 'react';
import {
  useServiceInstalledItems,
  useAddInstalledItem,
  useUpdateInstalledItem,
  useRemoveInstalledItem,
} from '@/hooks/useServiceInventory';
import { useDeviceTypes } from '@/hooks/useDeviceTypes';
import { Can } from '@/components/auth/Can';
import { useConfirm } from '@/context/ConfirmContext';
import type { InstalledItemType, ServiceInstalledItem } from '@/types/serviceInventory';

const FALLBACK_TYPES: InstalledItemType[] = ['ONU', 'ROUTER', 'ANTENA', 'REPETIDOR', 'OTROS'];

interface Props {
  serviceId: string;
  /** Defer the query until the section is actually shown. */
  enabled?: boolean;
}

/**
 * "Equipos instalados" on a contract (Service). Lists the installed devices
 * (one row per physical equipment) and lets an operator manually attach a
 * serial — the "agregar SN al servicio" flow. Devices auto-suggested from a
 * closed OS are confirmed from the task; this is the manual / review surface.
 */
export function ServiceInventorySection({ serviceId, enabled = true }: Props) {
  const { data, isLoading } = useServiceInstalledItems(serviceId, enabled);
  const addItem = useAddInstalledItem(serviceId);
  const updateItem = useUpdateInstalledItem(serviceId);
  const removeItem = useRemoveInstalledItem(serviceId);
  const { data: deviceTypes = [], isLoading: typesLoading } = useDeviceTypes();
  const confirm = useConfirm();

  // Active types ordered by sortOrder; fall back to hardcoded list while loading
  const activeTypes: InstalledItemType[] = !typesLoading && deviceTypes.length > 0
    ? deviceTypes.filter(dt => dt.active).sort((a, b) => a.sortOrder - b.sortOrder).map(dt => dt.name)
    : FALLBACK_TYPES;

  const emptyForm = () => ({ type: activeTypes[0] ?? 'ROUTER', serialNumber: '', mac: '', model: '', notes: '' });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(() => ({ type: 'ROUTER', serialNumber: '', mac: '', model: '', notes: '' }));
  const [editingItem, setEditingItem] = useState<ServiceInstalledItem | null>(null);
  const [editForm, setEditForm] = useState({ type: '', serialNumber: '', mac: '', model: '', notes: '' });

  function field<K extends keyof ReturnType<typeof emptyForm>>(k: K, v: string) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  function editField<K extends keyof typeof editForm>(k: K, v: string) {
    setEditForm(prev => ({ ...prev, [k]: v }));
  }

  function openEdit(item: ServiceInstalledItem) {
    setEditingItem(item);
    setEditForm({
      type: item.type,
      serialNumber: item.serialNumber ?? '',
      mac: item.mac ?? '',
      model: item.model ?? '',
      notes: item.notes ?? '',
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    addItem.mutate(
      {
        type: form.type,
        serialNumber: form.serialNumber || undefined,
        mac: form.mac || undefined,
        model: form.model || undefined,
        notes: form.notes || undefined,
      },
      { onSuccess: () => { setShowForm(false); setForm(emptyForm()); } },
    );
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem) return;
    await updateItem.mutateAsync({
      itemId: editingItem.id,
      patch: {
        serialNumber: editForm.serialNumber || null,
        mac: editForm.mac || null,
        model: editForm.model || null,
        notes: editForm.notes || null,
      },
    });
    setEditingItem(null);
  }

  async function handleRemove(item: ServiceInstalledItem) {
    if (!(await confirm({ message: `¿Quitar el equipo "${item.type}${item.serialNumber ? ` (${item.serialNumber})` : ''}"?`, tone: 'danger', confirmLabel: 'Quitar' }))) return;
    await removeItem.mutateAsync(item.id);
  }

  const items = data ?? [];

  return (
    <div style={{ marginTop: '0.75rem', paddingLeft: '0.5rem', borderLeft: '3px solid #e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <strong style={{ fontSize: '0.85rem', color: '#374151' }}>Equipos instalados</strong>
        <Can permission="inventory.write">
          <button type="button" onClick={() => setShowForm(s => !s)}>
            {showForm ? 'Cancelar' : 'Agregar SN al contrato'}
          </button>
        </Can>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', padding: '0.5rem', border: '1px solid #ddd', borderRadius: 6 }}>
          <select value={form.type} onChange={e => field('type', e.target.value)} required>
            {activeTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="text" placeholder="Serial (SN)" value={form.serialNumber} onChange={e => field('serialNumber', e.target.value)} />
          <input type="text" placeholder="MAC" value={form.mac} onChange={e => field('mac', e.target.value)} />
          <input type="text" placeholder="Modelo" value={form.model} onChange={e => field('model', e.target.value)} />
          <button type="submit" disabled={addItem.isPending}>{addItem.isPending ? 'Guardando…' : 'Guardar'}</button>
        </form>
      )}

      {editingItem && (
        <form onSubmit={handleEditSubmit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', padding: '0.5rem', border: '1px solid #6366f1', borderRadius: 6 }}>
          <select value={editForm.type} onChange={e => editField('type', e.target.value)} required>
            {activeTypes.map(t => <option key={t} value={t}>{t}</option>)}
            {editForm.type && !activeTypes.includes(editForm.type) && (
              <option value={editForm.type}>{editForm.type}</option>
            )}
          </select>
          <input type="text" placeholder="Serial (SN)" value={editForm.serialNumber} onChange={e => editField('serialNumber', e.target.value)} />
          <input type="text" placeholder="MAC" value={editForm.mac} onChange={e => editField('mac', e.target.value)} />
          <input type="text" placeholder="Modelo" value={editForm.model} onChange={e => editField('model', e.target.value)} />
          <button type="submit" disabled={updateItem.isPending}>{updateItem.isPending ? 'Guardando…' : 'Guardar cambios'}</button>
          <button type="button" onClick={() => setEditingItem(null)}>Cancelar</button>
        </form>
      )}

      {isLoading ? (
        <p style={{ fontSize: '0.8rem', color: '#6b7280' }}>Cargando equipos…</p>
      ) : items.length === 0 ? (
        <p style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Sin equipos cargados en este contrato.</p>
      ) : (
        <table style={{ fontSize: '0.8rem', width: '100%' }}>
          <thead>
            <tr><th>Tipo</th><th>SN</th><th>MAC</th><th>Modelo</th><th>Origen</th><th>Estado</th><th>Aprobado por</th><th></th></tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id}>
                <td>{it.type}</td>
                <td>{it.serialNumber ?? '—'}</td>
                <td>{it.mac ?? '—'}</td>
                <td>{it.model ?? '—'}</td>
                <td>{it.source}</td>
                <td>{it.status}</td>
                <td>{it.addedByUserName ? `${it.addedByUserName}${it.confirmedAt ? ` · ${new Date(it.confirmedAt).toLocaleDateString('es-AR')}` : ''}` : '—'}</td>
                <td>
                  <Can permission="inventory.write">
                    <button type="button" onClick={() => openEdit(it)} style={{ marginRight: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1' }}>Editar</button>
                    <button type="button" onClick={() => handleRemove(it)} disabled={removeItem.isPending} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>Quitar</button>
                  </Can>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
