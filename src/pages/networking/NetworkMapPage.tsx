import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

type DeviceStatus = 'active' | 'down' | 'warning';

interface NetworkDevice {
  id: number;
  name: string;
  type: string;
  status: DeviceStatus;
  position: [number, number];
}

const DEVICES: NetworkDevice[] = [
  { id: 1, name: 'Nodo Principal ISP', type: 'ISP Node', status: 'active', position: [-34.6037, -58.3816] },
  { id: 2, name: 'Router Norte', type: 'Router', status: 'active', position: [-34.55, -58.45] },
  { id: 3, name: 'Router Sur', type: 'Router', status: 'warning', position: [-34.68, -58.38] },
  { id: 4, name: 'Router Centro', type: 'Router', status: 'active', position: [-34.60, -58.40] },
  { id: 5, name: 'OLT Zona Norte', type: 'OLT', status: 'active', position: [-34.56, -58.47] },
  { id: 6, name: 'OLT Zona Sur', type: 'OLT', status: 'down', position: [-34.70, -58.36] },
];

const STATUS_COLORS: Record<DeviceStatus, string> = {
  active: '#22c55e',
  down: '#ef4444',
  warning: '#eab308',
};

const STATUS_LABELS: Record<DeviceStatus, string> = {
  active: 'Activo',
  down: 'Caído',
  warning: 'Alerta',
};

const CENTER: [number, number] = [-34.6037, -58.3816];

export default function NetworkMapPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Mapa de red</h1>

      <div className="bg-white rounded-lg border border-gray-200 mb-6 overflow-hidden" style={{ height: '500px' }}>
        <MapContainer
          center={CENTER}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          {DEVICES.map(device => (
            <Marker key={device.id} position={device.position}>
              <Popup>
                <div>
                  <strong>{device.name}</strong>
                  <p>Tipo: {device.type}</p>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      backgroundColor: STATUS_COLORS[device.status],
                      color: '#fff',
                      fontSize: '0.75rem',
                    }}
                  >
                    {STATUS_LABELS[device.status]}
                  </span>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Leyenda</h2>
        <div className="flex flex-col gap-2">
          {Object.entries(STATUS_LABELS).map(([status, label]) => (
            <div key={status} className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[status as DeviceStatus] }}
              />
              <span className="text-sm text-gray-600">Nodos {label.toLowerCase()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
