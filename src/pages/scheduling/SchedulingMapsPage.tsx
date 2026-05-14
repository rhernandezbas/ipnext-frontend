import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import styles from './SchedulingMapsPage.module.css';

const ZONES = [
  { id: 1, name: 'Zona Norte',  color: '#3b82f6', center: [-34.55, -58.45] as [number, number], radius: 3000, technicians: 4, tasks: 12 },
  { id: 2, name: 'Zona Sur',    color: '#22c55e', center: [-34.68, -58.38] as [number, number], radius: 3000, technicians: 3, tasks: 8  },
  { id: 3, name: 'Zona Centro', color: '#a855f7', center: [-34.60, -58.38] as [number, number], radius: 2500, technicians: 5, tasks: 15 },
];

const TASKS = [
  { id: 1, name: 'Instalación fibra',   technician: 'Carlos López',     position: [-34.54, -58.46] as [number, number] },
  { id: 2, name: 'Reparación enlace',   technician: 'María García',     position: [-34.57, -58.43] as [number, number] },
  { id: 3, name: 'Visita técnica',      technician: 'Juan Pérez',       position: [-34.60, -58.40] as [number, number] },
  { id: 4, name: 'Instalación router',  technician: 'Ana Martínez',     position: [-34.63, -58.37] as [number, number] },
  { id: 5, name: 'Soporte remoto',      technician: 'Luis Fernández',   position: [-34.66, -58.35] as [number, number] },
  { id: 6, name: 'Revisión nodo',       technician: 'Carlos López',     position: [-34.59, -58.42] as [number, number] },
  { id: 7, name: 'Alta cliente',        technician: 'María García',     position: [-34.61, -58.39] as [number, number] },
];

const CENTER: [number, number] = [-34.6037, -58.3816];

export default function SchedulingMapsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>Scheduling /</span>
          <h1 className={styles.title}>Mapa de operaciones</h1>
        </div>
      </div>

      <div className={styles.mapCard}>
        <MapContainer center={CENTER} zoom={11} style={{ height: '100%', width: '100%' }}>
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
                <p className={styles.popupTitle}>{zone.name}</p>
                <p className={styles.popupLine}>Técnicos: {zone.technicians}</p>
                <p className={styles.popupLine}>Tareas: {zone.tasks}</p>
              </Popup>
            </CircleMarker>
          ))}
          {TASKS.map(task => (
            <Marker key={task.id} position={task.position}>
              <Popup>
                <p className={styles.popupTitle}>{task.name}</p>
                <p className={styles.popupLine}>Técnico: {task.technician}</p>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className={styles.zonesGrid}>
        {ZONES.map(zone => (
          <div key={zone.id} className={styles.zoneCard}>
            <div className={styles.zoneHeader}>
              <span className={styles.zoneDot} style={{ background: zone.color }} />
              <span className={styles.zoneName}>{zone.name}</span>
            </div>
            <div className={styles.zoneStats}>
              <div className={styles.zoneStat}>
                <span className={styles.zoneStatLabel}>Técnicos</span>
                <span className={styles.zoneStatValue}>{zone.technicians}</span>
              </div>
              <div className={styles.zoneStat}>
                <span className={styles.zoneStatLabel}>Tareas</span>
                <span className={styles.zoneStatValue}>{zone.tasks}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
