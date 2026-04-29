import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

type ServiceStatus = 'active' | 'suspended' | 'inactive';

interface Customer {
  id: number;
  name: string;
  plan: string;
  status: ServiceStatus;
  position: [number, number];
}

const CUSTOMERS: Customer[] = [
  { id: 1, name: 'Ana García', plan: 'Fibra 100Mbps', status: 'active', position: [-34.53, -58.48] },
  { id: 2, name: 'Carlos López', plan: 'Fibra 200Mbps', status: 'active', position: [-34.55, -58.45] },
  { id: 3, name: 'María Rodríguez', plan: 'Fibra 50Mbps', status: 'suspended', position: [-34.57, -58.42] },
  { id: 4, name: 'Pedro Martínez', plan: 'Fibra 100Mbps', status: 'active', position: [-34.59, -58.39] },
  { id: 5, name: 'Laura Sánchez', plan: 'Fibra 200Mbps', status: 'active', position: [-34.61, -58.36] },
  { id: 6, name: 'Roberto Fernández', plan: 'Fibra 50Mbps', status: 'inactive', position: [-34.63, -58.33] },
  { id: 7, name: 'Empresa Norte SA', plan: 'Fibra 500Mbps', status: 'active', position: [-34.54, -58.46] },
  { id: 8, name: 'Juan Díaz', plan: 'Fibra 100Mbps', status: 'suspended', position: [-34.56, -58.43] },
  { id: 9, name: 'Silvia González', plan: 'Fibra 200Mbps', status: 'active', position: [-34.58, -58.40] },
  { id: 10, name: 'Miguel Torres', plan: 'Fibra 100Mbps', status: 'active', position: [-34.60, -58.37] },
  { id: 11, name: 'Comercios del Sur', plan: 'Fibra 500Mbps', status: 'active', position: [-34.62, -58.34] },
  { id: 12, name: 'Patricia Ruiz', plan: 'Fibra 50Mbps', status: 'inactive', position: [-34.64, -58.31] },
];

const STATUS_COLORS: Record<ServiceStatus, string> = {
  active: '#22c55e',
  suspended: '#ef4444',
  inactive: '#9ca3af',
};

const STATUS_LABELS: Record<ServiceStatus, string> = {
  active: 'Activo',
  suspended: 'Suspendido',
  inactive: 'Inactivo',
};

const CUSTOMER_STATS = [
  { zone: 'Zona Norte', count: 342, color: '#3b82f6' },
  { zone: 'Zona Sur', count: 218, color: '#22c55e' },
  { zone: 'Zona Centro', count: 491, color: '#a855f7' },
];

const CENTER: [number, number] = [-34.6037, -58.3816];
const total = CUSTOMER_STATS.reduce((sum, s) => sum + s.count, 0);

export default function CustomerMapPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Mapa de clientes</h1>

      <div className="bg-white rounded-lg border border-gray-200 mb-6 overflow-hidden" style={{ height: '500px' }}>
        <MapContainer
          center={CENTER}
          zoom={11}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          {CUSTOMERS.map(customer => (
            <Marker key={customer.id} position={customer.position}>
              <Popup>
                <div>
                  <strong>{customer.name}</strong>
                  <p style={{ margin: '4px 0', fontSize: '0.85rem', color: '#6b7280' }}>{customer.plan}</p>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      backgroundColor: STATUS_COLORS[customer.status],
                      color: '#fff',
                      fontSize: '0.75rem',
                    }}
                  >
                    {STATUS_LABELS[customer.status]}
                  </span>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CUSTOMER_STATS.map(stat => (
          <div key={stat.zone} className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <div
              className="w-4 h-4 rounded-full mx-auto mb-2"
              style={{ backgroundColor: stat.color }}
            />
            <p className="text-3xl font-bold text-gray-800">{stat.count}</p>
            <p className="text-sm text-gray-500 mt-1">{stat.zone}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-400 text-center mt-4">Total: {total} clientes activos</p>
    </div>
  );
}
