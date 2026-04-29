import { useState } from 'react';
import { useOlts, useOnus, useCreateOlt, useCreateOnu, useUpdateOnuStatus } from '@/hooks/useGpon';
import type { OltDevice, OnuDevice } from '@/types/gpon';

type Tab = 'olts' | 'onus';

function StatusBadge({ status }: { status: OltDevice['status'] | OnuDevice['status'] }) {
  const colorMap: Record<string, string> = {
    online: '#059669',
    offline: '#dc2626',
    warning: '#d97706',
    unconfigured: '#6b7280',
  };
  const labelMap: Record<string, string> = {
    online: 'Online',
    offline: 'Offline',
    warning: 'Alerta',
    unconfigured: 'Sin config.',
  };
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.2rem 0.6rem',
      borderRadius: '9999px',
      fontSize: '0.75rem',
      fontWeight: 600,
      color: '#fff',
      background: colorMap[status] ?? '#6b7280',
    }}>
      {labelMap[status] ?? status}
    </span>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function OltsTab() {
  const { data: olts = [], isLoading } = useOlts();
  const { data: allOnus = [] } = useOnus();
  const { mutate: createOlt, isPending: creatingOlt } = useCreateOlt();

  const [showOltModal, setShowOltModal] = useState(false);
  const [oltForm, setOltForm] = useState({ name: '', ip: '', model: '', location: '' });

  const totalOnus = olts.reduce((acc, o) => acc + o.totalOnus, 0);
  const onlineOnus = olts.reduce((acc, o) => acc + o.onlineOnus, 0);
  const onlineOlts = olts.filter(o => o.status === 'online').length;

  if (isLoading) return <p>Cargando...</p>;

  return (
    <div>
      {showOltModal && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: '0.5rem', padding: '1.5rem', minWidth: '360px' }}>
            <p style={{ fontWeight: 700, marginBottom: '1rem' }}>Nueva OLT</p>
            <form onSubmit={e => {
              e.preventDefault();
              createOlt(oltForm, { onSuccess: () => { setShowOltModal(false); setOltForm({ name: '', ip: '', model: '', location: '' }); } });
            }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label htmlFor="olt-name">Nombre</label>
                <input id="olt-name" style={{ display: 'block', width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', marginTop: '0.25rem' }} value={oltForm.name} onChange={e => setOltForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label htmlFor="olt-ip">IP</label>
                <input id="olt-ip" style={{ display: 'block', width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', marginTop: '0.25rem' }} value={oltForm.ip} onChange={e => setOltForm(f => ({ ...f, ip: e.target.value }))} required />
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label htmlFor="olt-model">Modelo</label>
                <input id="olt-model" style={{ display: 'block', width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', marginTop: '0.25rem' }} value={oltForm.model} onChange={e => setOltForm(f => ({ ...f, model: e.target.value }))} required />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="olt-location">Ubicación</label>
                <input id="olt-location" style={{ display: 'block', width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', marginTop: '0.25rem' }} value={oltForm.location} onChange={e => setOltForm(f => ({ ...f, location: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowOltModal(false)} style={{ padding: '0.4rem 1rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={creatingOlt} style={{ padding: '0.4rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
        <button onClick={() => setShowOltModal(true)} style={{ padding: '0.5rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: 600 }}>
          Nueva OLT
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total OLTs', value: olts.length },
          { label: 'OLTs Online', value: onlineOlts },
          { label: 'Total ONUs', value: totalOnus },
          { label: 'ONUs Online', value: onlineOnus },
        ].map(card => (
          <div key={card.label} style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
            padding: '1rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937' }}>{card.value}</div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* OLTs table */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Nombre', 'IP', 'Modelo', 'Fabricante', 'Uplink', 'Puertos PON', 'Total ONUs', 'ONUs Online', 'Estado', 'Último visto'].map(h => (
                <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {olts.map(olt => (
              <tr key={olt.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{olt.name}</td>
                <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace' }}>{olt.ipAddress}</td>
                <td style={{ padding: '0.75rem 1rem' }}>{olt.model}</td>
                <td style={{ padding: '0.75rem 1rem' }}>{olt.manufacturer}</td>
                <td style={{ padding: '0.75rem 1rem' }}>{olt.uplink}</td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{olt.ponPorts}</td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{olt.totalOnus}</td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{olt.onlineOnus}</td>
                <td style={{ padding: '0.75rem 1rem' }}><StatusBadge status={olt.status} /></td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#6b7280' }}>{formatDate(olt.lastSeen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OnusTab() {
  const { data: olts = [] } = useOlts();
  const [filterOlt, setFilterOlt] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const { data: onus = [], isLoading } = useOnus(filterOlt || undefined);
  const { mutate: createOnu, isPending: creatingOnu } = useCreateOnu();
  const { mutate: updateOnuStatus } = useUpdateOnuStatus();

  const [showOnuModal, setShowOnuModal] = useState(false);
  const [onuForm, setOnuForm] = useState({ serial: '', model: '', oltId: '', port: '', customerName: '' });

  const filteredOnus = filterStatus
    ? onus.filter(o => o.status === filterStatus)
    : onus;

  if (isLoading) return <p>Cargando...</p>;

  return (
    <div>
      {showOnuModal && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: '0.5rem', padding: '1.5rem', minWidth: '360px' }}>
            <p style={{ fontWeight: 700, marginBottom: '1rem' }}>Nueva ONU</p>
            <form onSubmit={e => {
              e.preventDefault();
              createOnu(
                { serial: onuForm.serial, model: onuForm.model, oltId: Number(onuForm.oltId), port: Number(onuForm.port), customerName: onuForm.customerName || undefined },
                { onSuccess: () => { setShowOnuModal(false); setOnuForm({ serial: '', model: '', oltId: '', port: '', customerName: '' }); } }
              );
            }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label htmlFor="onu-serial">Serial</label>
                <input id="onu-serial" style={{ display: 'block', width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', marginTop: '0.25rem' }} value={onuForm.serial} onChange={e => setOnuForm(f => ({ ...f, serial: e.target.value }))} required />
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label htmlFor="onu-model">Modelo</label>
                <input id="onu-model" style={{ display: 'block', width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', marginTop: '0.25rem' }} value={onuForm.model} onChange={e => setOnuForm(f => ({ ...f, model: e.target.value }))} required />
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label htmlFor="onu-oltId">OLT</label>
                <select id="onu-oltId" style={{ display: 'block', width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', marginTop: '0.25rem' }} value={onuForm.oltId} onChange={e => setOnuForm(f => ({ ...f, oltId: e.target.value }))} required>
                  <option value="">Seleccionar OLT</option>
                  {olts.map(olt => <option key={olt.id} value={olt.id}>{olt.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label htmlFor="onu-port">Puerto</label>
                <input id="onu-port" type="number" style={{ display: 'block', width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', marginTop: '0.25rem' }} value={onuForm.port} onChange={e => setOnuForm(f => ({ ...f, port: e.target.value }))} required />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="onu-customerName">Cliente</label>
                <input id="onu-customerName" style={{ display: 'block', width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', marginTop: '0.25rem' }} value={onuForm.customerName} onChange={e => setOnuForm(f => ({ ...f, customerName: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowOnuModal(false)} style={{ padding: '0.4rem 1rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={creatingOnu} style={{ padding: '0.4rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
        <button onClick={() => setShowOnuModal(true)} style={{ padding: '0.5rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: 600 }}>
          Nueva ONU
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <select
          value={filterOlt}
          onChange={e => setFilterOlt(e.target.value)}
          style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
          aria-label="Filtrar por OLT"
        >
          <option value="">Todas las OLTs</option>
          {olts.map(olt => (
            <option key={olt.id} value={olt.id}>{olt.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="unconfigured">Sin configurar</option>
        </select>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Nro. Serie', 'Modelo', 'OLT', 'Puerto PON', 'ONU ID', 'Cliente', 'Estado', 'Potencia RX (dBm)', 'Potencia TX', 'Distancia (m)', 'Firmware', 'Último contacto', 'Acciones'].map(h => (
                <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredOnus.map(onu => {
              const weakSignal = onu.rxPower < -27;
              return (
                <tr key={onu.id} style={{ borderBottom: '1px solid #f3f4f6', background: weakSignal ? '#fef2f2' : undefined }}>
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.875rem' }}>{onu.serialNumber}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>{onu.model}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>{onu.oltName}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{onu.ponPort}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{onu.onuId}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>{onu.clientName ?? '—'}</td>
                  <td style={{ padding: '0.75rem 1rem' }}><StatusBadge status={onu.status} /></td>
                  <td style={{ padding: '0.75rem 1rem', color: weakSignal ? '#dc2626' : undefined, fontWeight: weakSignal ? 600 : undefined }}>
                    {onu.rxPower.toFixed(1)}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>{onu.txPower.toFixed(1)}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>{onu.distance}</td>
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>{onu.firmwareVersion}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#6b7280' }}>{formatDate(onu.lastSeen)}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <select
                      aria-label="Cambiar estado"
                      value={onu.status}
                      onChange={e => updateOnuStatus({ id: onu.id, status: e.target.value })}
                      style={{ padding: '0.25rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.8rem' }}
                    >
                      <option value="online">Online</option>
                      <option value="offline">Offline</option>
                      <option value="unconfigured">Sin registrar</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function GponPage() {
  const [activeTab, setActiveTab] = useState<Tab>('olts');

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.5rem', fontWeight: 700 }}>GPON</h1>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
        {(['olts', 'onus'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              background: 'transparent',
              borderBottom: `2px solid ${activeTab === tab ? '#2563eb' : 'transparent'}`,
              color: activeTab === tab ? '#2563eb' : '#6b7280',
              fontWeight: activeTab === tab ? 600 : 400,
              cursor: 'pointer',
              marginBottom: '-1px',
              textTransform: 'uppercase',
              fontSize: '0.875rem',
            }}
          >
            {tab === 'olts' ? 'OLTs' : 'ONUs'}
          </button>
        ))}
      </div>

      {activeTab === 'olts' && <OltsTab />}
      {activeTab === 'onus' && <OnusTab />}
    </div>
  );
}
