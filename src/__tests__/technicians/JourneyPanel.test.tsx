/**
 * JourneyPanel — el panel NUNCA deja un hueco.
 *
 * Este panel se lee para juzgar si una persona trabajó. Cada agujero de
 * información se completa con la peor hipótesis, así que los tests de acá abajo
 * blindan justamente los huecos:
 *
 *  · JP-1  La 4ª rama: `enabled:false` de TanStack v5 devuelve
 *          `isLoading:false + isError:false + data:undefined`. Sin una rama
 *          explícita el panel queda EN BLANCO bajo el título con la fecha
 *          elegida — y un supervisor lo lee como "no trabajó".
 *  · JP-2  Con UN solo punto no hay tramo que medir: el BE manda
 *          `travelledMetersLowerBound: 0` y `medianSamplingMinutes: null`.
 *          Imprimir "Mínimo estimado 0 m" se lee como "no se movió en todo el
 *          día". Va "—" + la razón.
 *  · JP-3  La distribución horaria rellena los huecos del rango: puntos en
 *          06-08 y 18-19 NO pueden dibujarse como 5 barras contiguas (jornada
 *          continua aparente). Las horas sin cobertura son el dato que permite
 *          juzgar la solidez.
 *  · JP-4  Un 403 por día histórico no es una falla técnica: se explica que ese
 *          día requiere el permiso de auditoría y NO se ofrece un reintento que
 *          va a comer 403 en loop.
 *  · JP-5  La nota de alcance separa el tope de PERMISO (no existe: el gate no
 *          mira antigüedad) del horizonte de DATOS (12 meses, borrado duro).
 *  · JP-6  Un día anterior a ese horizonte volvió vacío porque el dato SE BORRÓ.
 *          Ofrecer ahí "la app pudo estar cerrada" es dar hipótesis sobre la
 *          conducta de una persona para un hueco que produjo una política.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { JourneyPanel } from '@/components/technicians/JourneyPanel';
import type { TeamDailyJourney } from '@/types/technicianLocation';

const JOURNEY: TeamDailyJourney = {
  teamLogin: 'IPNXDENIC',
  argentinaDay: '2026-07-26',
  pointCount: 29,
  firstPointAt: '2026-07-26T09:08:00.000Z',
  lastPointAt: '2026-07-26T12:41:00.000Z',
  pointsByHour: { '06': 12, '07': 9, '08': 8 },
  travelledMetersLowerBound: 2200,
  isLowerBound: true,
  medianSamplingMinutes: 7,
};

type PanelProps = Parameters<typeof JourneyPanel>[0];

function renderPanel(over: Partial<PanelProps> = {}) {
  const props: PanelProps = {
    teamName: 'Denis C.',
    teamLogin: 'IPNXDENIC',
    day: '2026-07-26',
    minDay: '2026-07-25',
    maxDay: '2026-07-26',
    onDayChange: vi.fn(),
    canAudit: false,
    requiresAudit: false,
    beyondRetention: false,
    journey: JOURNEY,
    isLoading: false,
    isError: false,
    isForbidden: false,
    isPaused: false,
    isSuccess: true,
    onRetry: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
  /**
   * `isSuccess` ACOMPAÑA a `journey` salvo que el caso lo diga explícitamente:
   * un query que resolvió SIN cuerpo (JP-1e) es la excepción rara, no el
   * default. Fijarlo en `true` a secas convertiría en "respuesta vacía" a los
   * casos de JP-1/JP-1b/JP-1c/JP-1d, que hablan de otra cosa.
   */
  if (!('isSuccess' in over)) props.isSuccess = props.journey !== undefined;
  return { ...render(<JourneyPanel {...props} />), props };
}

/** Texto visible del panel, sin el encabezado ni el selector de día. */
function bodyText(): string {
  const panel = screen.getByTestId('journey-panel');
  return panel.textContent ?? '';
}

describe('JP-1: la 4ª rama — el panel nunca queda en blanco', () => {
  it('sin datos, sin loading y sin error EXPLICA por qué (no deja un hueco)', () => {
    renderPanel({
      journey: undefined,
      isLoading: false,
      isError: false,
      requiresAudit: true,
      canAudit: false,
      day: '2020-01-01',
    });

    const note = screen.getByTestId('journey-unavailable');
    expect(note).toBeInTheDocument();
    // Dice POR QUÉ, no "no hay datos" a secas.
    expect(note.textContent ?? '').toMatch(/permiso de auditoría/i);
    // Y jamás se lee como "no trabajó".
    expect(bodyText()).not.toMatch(/no trabajó|sin actividad/i);
  });

  it('el mensaje distingue "fuera de tu alcance" de "sin puntos ese día"', () => {
    const { unmount } = renderPanel({
      journey: undefined,
      requiresAudit: true,
      canAudit: false,
      day: '2020-01-01',
    });
    expect(screen.getByTestId('journey-unavailable').textContent ?? '').not.toMatch(
      /sin puntos registrados/i,
    );
    unmount();

    // Con puntos en 0 la respuesta SÍ llegó: es el empty real, no el bloqueo.
    renderPanel({ journey: { ...JOURNEY, pointCount: 0 } });
    expect(screen.queryByTestId('journey-unavailable')).not.toBeInTheDocument();
    expect(screen.getByTestId('journey-empty')).toHaveTextContent(/ausencia de datos/i);
  });

  it('exactamente UNA rama de estado está viva a la vez', () => {
    // `journey-forbidden` va en la lista: sin él, el 403 podía convivir con otra
    // rama (o no aparecer) y este test seguía en verde. La exclusividad se
    // verifica sobre TODAS las salidas del panel, no sobre cuatro de cinco.
    const branches = [
      'journey-skeleton',
      'journey-unavailable',
      'journey-forbidden',
      'journey-error',
      'journey-empty',
      'journey-first',
    ] as const;

    const cases: Array<Partial<PanelProps>> = [
      { isLoading: true, journey: undefined },
      { journey: undefined, requiresAudit: true },
      { journey: undefined, day: '' },
      { journey: undefined, day: '2099-01-01', maxDay: '2026-07-26' },
      { journey: undefined, isPaused: true },
      { journey: undefined, isSuccess: true },
      { journey: undefined, isError: true, isForbidden: true, day: '2020-01-01' },
      { journey: undefined, isError: true, isForbidden: false },
      { journey: { ...JOURNEY, pointCount: 0 } },
      {},
    ];

    for (const over of cases) {
      const { unmount } = renderPanel(over);
      const alive = branches.filter((id) => screen.queryByTestId(id) !== null);
      expect(alive, `caso ${JSON.stringify(over)}`).toHaveLength(1);
      unmount();
    }
  });

  it('al abrirse mueve el foco al encabezado del panel', () => {
    renderPanel();
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2 }));
  });
});

/**
 * JP-1b — la 4ª rama no puede AFIRMAR UN LÍMITE DE PERMISO QUE NO SE DISPARÓ.
 *
 * El `<input type="date">` de Chrome y Firefox trae un botón para limpiar el
 * valor: apretarlo deja `day === ''`. Como `journeyRequiresAudit` es fail-closed,
 * un día vacío "requiere auditoría" y el panel salía con «El  queda fuera de tu
 * alcance: la jornada de días anteriores a ayer requiere el permiso de
 * auditoría» — una frase rota Y falsa: nadie pidió un día histórico. Inventarle
 * al operador un límite de permiso es exactamente el tipo de afirmación sin
 * respaldo que este change combate.
 */
describe('JP-1b: el día vacío no inventa un límite de permiso', () => {
  it('con el selector vacío pide elegir un día y NO habla de permisos', () => {
    renderPanel({ journey: undefined, day: '', requiresAudit: true, canAudit: false });

    const note = screen.getByTestId('journey-unavailable');
    expect(note).toHaveAttribute('data-reason', 'no-day');
    expect(note.textContent ?? '').toMatch(/elegí un día/i);
    expect(note.textContent ?? '').not.toMatch(/permiso|auditoría|alcance/i);
    // La frase rota que salía antes: "El  queda fuera de tu alcance".
    expect(note.textContent ?? '').not.toMatch(/El\s{2,}/);
  });

  it('con permiso de auditoría tampoco finge que se consultó algo', () => {
    renderPanel({ journey: undefined, day: '', requiresAudit: true, canAudit: true });
    const note = screen.getByTestId('journey-unavailable');
    expect(note).toHaveAttribute('data-reason', 'no-day');
    expect(note.textContent ?? '').not.toMatch(/todavía no se consultó la jornada del\s*\./i);
  });
});

/**
 * JP-1c — un día FUTURO no es un límite de permiso ni una falla técnica.
 *
 * El BE responde 400 a un día futuro y `journeyRequiresAudit` lo deja pasar
 * (daysBack negativo → false). Sin esta rama el operador veía "No se pudo cargar
 * la jornada" + un Reintentar que jamás iba a funcionar.
 */
describe('JP-1c: el día futuro se explica como entrada inválida', () => {
  it('dice que el día todavía no ocurrió y no ofrece reintentar', () => {
    renderPanel({
      journey: undefined,
      day: '2099-01-01',
      maxDay: '2026-07-26',
      requiresAudit: false,
      canAudit: false,
    });

    const note = screen.getByTestId('journey-unavailable');
    expect(note).toHaveAttribute('data-reason', 'future');
    expect(note.textContent ?? '').toMatch(/todavía no ocurrió/i);
    expect(note.textContent ?? '').not.toMatch(/permiso de auditoría/i);
    expect(screen.queryByRole('button', { name: /reintentar/i })).not.toBeInTheDocument();
  });
});

/**
 * JP-1d — sin conexión el panel no dice "todavía no se consultó".
 *
 * TanStack pausa el query cuando el navegador está offline (`fetchStatus:
 * 'paused'`): mismos `isLoading:false, isError:false, data:undefined` que el
 * query deshabilitado. "Todavía no se consultó" suena a que falta apretar algo;
 * lo que falta es la red.
 */
describe('JP-1d: sin conexión se dice que es la conexión', () => {
  it('distingue el query pausado por falta de red', () => {
    renderPanel({ journey: undefined, isPaused: true, day: '2026-07-26' });
    const note = screen.getByTestId('journey-unavailable');
    expect(note).toHaveAttribute('data-reason', 'offline');
    expect(note.textContent ?? '').toMatch(/conexión/i);
  });

  it('el bloqueo por permiso gana sobre la falta de conexión (no se pidió, ni se va a pedir)', () => {
    renderPanel({
      journey: undefined,
      isPaused: true,
      requiresAudit: true,
      canAudit: false,
      day: '2020-01-01',
    });
    expect(screen.getByTestId('journey-unavailable')).toHaveAttribute(
      'data-reason',
      'requires-audit',
    );
  });
});

/**
 * JP-1e — el 6º camino: la respuesta LLEGÓ y vino vacía.
 *
 * `technicianLocation.api.ts` hace `.then((r) => r.data.data)`. Un 200 con
 * cuerpo vacío (o un envelope sin `data`) resuelve el query con `undefined`:
 * TanStack marca `isSuccess:true, isLoading:false, isError:false, data:undefined`
 * — exactamente la firma de la 5ª rama. Sin distinguirlo, el panel salía con
 * «Todavía no se consultó la jornada del …» AFIRMANDO QUE NO SE CONSULTÓ cuando
 * el pedido salió, volvió y falló en silencio. Es el mismo defecto que `no-day`
 * vino a matar: decir algo que no pasó.
 */
describe('JP-1e: una respuesta vacía no se disfraza de "todavía no se consultó"', () => {
  it('con el query resuelto y sin cuerpo dice que la respuesta llegó vacía', () => {
    renderPanel({ journey: undefined, isSuccess: true, day: '2026-07-26' });

    const note = screen.getByTestId('journey-unavailable');
    expect(note).toHaveAttribute('data-reason', 'empty-response');
    expect(note.textContent ?? '').toMatch(/vacía/i);
    expect(note.textContent ?? '').not.toMatch(/todavía no se consultó/i);
    // Y sigue sin leerse como un juicio sobre la persona.
    expect(bodyText()).not.toMatch(/no trabajó|sin actividad/i);
  });

  it('sin el query resuelto sigue siendo idle: no se consultó de verdad', () => {
    renderPanel({ journey: undefined, isSuccess: false, day: '2026-07-26' });
    expect(screen.getByTestId('journey-unavailable')).toHaveAttribute('data-reason', 'idle');
  });

  it.each([
    ['no-day', { day: '' }],
    ['future', { day: '2099-01-01', maxDay: '2026-07-26' }],
    ['requires-audit', { day: '2020-01-01', requiresAudit: true, canAudit: false }],
    ['offline', { isPaused: true }],
  ] as const)('%s gana sobre la respuesta vacía', (reason, over) => {
    // Los motivos de arriba explican por qué el pedido NO salió: si además el
    // query quedó marcado como resuelto (de una consulta anterior), el motivo
    // real sigue siendo el de arriba.
    const { unmount } = renderPanel({ journey: undefined, isSuccess: true, ...over });
    expect(screen.getByTestId('journey-unavailable')).toHaveAttribute('data-reason', reason);
    unmount();
  });
});

/**
 * JP-1f — el `idle` no puede contradecirse a sí mismo.
 *
 * El texto decía «Todavía no se consultó la jornada del 2026-07-27. Elegí un día
 * para verla»: NOMBRA el día elegido y en la oración siguiente pide elegir uno.
 * En esa rama `day !== ''` está GARANTIZADO — `no-day` ya lo atajó antes. Pedir
 * una acción que ya está hecha manda al operador a buscar un problema que no
 * existe.
 */
describe('JP-1f: el idle no pide elegir un día que ya está elegido', () => {
  it('nombra el día y NO pide elegir uno', () => {
    renderPanel({ journey: undefined, isSuccess: false, day: '2026-07-26' });

    const note = screen.getByTestId('journey-unavailable');
    expect(note).toHaveAttribute('data-reason', 'idle');
    expect(note.textContent ?? '').toContain('2026-07-26');
    expect(note.textContent ?? '').not.toMatch(/elegí un día/i);
  });
});

/**
 * JP-5 — la nota de alcance tiene que nombrar el horizonte de DATOS, y no
 * confundirlo con un tope de permiso.
 *
 * Son DOS límites distintos y la ola anterior los fusionó en uno solo:
 *
 *  · **Permiso** — `technicianLocation.routes.ts` valida formato, que el día no
 *    sea futuro y qué permiso exige. NO tiene cap de antigüedad: con
 *    `technicians.location_audit` el gate deja pasar cualquier día pasado.
 *  · **Datos** — `IngestTeamLocations` (`DEFAULT_RETENTION_MONTHS = 12`) llama a
 *    `repo.purgeOlderThan(cutoff)` en CADA corrida, y
 *    `PrismaTeamLocationRepository.purgeOlderThan` hace `deleteMany`: BORRADO
 *    DURO. `GetTeamDailyJourney` lee `findByTeamOnDay` sobre esa misma tabla, sin
 *    fallback a IClass (que además retiene ~30 días rolling).
 *
 * De ahí que la nota anterior —«podés consultar cualquier día pasado, hasta hoy»—
 * fuera una promesa que el sistema no puede cumplir: el auditor pide 2025-05-10,
 * recibe 200 con `pointCount: 0` y lee un vacío que la nota le presentó como
 * consultable. Nombrar el horizonte no es inventar una restricción: es la única
 * forma de que ese vacío no se lea como conducta.
 */
describe('JP-5: la nota de alcance separa el tope de permiso del horizonte de datos', () => {
  it('con permiso de auditoría NOMBRA el horizonte de retención', () => {
    renderPanel({ canAudit: true });
    const text = screen.getByTestId('journey-scope-note').textContent ?? '';
    expect(text).toMatch(/12 meses/i);
    // Y lo atribuye a la conservación del dato, no a una regla de acceso.
    expect(text).toMatch(/se conserva|se borr|retención/i);
  });

  it('NO presenta la retención como un tope de permiso', () => {
    renderPanel({ canAudit: true });
    const text = screen.getByTestId('journey-scope-note').textContent ?? '';
    // «podés consultar … 12 meses» / «hasta 12 meses atrás» = cap de acceso, y
    // ese cap NO existe: el gate del BE no mira la antigüedad del día.
    expect(text).not.toMatch(/(podés|puede|podes)\s+consultar[^.]{0,80}12 meses/i);
    expect(text).not.toMatch(/hasta\s+(los\s+)?12 meses/i);
    // El permiso se nombra como lo que es: sin tope de antigüedad.
    expect(text).toMatch(/permiso[^.]*no tiene tope|no tiene tope[^.]*permiso/i);
  });

  it('deja dicho que un vacío por purga NO es un dato sobre la jornada', () => {
    renderPanel({ canAudit: true });
    const text = screen.getByTestId('journey-scope-note').textContent ?? '';
    expect(text).toMatch(/jornada/i);
    expect(text).toMatch(/no dice|no significa|no es que/i);
  });

  it('sin el permiso sigue diciendo el corte real: hoy y ayer', () => {
    renderPanel({ canAudit: false });
    expect(screen.getByTestId('journey-scope-note').textContent ?? '').toMatch(/hoy y ayer/i);
  });
});

/**
 * JP-6 — el vacío de un día PURGADO no puede explicarse con la conducta del
 * técnico.
 *
 * Un día dentro del horizonte que vuelve con `pointCount: 0` tiene dos causas
 * plausibles y honestas: la app cerrada o el teléfono sin señal. Un día ANTERIOR
 * al horizonte tiene UNA sola causa conocida —el `deleteMany` de la purga— y esas
 * dos quedan FALSAS. Ofrecérselas igual al auditor es exactamente el defecto que
 * este change existe para matar, dado vuelta: dos hipótesis sobre una persona
 * para un hueco que produjo una política de retención.
 *
 * La nota de alcance (JP-5) no alcanza sola: vive ARRIBA del panel y es estática,
 * mientras que este texto aparece ABAJO, nombrando el día concreto, justo donde
 * el auditor está formando el juicio. Es el mismo criterio por el que la 5ª rama
 * tiene SEIS motivos en vez de un texto único: cada hueco dice SU verdad.
 */
describe('JP-6: un día fuera del horizonte de retención dice que el dato se borró', () => {
  const EMPTY_DAY: TeamDailyJourney = { ...JOURNEY, pointCount: 0, pointsByHour: {} };

  it('dentro del horizonte ofrece las causas operativas', () => {
    renderPanel({ journey: EMPTY_DAY, beyondRetention: false });
    const box = screen.getByTestId('journey-empty');
    expect(box).not.toHaveAttribute('data-beyond-retention');
    expect(box.textContent ?? '').toMatch(/app pudo estar cerrada/i);
  });

  it('fuera del horizonte NO culpa a la app ni al teléfono', () => {
    renderPanel({ journey: EMPTY_DAY, beyondRetention: true, canAudit: true, day: '2020-05-10' });
    const box = screen.getByTestId('journey-empty');
    expect(box).toHaveAttribute('data-beyond-retention', 'true');
    expect(box.textContent ?? '').not.toMatch(/app pudo estar cerrada|sin señal/i);
  });

  it('nombra la purga como la causa y aclara que no es un dato del día', () => {
    renderPanel({ journey: EMPTY_DAY, beyondRetention: true, canAudit: true, day: '2020-05-10' });
    const text = screen.getByTestId('journey-empty').textContent ?? '';
    expect(text).toMatch(/12 meses/i);
    expect(text).toMatch(/se borr/i);
    expect(text).toMatch(/no dice|no significa|no es que/i);
    // Y jamás se lee como un juicio sobre la persona.
    expect(bodyText()).not.toMatch(/no trabajó|sin actividad/i);
  });

  it('sigue siendo UNA sola rama viva', () => {
    renderPanel({ journey: EMPTY_DAY, beyondRetention: true });
    expect(screen.queryByTestId('journey-unavailable')).not.toBeInTheDocument();
    expect(screen.queryByTestId('journey-first')).not.toBeInTheDocument();
    expect(screen.getByTestId('journey-empty')).toBeInTheDocument();
  });

  it('con puntos registrados no reclama purga: el rastro que llegó gana', () => {
    // El dato SOBREVIVIÓ. El `beyondRetention` del FE es una aproximación al cutoff
    // del BE (que lleva hora), así que el rastro efectivamente servido le gana a la
    // estimación: se muestra la jornada y no se explica ningún vacío.
    // La nota de alcance sí sigue nombrando la retención — es una advertencia
    // general sobre el horizonte, cierta haya o no haya puntos ese día.
    renderPanel({ journey: JOURNEY, beyondRetention: true, canAudit: true });
    expect(screen.queryByTestId('journey-empty')).not.toBeInTheDocument();
    expect(screen.getByTestId('journey-points')).toHaveTextContent('29');
  });
});

describe('JP-2: con un solo punto NO se imprime un recorrido', () => {
  const SINGLE: TeamDailyJourney = {
    ...JOURNEY,
    pointCount: 1,
    pointsByHour: { '09': 1 },
    travelledMetersLowerBound: 0,
    medianSamplingMinutes: null,
  };

  it('muestra "—" en vez de "0 m" — "0 m" se lee como "no se movió"', () => {
    renderPanel({ journey: SINGLE });
    const distance = screen.getByTestId('journey-distance');
    expect(distance).toHaveTextContent('—');
    expect(distance.textContent ?? '').not.toMatch(/0\s*m\b/);
    expect(distance.textContent ?? '').not.toMatch(/mínimo estimado/i);
  });

  it('dice la razón: hace falta más de un punto para estimar recorrido', () => {
    renderPanel({ journey: SINGLE });
    expect(bodyText()).toMatch(/más de un punto/i);
    expect(screen.getByTestId('journey-sampling')).toHaveTextContent('—');
  });

  it('con muestreo conocido SÍ muestra el mínimo estimado', () => {
    renderPanel({ journey: JOURNEY });
    const distance = screen.getByTestId('journey-distance');
    expect(distance).toHaveTextContent(/mínimo estimado/i);
    expect(distance).toHaveTextContent(/2,2 km/);
  });
});

describe('JP-3: la distribución horaria no puede ocultar los huecos', () => {
  const GAPPED: TeamDailyJourney = {
    ...JOURNEY,
    pointCount: 35,
    pointsByHour: { '06': 12, '07': 9, '08': 8, '18': 4, '19': 2 },
  };

  // `getByText('12')` sería ambiguo: 12 es a la vez la etiqueta de una hora y el
  // conteo de otra. La columna se ubica por `data-hour`.
  const hourItem = (hour: string) =>
    screen.getByTestId('journey-hours').querySelector(`li[data-hour="${hour}"]`);

  it('rellena con cero todas las horas del rango, no sólo las presentes', () => {
    renderPanel({ journey: GAPPED });
    const hours = screen.getByTestId('journey-hours');
    // 06..19 = 14 columnas, no 5.
    expect(within(hours).getAllByRole('listitem')).toHaveLength(14);
    for (const h of ['09', '10', '11', '12', '13', '14', '15', '16', '17']) {
      expect(hourItem(h), `falta la hora ${h}`).not.toBeNull();
    }
  });

  it('las horas sin cobertura se marcan como vacías y no dibujan barra', () => {
    renderPanel({ journey: GAPPED });
    const noon = hourItem('12');
    expect(noon).not.toBeNull();
    expect(noon).toHaveAttribute('data-empty', 'true');
    expect(noon).toHaveTextContent('0');
    // La barra queda en 0%: el piso de 6% haría ver cobertura donde no hubo.
    expect(noon?.querySelector('[class*="hourBar"]')).toHaveStyle({ height: '0%' });
  });

  it('anuncia cuántas horas del rango quedaron sin cobertura', () => {
    renderPanel({ journey: GAPPED });
    expect(screen.getByTestId('journey-hour-gaps')).toHaveTextContent(/9 h/);
  });

  it('sin huecos no inventa una advertencia', () => {
    renderPanel({ journey: JOURNEY });
    expect(screen.queryByTestId('journey-hour-gaps')).not.toBeInTheDocument();
  });
});

describe('JP-4: el 403 por día histórico no es una falla técnica', () => {
  it('explica que ese día requiere el permiso de auditoría', () => {
    renderPanel({ journey: undefined, isError: true, isForbidden: true, day: '2025-03-04' });
    const box = screen.getByTestId('journey-forbidden');
    expect(box.textContent ?? '').toMatch(/permiso de auditoría/i);
    expect(box.textContent ?? '').not.toMatch(/no se pudo cargar/i);
  });

  it('NO ofrece reintentar: el reintento come 403 en loop', async () => {
    const onRetry = vi.fn();
    renderPanel({ journey: undefined, isError: true, isForbidden: true, onRetry });
    expect(screen.queryByRole('button', { name: /reintentar/i })).not.toBeInTheDocument();
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('un error que NO es 403 sí ofrece reintentar', async () => {
    const onRetry = vi.fn();
    renderPanel({ journey: undefined, isError: true, isForbidden: false, onRetry });
    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo cargar/i);
    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});
