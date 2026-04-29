import { useState } from 'react';
import { useMonitoringStats, useMonitoringDevices, useMonitoringAlerts, useAcknowledgeAlert } from '@/hooks/useMonitoring';
import type { MonitoringDevice } from '@/types/monitoring';
import { Spinner } from '@/components/atoms/Spinner/Spinner';
import styles from './MonitoringPage.module.css';

// ── Helpers ──────────────────────────────────────────────────────────────

function statusColor(status: MonitoringDevice['status']): string {
  const map: Record<string, string> = {
    online: '#22c55e',
    offline: '#ef4444',
    warning: '#f97316',
    unknown: '#94a3b8',
  };
  return map[status] ?? '#94a3b8';
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

// Map lat/lng to pixel positions within a fixed area (lat -34.55 to -34.71, lng -58.30 to -58.52)
function toPixel(lat: number, lng: number, width = 100, height = 100): { x: number; y: number } {
  const latMin = -34.71;
  const latMax = -34.55;
  const lngMin = -58.52;
  const lngMax = -58.30;
  const x = ((lng - lngMin) / (lngMax - lngMin)) * width;
  const y = ((lat - latMax) / (latMin - latMax)) * height;
  return {
    x: Math.max(2, Math.min(96, x)),
    y: Math.max(2, Math.min(96, y)),
  };
}

// ── Device Map ───────────────────────────────────────────────────────────

interface DeviceMapProps {
  devices: MonitoringDevice[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function DeviceMap({ devices, selectedId, onSelect }: DeviceMapProps) {
  const [tooltipDevice, setTooltipDevice] = useState<MonitoringDevice | null>(null);

  return (
    <div className={styles.mapContainer} data-testid="device-map">
      {/* Background grid */}
      <div className={styles.mapGrid} aria-hidden="true" />

      {/* Device dots */}
      {devices.map(device => {
        const pos = toPixel(device.coordinates.lat, device.coordinates.lng);
        const color = statusColor(device.status);
        const isSelected = selectedId === device.id;

        return (
          <button
            key={device.id}
            className={`${styles.deviceDot} ${isSelected ? styles.deviceDotSelected : ''}`}
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              backgroundColor: color,
              boxShadow: isSelected ? `0 0 0 3px ${color}40` : undefined,
            }}
            title={device.name}
            aria-label={`Dispositivo ${device.name}`}
            onClick={() => onSelect(device.id)}
            onMouseEnter={() => setTooltipDevice(device)}
            onMouseLeave={() => setTooltipDevice(null)}
          />
        );
      })}

      {/* Tooltip */}
      {tooltipDevice && (() => {
        const pos = toPixel(tooltipDevice.coordinates.lat, tooltipDevice.coordinates.lng);
        return (
          <div
            className={styles.tooltip}
            style={{ left: `${Math.min(70, pos.x)}%`, top: `${Math.max(5, pos.y - 20)}%` }}
          >
            <p className={styles.tooltipName}>{tooltipDevice.name}</p>
            <p className={styles.tooltipDetail}>IP: {tooltipDevice.ipAddress}</p>
            <p className={styles.tooltipDetail}>Estado: {tooltipDevice.status}</p>
            {tooltipDevice.latency !== null && (
              <p className={styles.tooltipDetail}>Latencia: {tooltipDevice.latency}ms</p>
            )}
            {tooltipDevice.clientName && (
              <p className={styles.tooltipDetail}>Cliente: {tooltipDevice.clientName}</p>
            )}
          </div>
        );
      })()}

      {/* Legend */}
      <div className={styles.legend}>
        <span className={styles.legendItem}><span className={styles.legendDot} style={{ backgroundColor: '#22c55e' }} />Online</span>
        <span className={styles.legendItem}><span className={styles.legendDot} style={{ backgroundColor: '#ef4444' }} />Sin respuesta</span>
        <span className={styles.legendItem}><span className={styles.legendDot} style={{ backgroundColor: '#f97316' }} />Advertencia</span>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function MonitoringPage() {
  const { data: stats, isLoading: statsLoading } = useMonitoringStats();
  const { data: devices = [], isLoading: devicesLoading } = useMonitoringDevices();
  const { data: alerts = [], isLoading: alertsLoading } = useMonitoringAlerts();
  const { mutate: acknowledge } = useAcknowledgeAlert();

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [lastUpdated] = useState(() => new Date().toLocaleTimeString('es-AR'));

  const isLoading = statsLoading || devicesLoading || alertsLoading;

  if (isLoading) {
    return <Spinner fullPage />;
  }

  const activeAlerts = alerts.filter(a => !a.acknowledged);

  function severityIcon(severity: string): string {
    if (severity === 'critical') return '';
    if (severity === 'warning') return '';
    return 'i';
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Monitoreo de red</h1>
          <p className={styles.timestamp}>Actualizado: {lastUpdated}</p>
        </div>
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={() => window.location.reload()}
        >
          Actualizar
        </button>
      </div>

      {/* Summary Cards */}
      <div className={styles.cards}>
        <div className={styles.card}>
          <p className={styles.cardLabel}>Total dispositivos</p>
          <p className={styles.cardValue}>{stats?.totalDevices ?? 0}</p>
        </div>
        <div className={`${styles.card} ${styles.cardGreen}`}>
          <p className={styles.cardLabel}>En linea</p>
          <p className={styles.cardValue}>{stats?.onlineDevices ?? 0}</p>
        </div>
        <div className={`${styles.card} ${styles.cardRed}`}>
          <p className={styles.cardLabel}>Sin respuesta</p>
          <p className={styles.cardValue}>{stats?.offlineDevices ?? 0}</p>
        </div>
        <div className={`${styles.card} ${styles.cardOrange}`}>
          <p className={styles.cardLabel}>Alertas activas</p>
          <p className={styles.cardValue}>{stats?.activeAlerts ?? 0}</p>
        </div>
      </div>

      {/* Main content: map + alerts */}
      <div className={styles.mainContent}>
        {/* Device Map */}
        <div className={styles.mapSection}>
          <DeviceMap
            devices={devices}
            selectedId={selectedDeviceId}
            onSelect={setSelectedDeviceId}
          />
        </div>

        {/* Alerts Panel */}
        <div className={styles.alertsPanel}>
          <h2 className={styles.alertsTitle}>Alertas</h2>
          {activeAlerts.length === 0 ? (
            <p className={styles.emptyAlerts}>Sin alertas activas</p>
          ) : (
            <div className={styles.alertsList}>
              {activeAlerts
                .sort((a, b) => {
                  const order = { critical: 0, warning: 1, info: 2 };
                  return (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
                })
                .map(alert => (
                  <div key={alert.id} className={`${styles.alertItem} ${styles[`alert_${alert.severity}`]}`}>
                    <div className={styles.alertHeader}>
                      <span className={styles.alertSeverityBadge}>
                        {severityIcon(alert.severity)} {alert.severity === 'critical' ? 'critico' : alert.severity === 'warning' ? 'advertencia' : 'info'}
                      </span>
                      <span className={styles.alertTime}>{formatRelative(alert.occurredAt)}</span>
                    </div>
                    <p className={styles.alertDevice}>{alert.deviceName}</p>
                    <p className={styles.alertMessage}>{alert.message}</p>
                    <button
                      type="button"
                      className={styles.acknowledgeBtn}
                      onClick={() => acknowledge(alert.id)}
                    >
                      Reconocer
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Device Table */}
      <div className={styles.tableSection}>
        <h2 className={styles.tableTitle}>Dispositivos</h2>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>IP</th>
                <th>Estado</th>
                <th>Latencia</th>
                <th>Descarga</th>
                <th>Carga</th>
                <th>Ultimo contacto</th>
              </tr>
            </thead>
            <tbody>
              {devices.map(device => (
                <tr
                  key={device.id}
                  className={`${styles.tableRow} ${selectedDeviceId === device.id ? styles.tableRowSelected : ''}`}
                  onClick={() => setSelectedDeviceId(device.id)}
                >
                  <td>{device.name}</td>
                  <td>{device.type.toUpperCase()}</td>
                  <td>{device.ipAddress}</td>
                  <td>
                    <span
                      className={styles.statusBadge}
                      style={{ backgroundColor: statusColor(device.status) }}
                    >
                      {device.status}
                    </span>
                  </td>
                  <td>{device.latency !== null ? `${device.latency}ms` : '—'}</td>
                  <td>{device.downloadMbps !== null ? `${device.downloadMbps} Mbps` : '—'}</td>
                  <td>{device.uploadMbps !== null ? `${device.uploadMbps} Mbps` : '—'}</td>
                  <td>{device.lastSeen ? formatRelative(device.lastSeen) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
