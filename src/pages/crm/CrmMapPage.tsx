import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

type LeadStatus = 'nuevo' | 'contactado' | 'calificado';

interface Lead {
  id: number;
  name: string;
  status: LeadStatus;
  position: [number, number];
}

const LEADS: Lead[] = [
  { id: 1, name: 'Empresa Alfa', status: 'nuevo', position: [-34.54, -58.47] },
  { id: 2, name: 'Juan Rodríguez', status: 'contactado', position: [-34.56, -58.44] },
  { id: 3, name: 'Empresa Beta', status: 'calificado', position: [-34.58, -58.41] },
  { id: 4, name: 'Laura Gómez', status: 'nuevo', position: [-34.60, -58.38] },
  { id: 5, name: 'Tech Solutions SA', status: 'contactado', position: [-34.62, -58.35] },
  { id: 6, name: 'Pedro Díaz', status: 'calificado', position: [-34.64, -58.32] },
  { id: 7, name: 'Distribuidora Norte', status: 'nuevo', position: [-34.53, -58.43] },
  { id: 8, name: 'María Silva', status: 'contactado', position: [-34.57, -58.46] },
  { id: 9, name: 'Comercios Reunidos', status: 'calificado', position: [-34.61, -58.42] },
  { id: 10, name: 'Roberto Suárez', status: 'nuevo', position: [-34.65, -58.39] },
];

const STATUS_COLORS: Record<LeadStatus, string> = {
  nuevo: '#3b82f6',
  contactado: '#eab308',
  calificado: '#22c55e',
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  calificado: 'Calificado',
};

const LEAD_STATS = [
  { zone: 'Zona Norte', leads: 48, color: '#3b82f6' },
  { zone: 'Zona Sur', leads: 32, color: '#22c55e' },
  { zone: 'Zona Centro', leads: 67, color: '#a855f7' },
  { zone: 'Zona Este', leads: 21, color: '#f97316' },
];

const CENTER: [number, number] = [-34.6037, -58.3816];

export default function CrmMapPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Mapa CRM</h1>
      <p className="text-gray-600 mb-6">Distribución geográfica de leads</p>

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
          {LEADS.map(lead => (
            <Marker key={lead.id} position={lead.position}>
              <Popup>
                <div>
                  <strong>{lead.name}</strong>
                  <br />
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: '4px',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      backgroundColor: STATUS_COLORS[lead.status],
                      color: '#fff',
                      fontSize: '0.75rem',
                    }}
                  >
                    {STATUS_LABELS[lead.status]}
                  </span>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {LEAD_STATS.map(stat => (
          <div key={stat.zone} className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <div
              className="w-4 h-4 rounded-full mx-auto mb-2"
              style={{ backgroundColor: stat.color }}
            />
            <p className="text-2xl font-bold text-gray-800">{stat.leads}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.zone}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
