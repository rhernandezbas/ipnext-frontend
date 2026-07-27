import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { Button } from '@/components/atoms/Button/Button';
import { JourneyPanel } from '@/components/technicians/JourneyPanel';
import { TeamStateBadge } from '@/components/technicians/TeamStateBadge';
import {
  PERM_LOCATION_AUDIT,
  journeyRequiresAudit,
  useTeamJourney,
  useTeamsLive,
} from '@/hooks/useTechnicianLocation';
import { previousIsoDay, useArToday } from '@/hooks/useArToday';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { TeamLiveStatus } from '@/types/technicianLocation';
import { formatDateTimeShort } from '@/utils/formatDate';
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

/**
 * Último recurso: sólo se usa cuando NINGUNA cuadrilla del roster tiene
 * coordenadas (ni siquiera una posición vieja). No pretende ser el área de
 * servicio — es un punto arbitrario para que Leaflet tenga dónde pararse. Con
 * cualquier posición conocida el mapa se encuadra sobre ella (ver `fitPoints`).
 */
const DEFAULT_CENTER: [number, number] = [-34.6037, -58.3816];
const DEFAULT_ZOOM = 11;

/**
 * Encuadra el mapa y corrige el tamaño del canvas.
 *
 * ── Por qué el efecto depende de `signature` y NO de `points` ─────────────────
 * El BE recalcula `minutesSinceLastPoint` contra `now()` en cada request, así
 * que el poll de 60 s devuelve SIEMPRE objetos nuevos aunque nada se haya
 * movido. Si el efecto se ata a la identidad del array, cada minuto el mapa
 * vuelve a encuadrar y le arrebata el pan/zoom al despachante justo cuando está
 * mirando algo. La firma es un string derivado de los logins + las coordenadas
 * redondeadas: sólo cambia cuando cambia el CONJUNTO de marcadores o alguien se
 * movió de verdad.
 *
 * `invalidateSize` va con guarda porque el mock de tests no lo implementa; lo
 * mismo `fitBounds`.
 */
function MapFitter({
  points,
  signature,
  maxZoom,
}: {
  points: Array<[number, number]>;
  signature: string;
  maxZoom: number;
}) {
  const map = useMap();

  // Los puntos se leen por ref: son el VALOR a encuadrar, no el disparador.
  const pointsRef = useRef(points);
  pointsRef.current = points;

  useEffect(() => {
    if (typeof map.invalidateSize === 'function') map.invalidateSize();
    const pts = pointsRef.current;
    if (pts.length > 0 && typeof map.fitBounds === 'function') {
      map.fitBounds(pts, { padding: [40, 40], maxZoom });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `points` a propósito NO está: ver el docblock.
  }, [map, signature, maxZoom]);

  return null;
}

interface TeamRowProps {
  team: TeamLiveStatus;
  onSelect?: (team: TeamLiveStatus, trigger: HTMLButtonElement) => void;
  selected: boolean;
}

/**
 * Rótulo del link a Maps. En una cuadrilla DESACTUALIZADA el link apunta a una
 * posición de hace más de 24 h: llamarlo "Abrir en Maps" a secas manda al
 * despachante a un domicilio donde la cuadrilla no está, y encima con la
 * autoridad de un mapa. El rótulo tiene que decir de QUÉ posición habla.
 */
function mapsLinkLabel(state: TeamLiveStatus['state']): string {
  return state === 'ACTIVA' ? 'Abrir en Maps' : 'Última posición conocida en Maps';
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
            onClick={(e) => onSelect(team, e.currentTarget)}
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
            {mapsLinkLabel(team.state)}
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

  /**
   * VIVO, no congelado: esta pantalla queda abierta con poll de 60 s. Con
   * `useMemo(..., [])` el "hoy" del primer render sobrevivía a la medianoche y
   * el FE terminaba pidiendo la jornada de un día que ya exige auditoría.
   */
  const todayAr = useArToday();
  const yesterdayAr = useMemo(() => previousIsoDay(todayAr), [todayAr]);

  const [selected, setSelected] = useState<TeamLiveStatus | null>(null);
  const [day, setDay] = useState(todayAr);

  /** Botón que abrió el panel: al cerrar, el foco vuelve ahí y no al <body>. */
  const panelTriggerRef = useRef<HTMLButtonElement | null>(null);

  function openJourney(team: TeamLiveStatus, trigger: HTMLButtonElement) {
    panelTriggerRef.current = trigger;
    setSelected(team);
    setDay(todayAr);
  }

  function closeJourney() {
    setSelected(null);
    panelTriggerRef.current?.focus();
  }

  const journeyQuery = useTeamJourney(selected?.login ?? null, day, todayAr);
  const journeyRequiresAuditPerm = journeyRequiresAudit(day, todayAr);
  /** Un 403 es "no te corresponde", no "se rompió". Se presenta distinto. */
  const journeyForbidden =
    axios.isAxiosError(journeyQuery.error) && journeyQuery.error.response?.status === 403;

  /**
   * Un solo useMemo atado a `data`. OJO: `data` NO es referencialmente estable
   * entre polls — el BE recalcula `minutesSinceLastPoint` contra `now()` en cada
   * request, así que cada 60 s llega un objeto nuevo aunque nada se haya movido.
   * Por eso el encuadre del mapa NO puede colgarse de la identidad de `bounds`:
   * va por `markersSignature` (abajo), que sólo cambia cuando cambia el conjunto
   * de marcadores o alguien se movió de verdad.
   */
  const { teams, active, stale, noTrail, markers, fitPoints, fitSignature, usingFallbackFrame } =
    useMemo(() => {
      const all = data ?? [];
      const hasCoords = (
        t: TeamLiveStatus,
      ): t is TeamLiveStatus & { latitude: number; longitude: number } =>
        t.latitude != null && t.longitude != null;

      const activeTeams = all.filter((t) => t.state === 'ACTIVA');
      const withCoords = activeTeams.filter(hasCoords);
      // Últimas posiciones CONOCIDAS de todo el roster. NO se dibujan; sólo
      // sirven para no plantar el viewport en un punto arbitrario cuando no hay
      // ninguna cuadrilla activa.
      const anyKnown = all.filter(hasCoords);
      const frameTeams = withCoords.length > 0 ? withCoords : anyKnown;

      return {
        teams: all,
        active: activeTeams,
        stale: all.filter((t) => t.state === 'DESACTUALIZADA'),
        noTrail: all.filter((t) => t.state === 'SIN_RASTRO'),
        markers: withCoords,
        fitPoints: frameTeams.map((t) => [t.latitude, t.longitude] as [number, number]),
        /**
         * FIRMA del encuadre: login + coordenadas redondeadas a ~1 m (5
         * decimales). Deliberadamente NO incluye `minutesSinceLastPoint` ni
         * `lastPointAt`, que cambian en CADA poll sin que nada se haya movido.
         */
        fitSignature: frameTeams
          .map((t) => `${t.login}@${t.latitude.toFixed(5)},${t.longitude.toFixed(5)}`)
          .join('|'),
        usingFallbackFrame: withCoords.length === 0 && anyKnown.length > 0,
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
          <p className={styles.srOnly} role="status">
            Cargando el estado de las cuadrillas…
          </p>
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
          No hay cuadrillas en la respuesta. Acá se lista el roster COMPLETO que devuelve IClass,
          incluso las que nunca reportaron, así que una lista vacía apunta al catálogo de equipos
          de trabajo o a la conexión con IClass — no a que las cuadrillas no estén trabajando.
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

          <div className={styles.layout}>
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
                  <MapFitter
                    points={fitPoints}
                    signature={fitSignature}
                    /* Encuadre de respaldo: acercarse a nivel 15 sobre una
                       posición de hace más de 24 h la vestiría de dato actual. */
                    maxZoom={usingFallbackFrame ? 12 : 15}
                  />
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
                  {usingFallbackFrame &&
                    ' El encuadre se apoya en las últimas posiciones conocidas, sólo para no dejar el viewport en cualquier lado.'}
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
                      onSelect={openJourney}
                    />
                  ))}
                </ul>
              )}
            </section>

            <aside className={styles.side}>
              {selected && (
                <JourneyPanel
                  key={selected.login}
                  teamName={selected.name}
                  teamLogin={selected.login}
                  day={day}
                  minDay={canAudit ? '' : yesterdayAr}
                  maxDay={todayAr}
                  onDayChange={setDay}
                  canAudit={canAudit}
                  requiresAudit={journeyRequiresAuditPerm}
                  journey={journeyQuery.data}
                  isLoading={journeyQuery.isLoading}
                  isError={journeyQuery.isError}
                  isForbidden={journeyForbidden}
                  onRetry={() => journeyQuery.refetch()}
                  onClose={closeJourney}
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
