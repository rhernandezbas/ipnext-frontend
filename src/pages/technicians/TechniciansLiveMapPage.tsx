import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { Button } from '@/components/atoms/Button/Button';
import { JourneyPanel } from '@/components/technicians/JourneyPanel';
import { TeamStateBadge } from '@/components/technicians/TeamStateBadge';
import {
  PERM_LOCATION_AUDIT,
  useTeamJourney,
  useTeamsLive,
} from '@/hooks/useTechnicianLocation';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { TeamLiveStatus } from '@/types/technicianLocation';
import { formatDateTimeShort, toArIsoDate } from '@/utils/formatDate';
import { formatAccuracy, formatMinutesElapsed } from '@/utils/formatGeo';
import styles from './TechniciansLiveMapPage.module.css';

/**
 * Mapa en vivo de cuadrillas (permiso `technicians.location_read`).
 *
 * ── La regla que gobierna esta pantalla ───────────────────────────────────────
 * Una posición vieja NO se dibuja como posición actual. Un pin de hace dos días
 * en un mapa rotulado "en vivo" manda a un despachante a un lugar donde la
 * cuadrilla no está — y encima parece un dato duro. Por eso:
 *
 *   ACTIVA          → marcador en el mapa
 *   DESACTUALIZADA  → NO va al mapa; va a una lista aparte, con la antigüedad
 *                     del dato y rotulada "última posición conocida"
 *   SIN_RASTRO      → lista propia; no es un pin fantasma ni un hueco
 *
 * `SIN_RASTRO` suele ser un login cancelado o duplicado (se midieron 5 de 11
 * cuadrillas en ese estado). Listarlas es información; mezclarlas con las que
 * reportan ensucia el mapa y hace dudar del resto.
 *
 * El `iclassStatus` se muestra pero se rotula como ADMINISTRATIVO: se midió una
 * cuadrilla "Inativo" que reportó 28 puntos el mismo día. El estado en IClass y
 * la actividad real del dispositivo son independientes.
 */

/** Centro por defecto cuando no hay ningún punto que encuadrar. */
const DEFAULT_CENTER: [number, number] = [-34.6037, -58.3816];
const DEFAULT_ZOOM = 11;

const MS_PER_DAY = 86_400_000;

/**
 * Encuadra el mapa sobre las cuadrillas activas y corrige el tamaño del canvas.
 * `invalidateSize` va con guarda porque el mock de tests no lo implementa, y
 * `fitBounds` porque el panel de jornada cambia el ancho del contenedor.
 */
function MapFitter({ points }: { points: Array<[number, number]> }) {
  const map = useMap();

  useEffect(() => {
    if (typeof map.invalidateSize === 'function') map.invalidateSize();
    if (points.length > 0 && typeof map.fitBounds === 'function') {
      map.fitBounds(points, { padding: [40, 40], maxZoom: 15 });
    }
  }, [map, points]);

  return null;
}

interface TeamRowProps {
  team: TeamLiveStatus;
  onSelect?: (team: TeamLiveStatus) => void;
  selected: boolean;
}

function TeamRow({ team, onSelect, selected }: TeamRowProps) {
  return (
    <li className={styles.teamRow} data-selected={selected || undefined}>
      <div className={styles.teamMain}>
        <span className={styles.teamName}>{team.name}</span>
        <TeamStateBadge state={team.state} minutesSinceLastPoint={team.minutesSinceLastPoint} />
      </div>

      <p className={styles.teamMeta}>
        <span className={styles.teamLogin}>{team.login}</span>
        {team.iclassStatus && (
          <span className={styles.teamIclass}> · IClass: {team.iclassStatus}</span>
        )}
      </p>

      {team.lastPointAt && (
        <p className={styles.teamMeta}>
          Último punto: {formatDateTimeShort(team.lastPointAt)} (
          {formatMinutesElapsed(team.minutesSinceLastPoint)}) · precisión{' '}
          {formatAccuracy(team.accuracyMeters)}
        </p>
      )}

      <div className={styles.teamActions}>
        {onSelect && (
          <Button
            variant="secondary"
            size="sm"
            aria-label={`Ver jornada de ${team.name}`}
            onClick={() => onSelect(team)}
          >
            Ver jornada
          </Button>
        )}
        {team.mapsUrl && (
          <a
            className={styles.mapsLink}
            href={team.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir en Maps
          </a>
        )}
      </div>
    </li>
  );
}

export default function TechniciansLiveMapPage() {
  const { can } = useMyPermissions();
  const canAudit = can(PERM_LOCATION_AUDIT);

  const { data, isLoading, isError, refetch } = useTeamsLive();

  const todayAr = useMemo(() => toArIsoDate(new Date()), []);
  const yesterdayAr = useMemo(() => toArIsoDate(new Date(Date.now() - MS_PER_DAY)), []);

  const [selected, setSelected] = useState<TeamLiveStatus | null>(null);
  const [day, setDay] = useState(todayAr);

  const journeyQuery = useTeamJourney(selected?.login ?? null, day, todayAr);

  /**
   * Un solo useMemo atado a `data`: si cada lista se derivara en el cuerpo del
   * render, `bounds` cambiaría de identidad en CADA render y el efecto de
   * `MapFitter` volvería a encuadrar el mapa constantemente — peleándole el
   * pan/zoom al operador. React Query mantiene estable la referencia de `data`
   * mientras el dato no cambia, así que esto sólo recalcula cuando corresponde.
   */
  const { teams, active, stale, noTrail, markers, bounds } = useMemo(() => {
    const all = data ?? [];
    const activeTeams = all.filter((t) => t.state === 'ACTIVA');
    const withCoords = activeTeams.filter(
      (t): t is TeamLiveStatus & { latitude: number; longitude: number } =>
        t.latitude != null && t.longitude != null,
    );
    return {
      teams: all,
      active: activeTeams,
      stale: all.filter((t) => t.state === 'DESACTUALIZADA'),
      noTrail: all.filter((t) => t.state === 'SIN_RASTRO'),
      markers: withCoords,
      bounds: withCoords.map((t) => [t.latitude, t.longitude] as [number, number]),
    };
  }, [data]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Cuadrillas en vivo</h1>
          <p className={styles.subtitle}>
            Última posición reportada por la app de cada cuadrilla. Indica dónde está el
            dispositivo que reporta, no quién lo opera.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          Actualizar
        </Button>
      </header>

      {isLoading && (
        <div className={styles.skeleton} data-testid="live-skeleton">
          <span className={styles.skeletonMap} aria-hidden="true" />
          <div className={styles.skeletonList} aria-hidden="true">
            <span className={styles.skeletonLine} />
            <span className={styles.skeletonLine} />
            <span className={styles.skeletonLine} />
          </div>
          <p className={styles.srOnly}>Cargando el estado de las cuadrillas…</p>
        </div>
      )}

      {!isLoading && isError && (
        <div className={styles.errorBanner} role="alert">
          <p className={styles.errorText}>
            No se pudo cargar el estado de las cuadrillas. El dato puede estar desactualizado —
            no asumas que nadie está reportando.
          </p>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {!isLoading && !isError && teams.length === 0 && (
        <p className={styles.empty} data-testid="live-empty">
          No hay cuadrillas registradas en IClass. Si esperabas ver alguna, revisá el catálogo de
          equipos de trabajo: acá se lista el roster completo, incluso las que nunca reportaron.
        </p>
      )}

      {!isLoading && !isError && teams.length > 0 && (
        <>
          <div className={styles.counters} data-testid="live-counters" aria-live="polite">
            <span className={styles.counter} data-state="ACTIVA">
              <strong className={styles.counterValue}>{active.length}</strong> activas
            </span>
            <span className={styles.counter} data-state="DESACTUALIZADA">
              <strong className={styles.counterValue}>{stale.length}</strong> desactualizadas
            </span>
            <span className={styles.counter} data-state="SIN_RASTRO">
              <strong className={styles.counterValue}>{noTrail.length}</strong> sin rastro
            </span>
          </div>

          <p className={styles.legend}>
            El estado administrativo en IClass (Ativo / Inativo / Cancelado) no determina si una
            cuadrilla reporta: se registraron cuadrillas marcadas «Inativo» enviando puntos el
            mismo día.
          </p>

          <div className={styles.layout} data-with-panel={selected ? true : undefined}>
            <section className={styles.mapSection} aria-labelledby="map-heading">
              <h2 id="map-heading" className={styles.sectionTitle}>
                Mapa — sólo cuadrillas activas ({markers.length})
              </h2>
              <div className={styles.mapBox}>
                <MapContainer
                  center={DEFAULT_CENTER}
                  zoom={DEFAULT_ZOOM}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  />
                  <MapFitter points={bounds} />
                  {markers.map((team) => (
                    <Marker key={team.login} position={[team.latitude, team.longitude]}>
                      <Popup>
                        <strong>{team.name}</strong>
                        <br />
                        {team.login}
                        <br />
                        {formatMinutesElapsed(team.minutesSinceLastPoint)} · precisión{' '}
                        {formatAccuracy(team.accuracyMeters)}
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
              {markers.length === 0 && (
                <p className={styles.mapEmpty}>
                  Ninguna cuadrilla tiene un punto reciente. El mapa queda sin marcadores a
                  propósito: dibujar posiciones viejas acá sería mostrarlas como actuales.
                </p>
              )}

              <h3 className={styles.listTitle}>Activas</h3>
              {active.length === 0 ? (
                <p className={styles.listEmpty}>Ninguna cuadrilla reportó en las últimas 24 h.</p>
              ) : (
                <ul className={styles.teamList} data-testid="active-list">
                  {active.map((team) => (
                    <TeamRow
                      key={team.login}
                      team={team}
                      selected={selected?.login === team.login}
                      onSelect={(t) => {
                        setSelected(t);
                        setDay(todayAr);
                      }}
                    />
                  ))}
                </ul>
              )}
            </section>

            <aside className={styles.side}>
              {selected && (
                <JourneyPanel
                  teamName={selected.name}
                  teamLogin={selected.login}
                  day={day}
                  minDay={canAudit ? '' : yesterdayAr}
                  maxDay={todayAr}
                  onDayChange={setDay}
                  canAudit={canAudit}
                  journey={journeyQuery.data}
                  isLoading={journeyQuery.isLoading}
                  isError={journeyQuery.isError}
                  onRetry={() => journeyQuery.refetch()}
                  onClose={() => setSelected(null)}
                />
              )}

              <section className={styles.subList} aria-labelledby="stale-heading">
                <h2 id="stale-heading" className={styles.sectionTitle}>
                  Desactualizadas ({stale.length})
                </h2>
                <ul className={styles.teamList} data-testid="stale-list">
                  <li className={styles.listNote}>
                    Última posición conocida, con más de 24 h de antigüedad. No se dibuja en el
                    mapa porque no representa dónde está la cuadrilla ahora.
                  </li>
                  {stale.length === 0 ? (
                    <li className={styles.listEmpty}>Ninguna cuadrilla quedó desactualizada.</li>
                  ) : (
                    stale.map((team) => (
                      <TeamRow
                        key={team.login}
                        team={team}
                        selected={selected?.login === team.login}
                        onSelect={(t) => {
                          setSelected(t);
                          setDay(todayAr);
                        }}
                      />
                    ))
                  )}
                </ul>
              </section>

              <section className={styles.subList} aria-labelledby="no-trail-heading">
                <h2 id="no-trail-heading" className={styles.sectionTitle}>
                  Sin rastro ({noTrail.length})
                </h2>
                <ul className={styles.teamList} data-testid="no-trail-list">
                  <li className={styles.listNote}>
                    Nunca reportaron un punto. Suelen ser logins cancelados o duplicados; no
                    implica que no estén trabajando.
                  </li>
                  {noTrail.length === 0 ? (
                    <li className={styles.listEmpty}>Todas las cuadrillas tienen rastro.</li>
                  ) : (
                    noTrail.map((team) => (
                      <TeamRow key={team.login} team={team} selected={false} />
                    ))
                  )}
                </ul>
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
