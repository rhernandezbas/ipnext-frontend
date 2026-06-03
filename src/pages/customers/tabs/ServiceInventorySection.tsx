import { useState } from 'react';
import { useServiceInstalledItems, useAddInstalledItem } from '@/hooks/useServiceInventory';
import { Can } from '@/components/auth/Can';
import type { InstalledItemType } from '@/types/serviceInventory';

const TYPES: InstalledItemType[] = ['ONU', 'ROUTER', 'ANTENA', 'REPETIDOR', 'OTROS'];

interface Props {
  serviceId: string;
  /** Defer the query until the section is actually shown. */
  enabled?: boolean;
}

const EMPTY = { type: 'ROUTER' as InstalledItemType, serialNumber: '', mac: '', model: '', notes: '' };

/**
 * "Equipos instalados" on a contract (Service). Lists the installed devices
 * (one row per physical equipment) and lets an operator manually attach a
 * serial — the "agregar SN al servicio" flow. Devices auto-suggested from a
 * closed OS are confirmed from the task; this is the manual / review surface.
 */
export function ServiceInventorySection({ serviceId, enabled = true }: Props) {
  const { data, isLoading } = useServiceInstalledItems(serviceId, enabled);
  const addItem = useAddInstalledItem(serviceId);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);

  function field<K extends keyof typeof EMPTY>(k: K, v: string) {
    setForm(prev => ({ ...prev, [k]: v }));
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
      { onSuccess: () => { setShowForm(false); setForm(EMPTY); } },
    );
  }

  const items = data ?? [];

  return (
    <div style={{ marginTop: '0.75rem', paddingLeft: '0.5rem', borderLeft: '3px solid #e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <strong style={{ fontSize: '0.85rem', color: '#374151' }}>Equipos instalados</strong>
        <Can permission="clients.write">
          <button type="button" onClick={() => setShowForm(s => !s)}>
            {showForm ? 'Cancelar' : 'Agregar SN al contrato'}
          </button>
        </Can>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', padding: '0.5rem', border: '1px solid #ddd', borderRadius: 6 }}>
          <select value={form.type} onChange={e => field('type', e.target.value)} required>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="text" placeholder="Serial (SN)" value={form.serialNumber} onChange={e => field('serialNumber', e.target.value)} />
          <input type="text" placeholder="MAC" value={form.mac} onChange={e => field('mac', e.target.value)} />
          <input type="text" placeholder="Modelo" value={form.model} onChange={e => field('model', e.target.value)} />
          <button type="submit" disabled={addItem.isPending}>{addItem.isPending ? 'Guardando…' : 'Guardar'}</button>
        </form>
      )}

      {isLoading ? (
        <p style={{ fontSize: '0.8rem', color: '#6b7280' }}>Cargando equipos…</p>
      ) : items.length === 0 ? (
        <p style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Sin equipos cargados en este contrato.</p>
      ) : (
        <table style={{ fontSize: '0.8rem', width: '100%' }}>
          <thead>
            <tr><th>Tipo</th><th>SN</th><th>MAC</th><th>Modelo</th><th>Origen</th><th>Estado</th><th>Aprobado por</th></tr>
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
