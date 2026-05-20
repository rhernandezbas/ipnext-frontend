import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import type { LeafletMouseEvent } from 'leaflet';
import { geocodeAddress, reverseGeocode } from '../lib/geocode';
import styles from './UbicacionMap.module.css';

interface Coordinates {
  lat: number;
  lng: number;
}

interface UbicacionMapProps {
  address: string | null;
  coordinates: Coordinates | null;
  onChange: (next: { address: string | null; coordinates: Coordinates | null }) => void;
}

const ARGENTINA_CENTER: Coordinates = { lat: -34.6, lng: -58.4 };
const DEFAULT_ZOOM_WITH_COORDS = 16;
const DEFAULT_ZOOM_NO_COORDS = 5;
const DEBOUNCE_MS = 600;

export function UbicacionMap({ address, coordinates, onChange }: UbicacionMapProps) {
  const [localAddress, setLocalAddress] = useState(address ?? '');
  const [localCoords, setLocalCoords] = useState<Coordinates | null>(coordinates);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local state in sync with prop changes (e.g., form reset)
  useEffect(() => {
    setLocalAddress(address ?? '');
    setLocalCoords(coordinates);
  }, [address, coordinates]);

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
          setLocalCoords(result);
          onChange({ address: addr, coordinates: result });
        } else {
          setGeocodeError('Sin resultados para esa dirección');
        }
      }, DEBOUNCE_MS);
    },
    [onChange]
  );

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalAddress(val);
    triggerGeocode(val);
  };

  const handleMarkerDragEnd = async (e: LeafletMouseEvent) => {
    const { lat, lng } = e.latlng;
    const newCoords = { lat, lng };
    setLocalCoords(newCoords);
    const addr = await reverseGeocode(newCoords);
    if (addr) setLocalAddress(addr);
    onChange({ address: addr, coordinates: newCoords });
  };

  const center = localCoords ?? ARGENTINA_CENTER;
  const zoom = localCoords ? DEFAULT_ZOOM_WITH_COORDS : DEFAULT_ZOOM_NO_COORDS;

  return (
    <section className={styles.section} aria-labelledby="ubicacion-heading">
      <h2 id="ubicacion-heading" className={styles.sectionTitle}>▣ Ubicación</h2>

      <div className={styles.addressRow}>
        <input
          className={styles.addressInput}
          type="text"
          value={localAddress}
          onChange={handleAddressChange}
          placeholder="Introducir dirección..."
          aria-label="Dirección"
        />
        {geocoding && <span className={styles.geocodingSpinner} aria-label="Geocodificando...">⟳</span>}
      </div>

      {geocodeError && (
        <p className={styles.geocodeError} role="alert">{geocodeError}</p>
      )}

      {!localCoords ? (
        <div className={styles.emptyMap} data-testid="map-empty">
          <MapContainer
            center={[center.lat, center.lng]}
            zoom={zoom}
            style={{ height: '360px', width: '100%', borderRadius: '6px' }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          </MapContainer>
          <p className={styles.emptyText}>
            Sin ubicación. Introduce una dirección o pincha en el mapa.
          </p>
        </div>
      ) : (
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={zoom}
          style={{ height: '360px', width: '100%', borderRadius: '6px' }}
          data-testid="map-container"
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker
            position={[localCoords.lat, localCoords.lng]}
            draggable
            eventHandlers={{ dragend: (e) => { void handleMarkerDragEnd(e as unknown as LeafletMouseEvent); } }}
          />
        </MapContainer>
      )}
    </section>
  );
}
