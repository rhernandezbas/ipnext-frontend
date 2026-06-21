import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { LatLng } from 'leaflet';
import 'leaflet-draw/dist/leaflet.draw.css';
// leaflet-draw augments the L namespace (adds L.Control.Draw, L.Draw.Event, etc.)
import 'leaflet-draw';
import { Can } from '@/components/auth/Can';
import { Button } from '@/components/atoms/Button/Button';
import { useZones, useCreateZone, useUpdateZone, useDeleteZone } from '@/hooks/useZones';
import type { Zone, ZonePoint } from '@/api/zones.api';
import styles from './CustomerMapPage.module.css';

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

type ServiceStatus = 'active' | 'suspended' | 'inactive';

interface Customer {
  id: number;
  name: string;
  plan: string;
  status: ServiceStatus;
  position: [number, number];
}

interface PendingZone {
  points: ZonePoint[];
}

/* ------------------------------------------------------------------ */
/* Hardcoded demo data (out of scope to make real)                     */
/* ------------------------------------------------------------------ */

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
  active: '#28a745',
  suspended: '#dc3545',
  inactive: '#adb5bd',
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

/* ------------------------------------------------------------------ */
/* ZoneDrawControl — inner component that uses useMap()                */
/* ------------------------------------------------------------------ */

interface ZoneDrawControlProps {
  zones: Zone[];
  onCreated: (points: ZonePoint[]) => void;
  onEdited: (changes: Array<{ id: string; points: ZonePoint[] }>) => void;
  onDeleted: (ids: string[]) => void;
}

/**
 * Mounts the leaflet-draw Control onto the map imperatively.
 * Must be rendered INSIDE a <MapContainer> so useMap() resolves.
 * The parent remounts this component (via key prop) when edit mode toggles,
 * so cleanup is handled entirely in the useEffect return.
 */
function ZoneDrawControl({ zones, onCreated, onEdited, onDeleted }: ZoneDrawControlProps) {
  const map = useMap();

  // Stable callback refs so the effect closure doesn't re-bind on every render
  const onCreatedRef = useRef(onCreated);
  const onEditedRef = useRef(onEdited);
  const onDeletedRef = useRef(onDeleted);
  useEffect(() => { onCreatedRef.current = onCreated; }, [onCreated]);
  useEffect(() => { onEditedRef.current = onEdited; }, [onEdited]);
  useEffect(() => { onDeletedRef.current = onDeleted; }, [onDeleted]);

  // layer → zone id so we can resolve IDs on edit/delete
  const layerToZoneId = useRef<Map<L.Layer, string>>(new Map());

  useEffect(() => {
    const featureGroup = new L.FeatureGroup();
    featureGroup.addTo(map);

    // Populate featureGroup with current zones as editable polygons
    zones.forEach(zone => {
      const latlngs: [number, number][] = zone.points.map(p => [p.lat, p.lng]);
      const layer = L.polygon(latlngs, {
        color: zone.color,
        fillColor: zone.color,
        fillOpacity: 0.2,
      });
      featureGroup.addLayer(layer);
      layerToZoneId.current.set(layer, zone.id);
    });

    // L.Control.Draw is added to L by the 'leaflet-draw' side-effect import
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DrawControl = (L.Control as any).Draw;
    const drawControl = new DrawControl({
      edit: { featureGroup },
      draw: {
        polygon: { shapeOptions: { color: '#6f42c1', fillOpacity: 0.2 } },
        marker: false,
        polyline: false,
        circle: false,
        rectangle: false,
        circlemarker: false,
      },
    });

    map.addControl(drawControl);

    // CREATED — new polygon drawn
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onCreatedHandler = (e: any) => {
      const layer = e.layer as L.Polygon;
      // C2: keep the drawn polygon visible on the map while the form is open
      featureGroup.addLayer(layer);
      const rawLatlngs = layer.getLatLngs()[0] as LatLng[];
      const points = rawLatlngs.map(ll => ({ lat: ll.lat, lng: ll.lng }));
      onCreatedRef.current(points);
    };

    // EDITED — existing polygons mutated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onEditedHandler = (e: any) => {
      const changes: Array<{ id: string; points: ZonePoint[] }> = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      e.layers.eachLayer((layer: any) => {
        const id = layerToZoneId.current.get(layer as L.Layer);
        if (!id) return;
        const rawLatlngs = (layer as L.Polygon).getLatLngs()[0] as LatLng[];
        const points = rawLatlngs.map(ll => ({ lat: ll.lat, lng: ll.lng }));
        changes.push({ id, points });
      });
      if (changes.length > 0) onEditedRef.current(changes);
    };

    // DELETED — layers removed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onDeletedHandler = (e: any) => {
      const ids: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      e.layers.eachLayer((layer: any) => {
        const id = layerToZoneId.current.get(layer as L.Layer);
        if (id) ids.push(id);
      });
      if (ids.length > 0) onDeletedRef.current(ids);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DrawEvent = (L as any).Draw?.Event ?? {
      CREATED: 'draw:created',
      EDITED: 'draw:edited',
      DELETED: 'draw:deleted',
    };

    map.on(DrawEvent.CREATED, onCreatedHandler);
    map.on(DrawEvent.EDITED, onEditedHandler);
    map.on(DrawEvent.DELETED, onDeletedHandler);

    return () => {
      map.off(DrawEvent.CREATED, onCreatedHandler);
      map.off(DrawEvent.EDITED, onEditedHandler);
      map.off(DrawEvent.DELETED, onDeletedHandler);
      map.removeControl(drawControl);
      map.removeLayer(featureGroup);
      layerToZoneId.current.clear();
    };
    // Intentionally run once on mount; parent key-remounts on mode change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

/* ------------------------------------------------------------------ */
/* CreateZoneForm                                                       */
/* ------------------------------------------------------------------ */

interface CreateZoneFormProps {
  points: ZonePoint[];
  onCancel: () => void;
  onSave: (name: string, color: string) => void;
  isLoading: boolean;
  error: string | null;
}

function CreateZoneForm({ points, onCancel, onSave, isLoading, error }: CreateZoneFormProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6f42c1');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), color);
  };

  return (
    <div className={styles.formOverlay} role="dialog" aria-modal="true" aria-label="Nueva zona">
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h2 className={styles.formTitle}>Nueva zona</h2>

        <div className={styles.formField}>
          <label className={styles.formLabel} htmlFor="zone-name">
            Nombre
          </label>
          <input
            id="zone-name"
            className={styles.formInput}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej: Zona Norte"
            required
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
        </div>

        <div className={styles.formField}>
          <span className={styles.formLabel} id="color-label">Color</span>
          <div className={styles.colorRow} role="group" aria-labelledby="color-label">
            <input
              aria-label="Seleccionar color"
              className={styles.colorPicker}
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
            />
            <input
              aria-label="Color en hexadecimal"
              className={styles.colorHex}
              type="text"
              value={color}
              onChange={e => setColor(e.target.value)}
              placeholder="#6f42c1"
            />
          </div>
        </div>

        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          {points.length} puntos seleccionados
        </p>

        {error && (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        )}

        <div className={styles.formActions}>
          <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={isLoading} disabled={!name.trim()}>
            Guardar zona
          </Button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main page                                                            */
/* ------------------------------------------------------------------ */

export default function CustomerMapPage() {
  const [editMode, setEditMode] = useState(false);
  const [pendingZone, setPendingZone] = useState<PendingZone | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [rebuildNonce, setRebuildNonce] = useState(0);

  const { data: zones, isLoading: zonesLoading, isError: zonesError } = useZones();
  const createZone = useCreateZone();
  const updateZone = useUpdateZone();
  const deleteZone = useDeleteZone();

  const handleCreated = useCallback((points: ZonePoint[]) => {
    setPendingZone({ points });
    setMutationError(null);
  }, []);

  const handleEdited = useCallback(
    (changes: Array<{ id: string; points: ZonePoint[] }>) => {
      setMutationError(null);
      changes.forEach(({ id, points }) => {
        updateZone.mutate(
          { id, patch: { points } },
          {
            onError: (err: unknown) => {
              setMutationError(extractErrorMessage(err));
              setRebuildNonce(n => n + 1);
            },
          },
        );
      });
    },
    [updateZone],
  );

  const handleDeleted = useCallback(
    (ids: string[]) => {
      setMutationError(null);
      ids.forEach(id => {
        deleteZone.mutate(id, {
          onError: (err: unknown) => {
            setMutationError(extractErrorMessage(err));
            setRebuildNonce(n => n + 1);
          },
        });
      });
    },
    [deleteZone],
  );

  const handleSaveNewZone = useCallback(
    (name: string, color: string) => {
      if (!pendingZone) return;
      setMutationError(null);
      createZone.mutate(
        { name, color, points: pendingZone.points },
        {
          onSuccess: () => {
            setPendingZone(null);
          },
          onError: (err: unknown) => {
            setMutationError(extractErrorMessage(err));
            setRebuildNonce(n => n + 1);
          },
        },
      );
    },
    [pendingZone, createZone],
  );

  const handleCancelForm = useCallback(() => {
    setPendingZone(null);
    setMutationError(null);
    setRebuildNonce(n => n + 1);
  }, []);

  const toggleEditMode = () => {
    setEditMode(prev => !prev);
    setPendingZone(null);
    setMutationError(null);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Mapa de clientes</h1>

        <Can permission="zones.manage">
          <Button
            variant={editMode ? 'primary' : 'secondary'}
            size="sm"
            onClick={toggleEditMode}
            aria-pressed={editMode}
          >
            {editMode ? 'Salir de edición' : 'Editar zonas'}
          </Button>
        </Can>
      </div>

      {/* Inline feedback */}
      {zonesLoading && (
        <p className={styles.loadingZones} aria-live="polite">
          Cargando zonas...
        </p>
      )}
      {!zonesLoading && zonesError && (
        <p className={styles.errorZones} role="alert">
          No se pudieron cargar las zonas.
        </p>
      )}
      {!zonesLoading && !zonesError && zones && zones.length === 0 && (
        <p className={styles.emptyZones}>No hay zonas todavía.</p>
      )}
      {mutationError && !pendingZone && (
        <p className={styles.formError} role="alert">
          {mutationError}
        </p>
      )}

      <div className={styles.mapWrapper}>
        <MapContainer center={CENTER} zoom={11} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          {/* Customer markers (hardcoded demo data — out of scope to make real) */}
          {CUSTOMERS.map(customer => (
            <Marker key={customer.id} position={customer.position}>
              <Popup>
                <div>
                  <strong>{customer.name}</strong>
                  <p
                    style={{
                      margin: '4px 0',
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {customer.plan}
                  </p>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: STATUS_COLORS[customer.status],
                      color: '#fff',
                      fontSize: 'var(--font-size-xs)',
                    }}
                  >
                    {STATUS_LABELS[customer.status]}
                  </span>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Read-only zone polygons (shown when NOT in edit mode) */}
          {!editMode &&
            zones?.map(zone => (
              <Polygon
                key={zone.id}
                positions={zone.points.map(p => [p.lat, p.lng] as [number, number])}
                pathOptions={{
                  color: zone.color,
                  fillColor: zone.color,
                  fillOpacity: 0.2,
                }}
              >
                <Tooltip sticky>{zone.name}</Tooltip>
                <Popup>
                  <div>
                    <strong>{zone.name}</strong>
                    {zone.description && (
                      <p
                        style={{
                          margin: '4px 0',
                          fontSize: 'var(--font-size-sm)',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        {zone.description}
                      </p>
                    )}
                  </div>
                </Popup>
              </Polygon>
            ))}

          {/* Draw/edit toolbar (only for zones.manage, only in edit mode) */}
          <Can permission="zones.manage">
            {editMode && (
              <ZoneDrawControl
                // key remounts the component cleanly when edit mode toggles or
                // after a zone mutation so the feature group is rebuilt fresh
                key={`draw-${editMode}-${(zones ?? []).map(z => z.id + ':' + z.updatedAt).join('|')}-${rebuildNonce}`}
                zones={zones ?? []}
                onCreated={handleCreated}
                onEdited={handleEdited}
                onDeleted={handleDeleted}
              />
            )}
          </Can>
        </MapContainer>
      </div>

      {/* Stats grid */}
      <div className={styles.statsGrid}>
        {CUSTOMER_STATS.map(stat => (
          <div key={stat.zone} className={styles.statCard}>
            <div className={styles.statDot} style={{ backgroundColor: stat.color }} aria-hidden="true" />
            <p className={styles.statCount}>{stat.count}</p>
            <p className={styles.statLabel}>{stat.zone}</p>
          </div>
        ))}
      </div>
      <p className={styles.totalLabel}>Total: {total} clientes activos</p>

      {/* Create zone form — rendered as a modal when a new polygon is drawn */}
      {pendingZone && (
        <CreateZoneForm
          points={pendingZone.points}
          onCancel={handleCancelForm}
          onSave={handleSaveNewZone}
          isLoading={createZone.isPending}
          error={mutationError}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    // Axios error shape
    const axiosErr = err as { response?: { data?: { code?: string; message?: string } } };
    const code = axiosErr.response?.data?.code;
    if (code === 'INVALID_POLYGON')
      return 'El polígono no es válido. Asegurate de trazar al menos 3 puntos.';
    if (code === 'ZONE_NOT_FOUND') return 'La zona no existe.';
    const message = axiosErr.response?.data?.message;
    if (message) return message;
    const errObj = err as { message?: string };
    if (errObj.message) return errObj.message;
  }
  return 'Ocurrió un error. Intentá de nuevo.';
}
