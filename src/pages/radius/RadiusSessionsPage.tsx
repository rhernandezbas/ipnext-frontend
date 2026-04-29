import { useState } from 'react';
import { useRadiusSessions, useDisconnectSession } from '@/hooks/useRadiusSessions';
import type { RadiusSession } from '@/types/radiusSessions';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function RadiusSessionsPage() {
  const { data: sessions = [], isLoading, refetch } = useRadiusSessions();
  const { mutate: disconnect } = useDisconnectSession();
  const [filterNas, setFilterNas] = useState<string>('');
  const [search, setSearch] = useState('');

  // Compute unique NAS list
  const nasList = Array.from(new Set(sessions.map(s => s.nasName)));

  const filteredSessions = sessions.filter(s => {
    const nasMatch = !filterNas || s.nasName === filterNas;
    const searchMatch = !search || (
      s.username.toLowerCase().includes(search.toLowerCase()) ||
      s.clientName.toLowerCase().includes(search.toLowerCase()) ||
      s.ipAddress.includes(search) ||
      s.macAddress.toLowerCase().includes(search.toLowerCase())
    );
    return nasMatch && searchMatch;
  });

  const totalDownloadMbps = sessions.reduce((acc, s) => acc + s.downloadMbps, 0);
  const totalUploadMbps = sessions.reduce((acc, s) => acc + s.uploadMbps, 0);
  const idleCount = sessions.filter(s => s.status === 'idle').length;

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Sesiones RADIUS activas</h1>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: '#2563eb', color: '#fff',
          borderRadius: '9999px', padding: '0.2rem 0.75rem',
          fontSize: '0.875rem', fontWeight: 600,
        }}>
          {sessions.length}
        </span>
        <button
          onClick={() => refetch()}
          style={{
            marginLeft: 'auto',
            padding: '0.5rem 1rem',
            background: '#fff',
            border: '1px solid #d1d5db',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Actualizar
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total sesiones', value: sessions.length },
          { label: 'Descarga total (Mbps)', value: totalDownloadMbps.toFixed(1) },
          { label: 'Carga total (Mbps)', value: totalUploadMbps.toFixed(1) },
          { label: 'Sesiones idle', value: idleCount },
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

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <select
          value={filterNas}
          onChange={e => setFilterNas(e.target.value)}
          style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
          aria-label="Filtrar por NAS"
        >
          <option value="">Todos los NAS</option>
          {nasList.map(nas => <option key={nas} value={nas}>{nas}</option>)}
        </select>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por cliente, IP, MAC..."
          style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', flex: 1 }}
          aria-label="Buscar sesión"
        />
      </div>

      {/* Sessions table */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Username', 'Cliente', 'NAS', 'IP', 'MAC', 'Inicio', 'Duración', 'Descarga (Mbps)', 'Carga (Mbps)', 'Estado', 'Acciones'].map(h => (
                <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                  Cargando...
                </td>
              </tr>
            )}
            {!isLoading && filteredSessions.map(session => (
              <tr key={session.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.875rem' }}>{session.username}</td>
                <td style={{ padding: '0.75rem 1rem' }}>{session.clientName}</td>
                <td style={{ padding: '0.75rem 1rem' }}>{session.nasName}</td>
                <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace' }}>{session.ipAddress}</td>
                <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>{session.macAddress}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{formatDate(session.startedAt)}</td>
                <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace' }}>{formatDuration(session.duration)}</td>
                <td style={{ padding: '0.75rem 1rem' }}>{session.downloadMbps.toFixed(1)}</td>
                <td style={{ padding: '0.75rem 1rem' }}>{session.uploadMbps.toFixed(1)}</td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#fff',
                    background: session.status === 'active' ? '#059669' : '#d97706',
                  }}>
                    {session.status === 'active' ? 'Activo' : 'Idle'}
                  </span>
                </td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <button
                    onClick={() => disconnect(session.id)}
                    style={{
                      padding: '0.25rem 0.75rem',
                      background: '#fff',
                      border: '1px solid #dc2626',
                      color: '#dc2626',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                    }}
                  >
                    Desconectar
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && filteredSessions.length === 0 && (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', color: '#6b7280', padding: '24px' }}>
                  No hay sesiones activas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
