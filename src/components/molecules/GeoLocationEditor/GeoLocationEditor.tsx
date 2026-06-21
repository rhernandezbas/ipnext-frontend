import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import type { LeafletMouseEvent } from 'leaflet';
import { encodePlusCode } from '@/lib/plusCode';
import { geocodeAddress, reverseGeocode } from '@/pages/scheduling/SchedulingTaskDetailPage/lib/geocode';
import styles from './GeoLocationEditor.module.css';

/** Calls invalidateSize() once on mount — needed when the map lives in a tab that
 *  starts hidden. Guards against test environments where the mock lacks the method. */
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    if (typeof map.invalidateSize === 'function') {
      map.invalidateSize();
    }
  }, [map]);
  return null;
}

export interface GeoValue {
  lat: number | null;
  lng: number | null;
  plusCode: string | null;
}

export interface GeoLocationEditorProps {
  /** Current persisted value. */
  value: GeoValue;
  /** Called when the operator saves. Receives the updated value. */
  onSave: (v: GeoValue) => Promise<void>;
  /** When false, the map is read-only — no address search, no dragging, no save button. */
  canEdit: boolean;
  /** Optional section heading. Defaults to "Ubicación GPS". */
  title?: string;
  /**
   * Optional reference address shown as a muted hint (e.g. the GR installation
   * address from the contract, as context for where to drop the pin).
   */
  referenceAddress?: string | null;
}

const ARGENTINA_CENTER = { lat: -34.6, lng: -58.38 };
const ZOOM_WITH_COORDS = 16;
const ZOOM_NO_COORDS = 5;
const DEBOUNCE_MS = 600;

export function GeoLocationEditor({
  value,
  onSave,
  canEdit,
  title = 'Ubicación GPS',
  referenceAddress,
}: GeoLocationEditorProps) {
  const [localLat, setLocalLat] = useState<number | null>(value.lat);
  const [localLng, setLocalLng] = useState<number | null>(value.lng);
  const [localPlusCode, setLocalPlusCode] = useState<string | null>(value.plusCode);
  const [address, setAddress] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync props → local state when parent re-fetches (e.g. after another save)
  useEffect(() => {
    setLocalLat(value.lat);
    setLocalLng(value.lng);
    setLocalPlusCode(value.plusCode);
  }, [value.lat, value.lng, value.plusCode]);

  // Recompute plusCode whenever coords change
  useEffect(() => {
    if (localLat !== null && localLng !== null) {
      setLocalPlusCode(encodePlusCode(localLat, localLng));
    }
  }, [localLat, localLng]);

  const applyCoords = useCallback((lat: number, lng: number, addr?: string | null) => {
    setLocalLat(lat);
    setLocalLng(lng);
    setLocalPlusCode(encodePlusCode(lat, lng));
    if (addr !== undefined) setAddress(addr ?? '');
  }, []);

  const triggerGeocode = useCallback(
    (addr: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        if (!addr.trim()) return;
        setGeocoding(true);
        setGeocodeError(null);
        const result = await geocodeAddress(addr);
        setGeocoding(false);
        if (result) {
          applyCoords(result.lat, result.lng);
        } else {
          setGeocodeError('Sin resultados para esa dirección');
        }
      }, DEBOUNCE_MS);
    },
    [applyCoords]
  );

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAddress(val);
    triggerGeocode(val);
  };

  const handleMarkerDragEnd = async (e: LeafletMouseEvent) => {
    const { lat, lng } = e.latlng;
    setLocalLat(lat);
    setLocalLng(lng);
    setLocalPlusCode(encodePlusCode(lat, lng));
    const addr = await reverseGeocode({ lat, lng });
    if (addr) setAddress(addr);
  };

  const handlePlusCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalPlusCode(e.target.value);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await onSave({ lat: localLat, lng: localLng, plusCode: localPlusCode });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      const e = err as { message?: string };
      setSaveError(e.message ?? 'Error al guardar la ubicación');
    } finally {
      setSaving(false);
    }
  };

  const hasCoords = localLat !== null && localLng !== null;
  const center = hasCoords ? { lat: localLat!, lng: localLng! } : ARGENTINA_CENTER;
  const zoom = hasCoords ? ZOOM_WITH_COORDS : ZOOM_NO_COORDS;
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps?q=${localLat},${localLng}`
    : null;

  return (
    <section className={styles.section} aria-labelledby="geo-editor-heading">
      <h2 id="geo-editor-heading" className={styles.sectionTitle}>
        {title}
      </h2>

      {canEdit && (
        <div className={styles.addressRow}>
          <input
            className={styles.addressInput}
            type="text"
            value={address}
            onChange={handleAddressChange}
            placeholder="Buscar dirección…"
            aria-label="Buscar dirección"
          />
          {geocoding && (
            <span className={styles.spinner} aria-label="Geocodificando…" aria-live="polite" />
          )}
        </div>
      )}

      {geocodeError && (
        <p className={styles.error} role="alert">{geocodeError}</p>
      )}

      {referenceAddress && (
        <p className={styles.referenceHint} aria-label="Dirección de referencia GR">
          Ref. GR: {referenceAddress}
        </p>
      )}

      {/* Map */}
      {!hasCoords ? (
        <div className={styles.emptyState} data-testid="geo-empty-state">
          <MapContainer
            center={[center.lat, center.lng]}
            zoom={zoom}
            style={{ height: '340px', width: '100%', borderRadius: '8px' }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapResizer />
          </MapContainer>
          <div className={styles.emptyOverlay}>
            <svg className={styles.emptyIcon} width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              <circle cx="12" cy="9" r="2.5"/>
            </svg>
            <p className={styles.emptyText}>Sin ubicación cargada</p>
            {canEdit && (
              <p className={styles.emptySubtext}>
                Buscá una dirección arriba o arrastrá el pin en el mapa.
              </p>
            )}
          </div>
        </div>
      ) : (
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={zoom}
          style={{ height: '340px', width: '100%', borderRadius: '8px' }}
          data-testid="geo-map-container"
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapResizer />
          <Marker
            position={[center.lat, center.lng]}
            draggable={canEdit}
            eventHandlers={
              canEdit
                ? {
                    dragend: (e) => {
                      void handleMarkerDragEnd(e as unknown as LeafletMouseEvent);
                    },
                  }
                : {}
            }
          />
        </MapContainer>
      )}

      {/* Coordinates display */}
      {hasCoords && (
        <div className={styles.coordsRow} data-testid="geo-coords">
          <span className={styles.coordLabel}>Lat</span>
          <span className={styles.coordValue}>{localLat!.toFixed(6)}</span>
          <span className={styles.coordSep} />
          <span className={styles.coordLabel}>Lng</span>
          <span className={styles.coordValue}>{localLng!.toFixed(6)}</span>
        </div>
      )}

      {/* Plus Code */}
      <div className={styles.plusCodeRow}>
        <label className={styles.plusCodeLabel} htmlFor="geo-pluscode">
          Plus Code
        </label>
        {canEdit ? (
          <input
            id="geo-pluscode"
            className={styles.plusCodeInput}
            type="text"
            value={localPlusCode ?? ''}
            onChange={handlePlusCodeChange}
            placeholder="Ej. 48Q3CJ2C+22"
            aria-label="Plus Code"
          />
        ) : (
          <span className={styles.plusCodeValue}>{localPlusCode ?? '—'}</span>
        )}
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.mapsLink}
            aria-label="Ver en Google Maps"
            data-testid="geo-maps-link"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Ver en Maps
          </a>
        )}
      </div>

      {/* Save button — only when canEdit */}
      {canEdit && (
        <div className={styles.actions}>
          {saveError && (
            <p className={styles.error} role="alert">{saveError}</p>
          )}
          {saveSuccess && (
            <p className={styles.success} role="status">Ubicación guardada.</p>
          )}
          <button
            type="button"
            className={styles.saveButton}
            onClick={() => { void handleSave(); }}
            disabled={saving}
            aria-busy={saving}
            data-testid="geo-save-button"
          >
            {saving ? 'Guardando…' : 'Guardar ubicación'}
          </button>
        </div>
      )}
    </section>
  );
}
