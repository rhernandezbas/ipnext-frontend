import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { Button } from '@/components/atoms/Button/Button';
import { JourneyPanel } from '@/components/technicians/JourneyPanel';
import { TeamStateBadge } from '@/components/technicians/TeamStateBadge';
import {
  PERM_LOCATION_AUDIT,
  isBeyondJourneyRetention,
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
 * ── Por qué el efecto NO depende de `points` ──────────────────────────────────
 * El BE recalcula `minutesSinceLastPoint` contra `now()` en cada request, así
 * que el poll de 60 s devuelve SIEMPRE objetos nuevos aunque nada se haya
 * movido. Si el efecto se ata a la identidad del array, cada minuto el mapa
 * vuelve a encuadrar y le arrebata el pan/zoom al despachante justo cuando está
 * mirando algo.
 *
 * El disparador TAMPOCO puede llevar coordenadas, ni redondeadas. Con
 * `accuracyMeters` de 12-40 m, un teléfono QUIETO reporta coordenadas distintas
 * en cada breadcrumb: la deriva del GPS mueve los últimos decimales sola. Con ~6
 * cuadrillas activas y una mediana de muestreo de ~7 min, la chance de que un
 * poll de 60 s traiga al menos un punto nuevo ronda el 57% — o sea, el encuadre
 * se le escapaba al operador cada uno o dos minutos igual.
 *
 * ── Por qué reencuadra el ALTA y no el conjunto ───────────────────────────────
 * La primera versión miraba el CONJUNTO de logins y reencuadraba cuando cambiaba
 * en cualquier dirección. Media solución: que ENTRE una cuadrilla lo justifica
 * —la nueva puede caer fuera del viewport y hay que ir a buscarla—, pero que
 * SALGA no justifica nada. Ahí `fitBounds` reencuadra sobre un conjunto MÁS
 * CHICO y le mueve el zoom al despachante a cambio de cero información.
 *
 * Y con un roster que parpadea el costo se duplicaba: `A|B` → un poll devuelve
 * sólo `A` → el siguiente vuelve a traer `A|B` son DOS refits en dos minutos.
 * No es hipotético: el roster sale de IClass, la misma API que este change
 * documentó devolviendo 5 de 11 cuadrillas en `SIN_RASTRO`. Con el alta como
 * única condición, ese ciclo cuesta UN refit — el del regreso, que sí puede
 * traer a alguien fuera de la vista.
 *
 * Que el encuadre siga a las POSICIONES se pide con "Recentrar" (`recenterNonce`):
 * explícito, del operador, cuando él quiere. Se descartó el umbral geográfico
 * (50-100 m) porque no resuelve el caso real: una cuadrilla en la camioneta cruza
 * 100 m entre polls, así que el robo del viewport volvía con otro disfraz y encima
 * intermitente — el peor modo de fallar, porque no se puede predecir.
 *
 * `invalidateSize` va con guarda porque el mock de tests no lo implementa; lo
 * mismo `fitBounds`.
 */
function MapFitter({
  points,
  logins,
  recenterNonce,
  maxZoom,
}: {
  points: Array<[number, number]>;
  /** Conjunto de logins encuadrables, ORDENADO (el BE no garantiza el orden) y unido por `|`. */
  logins: string;
  /** Se incrementa con cada "Recentrar": el pedido EXPLÍCITO del operador. */
  recenterNonce: number;
  maxZoom: number;
}) {
  const map = useMap();

  // Los puntos se leen por ref: son el VALOR a encuadrar, no el disparador.
  const pointsRef = useRef(points);
  pointsRef.current = points;

  /** Conjunto encuadrado la última vez. `null` = todavía no se encuadró nada. */
  const framedRef = useRef<Set<string> | null>(null);
  const nonceRef = useRef(recenterNonce);

  useEffect(() => {
    if (typeof map.invalidateSize === 'function') map.invalidateSize();

    const current = new Set(logins === '' ? [] : logins.split('|'));
    const previous = framedRef.current;
    framedRef.current = current;

    const requested = recenterNonce !== nonceRef.current;
    nonceRef.current = recenterNonce;

    // Primer encuadre (no hay conjunto previo) o ALTA de una cuadrilla. Una BAJA
    // deja el viewport intacto: reencuadrar sobre menos puntos no muestra nada
    // que el operador no estuviera viendo ya.
    const added =
      previous === null ? current.size > 0 : [...current].some((login) => !previous.has(login));

    if (!requested && !added) return;

    const pts = pointsRef.current;
    if (pts.length > 0 && typeof map.fitBounds === 'function') {
      map.fitBounds(pts, { padding: [40, 40], maxZoom });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `points` a propósito NO está: ver el docblock.
  }, [map, logins, recenterNonce, maxZoom]);

  return null;
}

/**
 * Cuenta los marcadores que quedaron FUERA del viewport y los reporta arriba.
 *
 * ── Por qué hace falta ────────────────────────────────────────────────────────
 * Desde que el encuadre es del operador (ver `MapFitter`) el mapa dejó de
 * perseguir posiciones. Eso mata el robo del viewport, pero deja una deuda: el
 * encabezado puede decir «Mapa — sólo cuadrillas activas (6)» mientras la vista
 * muestra 3, sin NINGUNA señal de que falten. Antes ese hueco no existía porque
 * el mapa iba atrás de todos: es el costo directo de la decisión de producto, y
 * pega justo en el caso que la pantalla dice servir — el tablero mirado de lejos.
 *
 * ── Por qué `moveend`/`zoomend` y no `move`/`zoom` ────────────────────────────
 * `move` y `zoom` disparan por CADA píxel de arrastre: un `setState` por frame
 * de paneo en una pantalla que además tiene poll de 60 s. Los eventos de FIN dan
 * el mismo número con un render por gesto.
 *
 * El recuento también corre cuando cambian los datos (`signature`): un poll
 * puede sacar o meter una cuadrilla del viewport sin que el mapa se mueva.
 *
 * Todo va con guarda: el mock de tests no implementa el mapa entero, y sin
 * `getBounds` el conteo tiene que ser 0 — un "todas fuera de la vista" falso
 * manda a recentrar sin motivo.
 */
function OffscreenCounter({
  points,
  signature,
  onCount,
}: {
  points: Array<[number, number]>;
  /** Cambia cuando cambian los marcadores o sus posiciones. */
  signature: string;
  onCount: (count: number) => void;
}) {
  const map = useMap();

  const pointsRef = useRef(points);
  pointsRef.current = points;
  const onCountRef = useRef(onCount);
  onCountRef.current = onCount;

  const recount = useCallback(() => {
    const bounds = typeof map.getBounds === 'function' ? map.getBounds() : null;
    if (bounds == null || typeof bounds.contains !== 'function') {
      onCountRef.current(0);
      return;
    }
    onCountRef.current(pointsRef.current.filter((point) => !bounds.contains(point)).length);
  }, [map]);

  useEffect(() => {
    if (typeof map.on !== 'function') return;
    map.on('moveend', recount);
    map.on('zoomend', recount);
    return () => {
      if (typeof map.off === 'function') {
        map.off('moveend', recount);
        map.off('zoomend', recount);
      }
    };
  }, [map, recount]);

  useEffect(() => {
    recount();
  }, [recount, signature]);

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

/**
 * Nombre accesible del botón "Ver jornada". Vive acá y no inline porque
 * `closeJourney` lo usa para reencontrar el botón cuando el poll lo desmontó y
 * lo volvió a montar en la otra lista: si las dos formas se separan, el foco
 * cae al `<body>` en silencio.
 */
function journeyButtonLabel(teamName: string): string {
  return `Ver jornada de ${teamName}`;
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
            aria-label={journeyButtonLabel(team.name)}
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

  /**
   * Contador de "Recentrar". El encuadre automático sólo reacciona a las ALTAS
   * de cuadrilla; volver a centrar sobre las posiciones actuales es una decisión
   * del operador y entra al `MapFitter` por acá, como `recenterNonce`.
   */
  const [recenterCount, setRecenterCount] = useState(0);

  /**
   * Marcadores fuera del viewport. Lo calcula `OffscreenCounter` contra
   * `map.getBounds()` — el encuadre ya no persigue posiciones, así que sin este
   * aviso el encabezado puede decir 6 mientras la vista muestra 3.
   */
  const [offscreenCount, setOffscreenCount] = useState(0);

  /** Botón que abrió el panel: al cerrar, el foco vuelve ahí y no al <body>. */
  const panelTriggerRef = useRef<HTMLButtonElement | null>(null);
  /** Ancla de foco de último recurso: ver `closeJourney`. */
  const mapHeadingRef = useRef<HTMLHeadingElement>(null);

  function openJourney(team: TeamLiveStatus, trigger: HTMLButtonElement) {
    panelTriggerRef.current = trigger;
    setSelected(team);
    setDay(todayAr);
  }

  /**
   * Al cerrar, el foco vuelve al botón que abrió el panel — y si ese botón ya no
   * existe, a algo estable. NUNCA al `<body>`.
   *
   * El poll de 60 s puede desmontarlo sin que nadie toque nada: una cuadrilla
   * que cruza las 24 h migra de `active-list` a `stale-list`, React desmonta ese
   * botón y monta uno equivalente en la otra lista. `.focus()` sobre un nodo
   * huérfano no hace nada y el teclado queda tirado en el `<body>` — el mismo
   * invariante que blinda LM-12, disparado por el poll en vez de por un handler.
   *
   * El botón equivalente se busca comparando `aria-label`, NO interpolando el
   * nombre en un `querySelector`: un nombre con comillas o corchetes rompería el
   * selector, y esos nombres los escribe IClass.
   */
  function closeJourney() {
    const trigger = panelTriggerRef.current;
    const label = selected ? journeyButtonLabel(selected.name) : null;

    setSelected(null);
    panelTriggerRef.current = null;

    if (trigger && document.contains(trigger)) {
      trigger.focus();
      return;
    }

    const migrated =
      label == null
        ? undefined
        : Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-label]')).find(
            (button) => button.getAttribute('aria-label') === label,
          );

    if (migrated) {
      migrated.focus();
      return;
    }

    // La cuadrilla ya no está en el roster: ancla estable, nunca el <body>.
    mapHeadingRef.current?.focus();
  }

  const journeyQuery = useTeamJourney(selected?.login ?? null, day, todayAr);
  const journeyRequiresAuditPerm = journeyRequiresAudit(day, todayAr);
  /**
   * NO es una guarda: el día pasa el gate del BE y responde 200. Es la causa del
   * vacío — más atrás de 12 meses el `purgeOlderThan` del ingest ya borró la fila,
   * y sin esto el panel le ofrece al auditor "la app pudo estar cerrada" para un
   * hueco que produjo una política de retención.
   */
  const journeyBeyondRetention = isBeyondJourneyRetention(day, todayAr);
  /**
   * TanStack pausa el query si el navegador está offline (`fetchStatus:
   * 'paused'`): mismos `isLoading:false / isError:false / data:undefined` que un
   * query deshabilitado. Sin distinguirlo, el panel decía "todavía no se
   * consultó" — suena a que falta apretar algo, cuando lo que falta es la red.
   */
  const journeyPaused = journeyQuery.fetchStatus === 'paused';
  /** Un 403 es "no te corresponde", no "se rompió". Se presenta distinto. */
  const journeyForbidden =
    axios.isAxiosError(journeyQuery.error) && journeyQuery.error.response?.status === 403;

  /**
   * Un solo useMemo atado a `data`. OJO: `data` NO es referencialmente estable
   * entre polls — el BE recalcula `minutesSinceLastPoint` contra `now()` en cada
   * request, así que cada 60 s llega un objeto nuevo aunque nada se haya movido.
   * Por eso el encuadre del mapa NO puede colgarse de la identidad de `fitPoints`:
   * va por `fitSignature` (abajo), que sólo cambia cuando cambia el CONJUNTO de
   * cuadrillas encuadradas.
   */
  const {
    teams,
    active,
    stale,
    noTrail,
    markers,
    markerPoints,
    markerSignature,
    fitPoints,
    fitSignature,
    usingFallbackFrame,
  } = useMemo(() => {
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
        markerPoints: withCoords.map((t) => [t.latitude, t.longitude] as [number, number]),
        /**
         * Firma del CONTEO fuera de la vista. Acá las coordenadas SÍ van: un
         * marcador que se movió puede haber salido del viewport sin que el mapa
         * se moviera. Es la contracara exacta de `fitSignature`, que las excluye
         * porque encuadrar por deriva del GPS le roba el zoom al operador —
         * recontar no le mueve nada.
         */
        markerSignature: withCoords
          .map((t) => `${t.login}@${t.latitude},${t.longitude}`)
          .sort()
          .join('|'),
        fitPoints: frameTeams.map((t) => [t.latitude, t.longitude] as [number, number]),
        /**
         * CONJUNTO de logins encuadrables, ordenado. `MapFitter` lo compara
         * contra el del encuadre anterior para detectar ALTAS (ver su docblock:
         * una baja no reencuadra).
         *
         * Sin coordenadas a propósito: con precisiones de 12-40 m un teléfono
         * quieto reporta coordenadas nuevas en cada breadcrumb, y cualquier
         * disparador que las mire le arrebata el pan/zoom al operador por puro
         * ruido del GPS. El orden se normaliza porque el BE no lo garantiza
         * entre requests.
         */
        fitSignature: frameTeams
          .map((t) => t.login)
          .sort()
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
              <div className={styles.mapHead}>
                {/* `tabIndex={-1}`: NO entra en el orden de tabulación. Es el
                    ancla de foco de `closeJourney` cuando el poll desmontó el
                    botón que abrió el panel (ver ahí). */}
                <h2
                  id="map-heading"
                  className={styles.sectionTitle}
                  ref={mapHeadingRef}
                  tabIndex={-1}
                >
                  Mapa — sólo cuadrillas activas ({markers.length})
                </h2>
                <div className={styles.mapHeadActions}>
                  {/* El encabezado puede decir 6 mientras la vista muestra 3: el
                      encuadre ya no persigue posiciones. Sin este aviso, quien
                      mira el tablero de lejos no tiene forma de enterarse. */}
                  {offscreenCount > 0 && (
                    <p className={styles.offscreen} role="status" data-testid="map-offscreen">
                      {offscreenCount} {offscreenCount === 1 ? 'cuadrilla' : 'cuadrillas'} fuera de
                      la vista
                    </p>
                  )}
                  {/* El encuadre automático no persigue posiciones: recuperarlo es
                      una acción explícita. Sin puntos que encuadrar no se ofrece
                      un botón que no haría nada. */}
                  {fitPoints.length > 0 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setRecenterCount((n) => n + 1)}
                    >
                      Recentrar
                    </Button>
                  )}
                </div>
              </div>
              {fitPoints.length > 0 && (
                <p className={styles.mapHint}>
                  El encuadre es tuyo: el mapa se reencuadra por su cuenta únicamente cuando
                  APARECE una cuadrilla —que puede caer fuera de la vista—; cuando una se va, el
                  encuadre queda como lo dejaste. «Recentrar» vuelve a encuadrar las posiciones
                  actuales.
                </p>
              )}
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
                    logins={fitSignature}
                    /* El pedido explícito del operador: la ÚNICA forma de que el
                       encuadre siga a las posiciones. */
                    recenterNonce={recenterCount}
                    /* Encuadre de respaldo: acercarse a nivel 15 sobre una
                       posición de hace más de 24 h la vestiría de dato actual. */
                    maxZoom={usingFallbackFrame ? 12 : 15}
                  />
                  <OffscreenCounter
                    points={markerPoints}
                    signature={markerSignature}
                    onCount={setOffscreenCount}
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
                  beyondRetention={journeyBeyondRetention}
                  journey={journeyQuery.data}
                  isLoading={journeyQuery.isLoading}
                  isError={journeyQuery.isError}
                  isForbidden={journeyForbidden}
                  isPaused={journeyPaused}
                  /* El query RESOLVIÓ. Con `data: undefined` eso ya no es
                     "todavía no se consultó": el pedido salió y volvió vacío. */
                  isSuccess={journeyQuery.isSuccess}
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
                      /* `openJourney` a secas: un handler inline que descarte el
                         segundo argumento deja `panelTriggerRef` con el botón
                         ANTERIOR, y al cerrar el foco aterriza en la fila de otro
                         técnico. En una pantalla que decide a quién se investiga,
                         eso no es cosmético. */
                      <TeamRow
                        key={team.login}
                        team={team}
                        selected={selected?.login === team.login}
                        onSelect={openJourney}
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
