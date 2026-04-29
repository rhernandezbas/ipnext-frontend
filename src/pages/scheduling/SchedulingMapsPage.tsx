import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';

const ZONES = [
  { id: 1, name: 'Zona Norte', color: '#3b82f6', center: [-34.55, -58.45] as [number, number], radius: 3000, technicians: 4, tasks: 12 },
  { id: 2, name: 'Zona Sur', color: '#22c55e', center: [-34.68, -58.38] as [number, number], radius: 3000, technicians: 3, tasks: 8 },
  { id: 3, name: 'Zona Centro', color: '#a855f7', center: [-34.60, -58.38] as [number, number], radius: 2500, technicians: 5, tasks: 15 },
];

const TASKS = [
  { id: 1, name: 'Instalación fibra', technician: 'Carlos López', position: [-34.54, -58.46] as [number, number] },
  { id: 2, name: 'Reparación enlace', technician: 'María García', position: [-34.57, -58.43] as [number, number] },
  { id: 3, name: 'Visita técnica', technician: 'Juan Pérez', position: [-34.60, -58.40] as [number, number] },
  { id: 4, name: 'Instalación router', technician: 'Ana Martínez', position: [-34.63, -58.37] as [number, number] },
  { id: 5, name: 'Soporte remoto', technician: 'Luis Fernández', position: [-34.66, -58.35] as [number, number] },
  { id: 6, name: 'Revisión nodo', technician: 'Carlos López', position: [-34.59, -58.42] as [number, number] },
  { id: 7, name: 'Alta cliente', technician: 'María García', position: [-34.61, -58.39] as [number, number] },
];

const CENTER: [number, number] = [-34.6037, -58.3816];

export default function SchedulingMapsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Mapas de Scheduling</h1>

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
          {ZONES.map(zone => (
            <CircleMarker
              key={zone.id}
              center={zone.center}
              radius={50}
              pathOptions={{ color: zone.color, fillColor: zone.color, fillOpacity: 0.2 }}
            >
              <Popup>
                <div>
                  <strong>{zone.name}</strong>
                  <p>Técnicos: {zone.technicians}</p>
                  <p>Tareas: {zone.tasks}</p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
          {TASKS.map(task => (
            <Marker key={task.id} position={task.position}>
              <Popup>
                <div>
                  <strong>{task.name}</strong>
                  <p>Técnico: {task.technician}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ZONES.map(zone => (
          <div key={zone.id} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: zone.color }}
              />
              <span className="font-semibold text-gray-800">{zone.name}</span>
            </div>
            <p className="text-sm text-gray-600">Técnicos: {zone.technicians}</p>
            <p className="text-sm text-gray-600">Tareas: {zone.tasks}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
