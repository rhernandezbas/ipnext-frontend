import { useState } from 'react';

interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  parameters?: { name: string; type: string; description: string }[];
  exampleResponse: string;
}

interface ApiGroup {
  name: string;
  endpoints: ApiEndpoint[];
}

const METHOD_COLORS: Record<string, string> = {
  GET: '#2563eb',
  POST: '#059669',
  PUT: '#d97706',
  DELETE: '#dc2626',
};

const API_GROUPS: ApiGroup[] = [
  {
    name: 'Clientes',
    endpoints: [
      {
        method: 'GET',
        path: '/api/clients',
        description: 'Listar todos los clientes',
        parameters: [
          { name: 'page', type: 'number', description: 'Número de página' },
          { name: 'limit', type: 'number', description: 'Resultados por página' },
        ],
        exampleResponse: JSON.stringify([{ id: '1', name: 'Juan Pérez', email: 'juan@example.com', status: 'active' }], null, 2),
      },
      {
        method: 'GET',
        path: '/api/clients/:id',
        description: 'Obtener detalle de un cliente',
        parameters: [{ name: 'id', type: 'string', description: 'ID del cliente' }],
        exampleResponse: JSON.stringify({ id: '1', name: 'Juan Pérez', email: 'juan@example.com', status: 'active', phone: '+54 11 1234-5678' }, null, 2),
      },
      {
        method: 'POST',
        path: '/api/clients',
        description: 'Crear un nuevo cliente',
        exampleResponse: JSON.stringify({ id: '100', name: 'Nuevo Cliente', status: 'active', createdAt: '2026-04-28T00:00:00Z' }, null, 2),
      },
    ],
  },
  {
    name: 'Tickets',
    endpoints: [
      {
        method: 'GET',
        path: '/api/tickets',
        description: 'Listar tickets',
        parameters: [{ name: 'status', type: 'string', description: 'Filtrar por estado: open | closed' }],
        exampleResponse: JSON.stringify([{ id: 't-1', subject: 'Sin internet', status: 'open', priority: 'high' }], null, 2),
      },
      {
        method: 'POST',
        path: '/api/tickets',
        description: 'Crear un nuevo ticket',
        exampleResponse: JSON.stringify({ id: 't-100', subject: 'Nuevo ticket', status: 'open', createdAt: '2026-04-28T00:00:00Z' }, null, 2),
      },
      {
        method: 'PUT',
        path: '/api/tickets/:id',
        description: 'Actualizar un ticket',
        parameters: [{ name: 'id', type: 'string', description: 'ID del ticket' }],
        exampleResponse: JSON.stringify({ id: 't-1', status: 'closed', resolvedAt: '2026-04-28T00:00:00Z' }, null, 2),
      },
    ],
  },
  {
    name: 'Finanzas',
    endpoints: [
      {
        method: 'GET',
        path: '/api/billing/invoices',
        description: 'Listar facturas',
        exampleResponse: JSON.stringify([{ id: 'inv-1', amount: 6500, status: 'paid', dueDate: '2026-05-01' }], null, 2),
      },
      {
        method: 'GET',
        path: '/api/billing/payments',
        description: 'Listar pagos',
        exampleResponse: JSON.stringify([{ id: 'pay-1', amount: 6500, method: 'bank_transfer', date: '2026-04-15' }], null, 2),
      },
      {
        method: 'POST',
        path: '/api/billing/invoices',
        description: 'Crear factura',
        exampleResponse: JSON.stringify({ id: 'inv-100', amount: 6500, status: 'pending', createdAt: '2026-04-28T00:00:00Z' }, null, 2),
      },
    ],
  },
  {
    name: 'Red',
    endpoints: [
      {
        method: 'GET',
        path: '/api/gpon/olts',
        description: 'Listar dispositivos OLT',
        exampleResponse: JSON.stringify([{ id: 'olt-1', name: 'OLT Central', ipAddress: '10.0.0.1', status: 'online' }], null, 2),
      },
      {
        method: 'GET',
        path: '/api/gpon/onus',
        description: 'Listar ONUs',
        exampleResponse: JSON.stringify([{ id: 'onu-1', serialNumber: 'HWTC00000001', status: 'online', rxPower: -17.5 }], null, 2),
      },
      {
        method: 'GET',
        path: '/api/radius/sessions',
        description: 'Listar sesiones RADIUS activas',
        exampleResponse: JSON.stringify([{ id: 'session-1', username: 'user1@ipnext.com.ar', ipAddress: '10.0.1.101', status: 'active' }], null, 2),
      },
    ],
  },
  {
    name: 'Scheduling',
    endpoints: [
      {
        method: 'GET',
        path: '/api/scheduling/tasks',
        description: 'Listar tareas programadas',
        exampleResponse: JSON.stringify([{ id: 'task-1', title: 'Instalar fibra', status: 'pending', assignee: 'Técnico 1' }], null, 2),
      },
      {
        method: 'POST',
        path: '/api/scheduling/tasks',
        description: 'Crear tarea',
        exampleResponse: JSON.stringify({ id: 'task-100', title: 'Nueva tarea', status: 'pending', createdAt: '2026-04-28T00:00:00Z' }, null, 2),
      },
      {
        method: 'PUT',
        path: '/api/scheduling/tasks/:id/status',
        description: 'Actualizar estado de tarea',
        parameters: [{ name: 'id', type: 'string', description: 'ID de la tarea' }],
        exampleResponse: JSON.stringify({ id: 'task-1', status: 'completed', completedAt: '2026-04-28T00:00:00Z' }, null, 2),
      },
    ],
  },
  {
    name: 'Voz',
    endpoints: [
      {
        method: 'GET',
        path: '/api/voip/plans',
        description: 'Listar planes de voz',
        exampleResponse: JSON.stringify([{ id: 'vp-1', name: 'Plan Básico', minutes: 100, price: 500 }], null, 2),
      },
      {
        method: 'GET',
        path: '/api/voip/cdrs',
        description: 'Listar registros de llamadas (CDR)',
        exampleResponse: JSON.stringify([{ id: 'cdr-1', from: '0351123456', to: '0351789012', duration: 120, cost: 2.5 }], null, 2),
      },
      {
        method: 'POST',
        path: '/api/voip/plans',
        description: 'Crear plan de voz',
        exampleResponse: JSON.stringify({ id: 'vp-100', name: 'Nuevo Plan', minutes: 200, price: 900 }, null, 2),
      },
    ],
  },
  {
    name: 'Informes',
    endpoints: [
      {
        method: 'GET',
        path: '/api/dashboard/stats',
        description: 'Estadísticas del dashboard',
        exampleResponse: JSON.stringify({ totalClients: 1234, activeServices: 1180, openTickets: 45, monthlyRevenue: 2345000 }, null, 2),
      },
      {
        method: 'GET',
        path: '/api/billing/monthly',
        description: 'Facturación mensual',
        exampleResponse: JSON.stringify([{ month: '2026-04', total: 2345000, invoices: 1180 }], null, 2),
      },
      {
        method: 'GET',
        path: '/api/billing/finance-history',
        description: 'Historial financiero',
        exampleResponse: JSON.stringify([{ id: 'fh-1', type: 'invoice', amount: 6500, date: '2026-04-01' }], null, 2),
      },
    ],
  },
  {
    name: 'Configuración',
    endpoints: [
      {
        method: 'GET',
        path: '/api/settings/system',
        description: 'Obtener configuración del sistema',
        exampleResponse: JSON.stringify({ companyName: 'IPNEXT SA', timezone: 'America/Argentina/Buenos_Aires', currency: 'ARS' }, null, 2),
      },
      {
        method: 'PUT',
        path: '/api/settings/system',
        description: 'Actualizar configuración del sistema',
        exampleResponse: JSON.stringify({ companyName: 'IPNEXT SA', timezone: 'UTC', currency: 'USD' }, null, 2),
      },
      {
        method: 'GET',
        path: '/api/settings/webhooks',
        description: 'Listar webhooks configurados',
        exampleResponse: JSON.stringify([{ id: 'wh-1', name: 'ERP Integration', status: 'active' }], null, 2),
      },
    ],
  },
  {
    name: 'Administración',
    endpoints: [
      {
        method: 'GET',
        path: '/api/admins',
        description: 'Listar administradores',
        exampleResponse: JSON.stringify([{ id: '1', name: 'Super Admin', role: 'superadmin', status: 'active' }], null, 2),
      },
      {
        method: 'POST',
        path: '/api/admins',
        description: 'Crear administrador',
        exampleResponse: JSON.stringify({ id: '10', name: 'Nuevo Admin', role: 'admin', status: 'active', createdAt: '2026-04-28T00:00:00Z' }, null, 2),
      },
      {
        method: 'GET',
        path: '/api/admins/:id/2fa',
        description: 'Estado de 2FA de un administrador',
        parameters: [{ name: 'id', type: 'string', description: 'ID del administrador' }],
        exampleResponse: JSON.stringify({ adminId: '1', enabled: false, method: null, backupCodesCount: 0 }, null, 2),
      },
    ],
  },
];

function MethodBadge({ method }: { method: 'GET' | 'POST' | 'PUT' | 'DELETE' }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.2rem 0.5rem',
      borderRadius: '0.25rem',
      fontSize: '0.75rem',
      fontWeight: 700,
      color: '#fff',
      background: METHOD_COLORS[method],
      fontFamily: 'monospace',
      minWidth: '60px',
      textAlign: 'center',
    }}>
      {method}
    </span>
  );
}

export default function ApiDocsPage() {
  const [selectedGroup, setSelectedGroup] = useState<string>(API_GROUPS[0].name);

  const group = API_GROUPS.find(g => g.name === selectedGroup) ?? API_GROUPS[0];

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 'calc(100vh - 64px)' }}>
      {/* Left sidebar */}
      <aside style={{
        width: '220px',
        flexShrink: 0,
        borderRight: '1px solid #e5e7eb',
        padding: '1.5rem 0',
        background: '#f9fafb',
      }}>
        <div style={{ padding: '0 1rem', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Grupos de endpoints
          </h2>
        </div>
        {API_GROUPS.map(g => (
          <button
            key={g.name}
            onClick={() => setSelectedGroup(g.name)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '0.625rem 1rem',
              border: 'none',
              background: selectedGroup === g.name ? '#eff6ff' : 'transparent',
              color: selectedGroup === g.name ? '#2563eb' : '#374151',
              fontWeight: selectedGroup === g.name ? 600 : 400,
              cursor: 'pointer',
              fontSize: '0.875rem',
              borderLeft: `3px solid ${selectedGroup === g.name ? '#2563eb' : 'transparent'}`,
            }}
          >
            {g.name}
          </button>
        ))}
      </aside>

      {/* Right panel */}
      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem', fontWeight: 700 }}>Documentación API</h1>
        <p style={{ color: '#6b7280', marginBottom: '2rem', fontSize: '0.875rem' }}>
          API REST de IPNEXT — Base URL: <code style={{ background: '#f3f4f6', padding: '0.1rem 0.4rem', borderRadius: '0.25rem' }}>https://api.ipnext.com.ar</code>
        </p>

        <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem', fontWeight: 700, borderBottom: '2px solid #e5e7eb', paddingBottom: '0.5rem' }}>
          {group.name}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {group.endpoints.map((ep, idx) => (
            <div key={idx} style={{
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '1rem 1.25rem',
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                borderBottom: '1px solid #e5e7eb',
              }}>
                <MethodBadge method={ep.method} />
                <code style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: '#1f2937', fontWeight: 600 }}>{ep.path}</code>
                <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>{ep.description}</span>
              </div>

              {ep.parameters && ep.parameters.length > 0 && (
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb', background: '#fafafa' }}>
                  <p style={{ margin: '0 0 0.5rem', fontWeight: 600, fontSize: '0.8rem', color: '#374151', textTransform: 'uppercase' }}>Parámetros</p>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', color: '#6b7280' }}>Nombre</th>
                        <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', color: '#6b7280' }}>Tipo</th>
                        <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', color: '#6b7280' }}>Descripción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ep.parameters.map(p => (
                        <tr key={p.name}>
                          <td style={{ padding: '0.25rem 0.5rem', fontFamily: 'monospace', color: '#2563eb' }}>{p.name}</td>
                          <td style={{ padding: '0.25rem 0.5rem', color: '#059669' }}>{p.type}</td>
                          <td style={{ padding: '0.25rem 0.5rem', color: '#374151' }}>{p.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ padding: '1rem 1.25rem' }}>
                <p style={{ margin: '0 0 0.5rem', fontWeight: 600, fontSize: '0.8rem', color: '#374151', textTransform: 'uppercase' }}>Ejemplo de respuesta</p>
                <pre style={{
                  background: '#1f2937',
                  color: '#d1fae5',
                  padding: '1rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.8rem',
                  overflow: 'auto',
                  margin: 0,
                  fontFamily: 'monospace',
                }}>
                  {ep.exampleResponse}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
