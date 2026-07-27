/**
 * TechniciansLiveMapPage — mapa en vivo de cuadrillas.
 *
 * Reglas que los tests blindan (spec `iclass-team-live-map`):
 *  · Una cuadrilla DESACTUALIZADA no se dibuja como posición actual — se lista
 *    aparte con la antigüedad del dato. Un pin viejo en un mapa "en vivo" manda
 *    a un despachante a un lugar donde la cuadrilla no está.
 *  · Una cuadrilla SIN_RASTRO no es un pin fantasma: va en su propia lista.
 *  · La distancia recorrida se rotula "mínimo estimado", con el intervalo de
 *    muestreo visible. Nunca como valor exacto.
 *  · Las 4 ramas de estado (loading / empty / error / success).
 */
import { render, screen, within, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useMap } from 'react-leaflet';

vi.mock('@/hooks/useTechnicianLocation', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useTechnicianLocation')>(
    '@/hooks/useTechnicianLocation',
  );
  return { ...actual, useTeamsLive: vi.fn(), useTeamJourney: vi.fn() };
});
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: vi.fn(),
  useCan: vi.fn(() => true),
}));

import { useTeamsLive, useTeamJourney } from '@/hooks/useTechnicianLocation';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import type { TeamLiveStatus, TeamDailyJourney } from '@/types/technicianLocation';
import TechniciansLiveMapPage from '@/pages/technicians/TechniciansLiveMapPage';

type LiveResult = ReturnType<typeof useTeamsLive>;
type JourneyResult = ReturnType<typeof useTeamJourney>;

const ACTIVA: TeamLiveStatus = {
  login: 'IPNXDENIC',
  name: 'Denis C.',
  iclassStatus: 'Ativo',
  state: 'ACTIVA',
  latitude: -34.6037,
  longitude: -58.3816,
  lastPointAt: '2026-07-26T12:00:00.000Z',
  accuracyMeters: 12,
  minutesSinceLastPoint: 4,
  mapsUrl: 'https://maps.example/denis',
};

const DESACTUALIZADA: TeamLiveStatus = {
  login: 'IPNXANTONIOM',
  name: 'Antonio M.',
  iclassStatus: 'Ativo',
  state: 'DESACTUALIZADA',
  latitude: -34.7,
  longitude: -58.4,
  lastPointAt: '2026-07-24T12:00:00.000Z',
  accuracyMeters: 40,
  minutesSinceLastPoint: 2880,
  mapsUrl: 'https://maps.example/antonio',
};

const SIN_RASTRO: TeamLiveStatus = {
  login: 'IPNXSEBAM',
  name: 'Seba M.',
  iclassStatus: 'Cancelado',
  state: 'SIN_RASTRO',
  latitude: null,
  longitude: null,
  lastPointAt: null,
  accuracyMeters: null,
  minutesSinceLastPoint: null,
  mapsUrl: null,
};

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

function mockPerms(perms: string[]) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions: perms,
    isLoading: false,
    isError: false,
    can: (p: string | string[]) => {
      const list = Array.isArray(p) ? p : [p];
      return perms.includes('*') || list.some((x) => perms.includes(x));
    },
  } as UseMyPermissionsResult);
}

function mockLive(over: Partial<LiveResult>) {
  vi.mocked(useTeamsLive).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...over,
  } as unknown as LiveResult);
}

function mockJourney(over: Partial<JourneyResult> = {}) {
  vi.mocked(useTeamJourney).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...over,
  } as unknown as JourneyResult);
}

/**
 * FÁBRICA, no constante: React hace bail-out cuando `rerender` recibe el MISMO
 * objeto de elemento, así que un elemento compartido convertiría los tests de
 * re-render en no-ops que pasan siempre.
 */
const pageElement = () => (
  <MemoryRouter>
    <TechniciansLiveMapPage />
  </MemoryRouter>
);

const renderPage = () => render(pageElement());

/**
 * Instancia de mapa ESTABLE, como la de react-leaflet real: `useMap()` devuelve
 * siempre el mismo objeto Leaflet del contexto. El mock compartido fabrica uno
 * nuevo por llamada, lo que haría refirar cualquier efecto `[map, …]` en cada
 * render y taparía justo la regresión que LM-8 blinda.
 */
const mapStub = { invalidateSize: vi.fn(), fitBounds: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mockPerms(['technicians.location_read']);
  mockJourney();
  vi.mocked(useMap).mockReturnValue(mapStub as unknown as ReturnType<typeof useMap>);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('LM-1: rama loading', () => {
  it('muestra un skeleton, no una pantalla en blanco ni un spinner solo', () => {
    mockLive({ isLoading: true });
    renderPage();
    expect(screen.getByTestId('live-skeleton')).toBeInTheDocument();
    expect(screen.queryAllByTestId('map-marker')).toHaveLength(0);
  });
});

describe('LM-2: rama error', () => {
  it('anuncia el error con role=alert y ofrece reintentar', async () => {
    const refetch = vi.fn();
    mockLive({ isError: true, refetch });
    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo cargar/i);
    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalled();
  });
});

describe('LM-3: rama empty', () => {
  it('explica por qué no hay nada en lugar de mostrar el vacío pelado', () => {
    mockLive({ data: [] });
    renderPage();
    expect(screen.getByTestId('live-empty')).toHaveTextContent(/no hay cuadrillas/i);
  });
});

describe('LM-4: la posición vieja NO se dibuja como actual', () => {
  beforeEach(() => {
    mockLive({ data: [ACTIVA, DESACTUALIZADA, SIN_RASTRO] });
  });

  it('dibuja un solo marcador — el de la cuadrilla activa', () => {
    renderPage();
    const markers = screen.getAllByTestId('map-marker');
    expect(markers).toHaveLength(1);
    expect(markers[0]).toHaveTextContent('Denis C.');
    expect(markers[0]).not.toHaveTextContent('Antonio M.');
  });

  it('lista la desactualizada aparte, con la antigüedad del dato visible', () => {
    renderPage();
    const list = screen.getByTestId('stale-list');
    const row = within(list).getByText('Antonio M.').closest('li');
    expect(row).not.toBeNull();
    expect(row).toHaveTextContent(/hace 2 d/i);
    // Específico a la NOTA de la lista: desde LM-11 el link a Maps de la fila
    // también dice "última posición conocida", así que el matcher genérico
    // encontraba dos nodos. Que aparezca en los dos lugares es lo correcto.
    expect(
      within(list).getByText(/última posición conocida, con más de 24 h/i),
    ).toBeInTheDocument();
  });

  it('lista la sin rastro aparte y NO como pin fantasma', () => {
    renderPage();
    const list = screen.getByTestId('no-trail-list');
    expect(within(list).getByText('Seba M.')).toBeInTheDocument();
    expect(screen.getAllByTestId('map-marker')).toHaveLength(1);
  });

  it('aclara que "sin rastro" no significa que la cuadrilla no esté trabajando', () => {
    renderPage();
    expect(screen.getByTestId('no-trail-list').textContent ?? '').toMatch(
      /no implica que no estén trabajando/i,
    );
  });

  it('publica los contadores por estado en una región aria-live', () => {
    renderPage();
    const counters = screen.getByTestId('live-counters');
    expect(counters).toHaveAttribute('aria-live', 'polite');
    expect(counters).toHaveTextContent(/1\s*activa/i);
    expect(counters).toHaveTextContent(/1\s*desactualizada/i);
    expect(counters).toHaveTextContent(/1\s*sin rastro/i);
  });
});

describe('LM-5: la jornada del día', () => {
  beforeEach(() => {
    mockLive({ data: [ACTIVA] });
    mockJourney({ data: JOURNEY });
  });

  it('muestra inicio, fin y cantidad de puntos al elegir una cuadrilla', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /ver jornada de denis c\./i }));

    const panel = screen.getByTestId('journey-panel');
    expect(within(panel).getByTestId('journey-first')).toHaveTextContent('06:08');
    expect(within(panel).getByTestId('journey-last')).toHaveTextContent('09:41');
    expect(within(panel).getByTestId('journey-points')).toHaveTextContent('29');
  });

  it('rotula la distancia como MÍNIMO ESTIMADO, nunca como exacta', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /ver jornada de denis c\./i }));

    const distance = screen.getByTestId('journey-distance');
    expect(distance).toHaveTextContent(/mínimo estimado/i);
    expect(distance).toHaveTextContent(/2,2 km/);
    expect(distance.textContent ?? '').not.toMatch(/exact/i);
  });

  it('deja visible el intervalo de muestreo junto a la distancia', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /ver jornada de denis c\./i }));
    expect(screen.getByTestId('journey-sampling')).toHaveTextContent(/7 min/);
  });

  it('muestra la distribución horaria', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /ver jornada de denis c\./i }));
    const hours = screen.getByTestId('journey-hours');
    expect(within(hours).getByText('06')).toBeInTheDocument();
    expect(hours).toHaveTextContent('12');
  });
});

describe('LM-6: la jornada histórica exige el permiso de auditoría', () => {
  it('sin technicians.location_audit no permite ir más atrás de ayer y lo explica', async () => {
    mockPerms(['technicians.location_read']);
    mockLive({ data: [ACTIVA] });
    mockJourney();
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /ver jornada de denis c\./i }));

    const dayInput = screen.getByLabelText(/día de la jornada/i) as HTMLInputElement;
    expect(dayInput.min).not.toBe('');
    expect(screen.getByTestId('journey-scope-note').textContent ?? '').toMatch(
      /hoy y ayer|auditoría/i,
    );
  });

  it('con technicians.location_audit el rango se abre', async () => {
    mockPerms(['technicians.location_read', 'technicians.location_audit']);
    mockLive({ data: [ACTIVA] });
    mockJourney({ data: JOURNEY });
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /ver jornada de denis c\./i }));
    const dayInput = screen.getByLabelText(/día de la jornada/i) as HTMLInputElement;
    expect(dayInput.min).toBe('');
  });
});

describe('LM-7: el estado administrativo de IClass no determina el rastreo', () => {
  it('rotula el estado de IClass como administrativo', () => {
    mockLive({ data: [{ ...ACTIVA, iclassStatus: 'Inativo' }] });
    renderPage();
    expect(screen.getByTestId('live-counters')).toHaveTextContent(/1\s*activa/i);
    expect(screen.getByText(/estado administrativo en iclass/i)).toBeInTheDocument();
  });
});

/**
 * LM-8 — el mapa NO le arrebata el pan/zoom al operador.
 *
 * El BE calcula `minutesSinceLastPoint` contra `now()` en CADA request, así que
 * el poll de 60 s devuelve un objeto nuevo aunque las coordenadas sean idénticas.
 * Si el encuadre se ata a la identidad del array de puntos, cada minuto el mapa
 * salta y el despachante pierde el zoom que acababa de hacer.
 */
describe('LM-8: el encuadre se ata a una FIRMA estable, no a la identidad del dato', () => {
  it('no reencuadra cuando sólo cambian los minutos de antigüedad', () => {
    mockLive({ data: [ACTIVA] });
    const { rerender } = renderPage();
    expect(mapStub.fitBounds).toHaveBeenCalledTimes(1);

    mapStub.fitBounds.mockClear();

    // Segundo poll: MISMAS coordenadas, objeto nuevo, antigüedad recalculada.
    mockLive({
      data: [{ ...ACTIVA, minutesSinceLastPoint: 5, lastPointAt: '2026-07-26T12:01:00.000Z' }],
    });
    rerender(pageElement());

    expect(mapStub.fitBounds).not.toHaveBeenCalled();
  });

  it('SÍ reencuadra cuando cambia el conjunto de marcadores', () => {
    mockLive({ data: [ACTIVA] });
    const { rerender } = renderPage();
    mapStub.fitBounds.mockClear();

    mockLive({
      data: [ACTIVA, { ...ACTIVA, login: 'IPNXOTRO', name: 'Otro', latitude: -34.9, longitude: -58.9 }],
    });
    rerender(pageElement());

    expect(mapStub.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('SÍ reencuadra cuando una cuadrilla se mueve', () => {
    mockLive({ data: [ACTIVA] });
    const { rerender } = renderPage();
    mapStub.fitBounds.mockClear();

    mockLive({ data: [{ ...ACTIVA, latitude: -34.9, longitude: -58.9 }] });
    rerender(pageElement());

    expect(mapStub.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('sin cuadrillas activas encuadra las últimas posiciones CONOCIDAS, sin dibujarlas', () => {
    // El centro por defecto es un último recurso arbitrario: plantar el viewport
    // ahí cuando hay posiciones conocidas manda al operador a otra región.
    mockLive({ data: [DESACTUALIZADA, SIN_RASTRO] });
    renderPage();

    expect(mapStub.fitBounds).toHaveBeenCalledTimes(1);
    expect(mapStub.fitBounds.mock.calls[0][0]).toEqual([[-34.7, -58.4]]);
    expect(screen.queryAllByTestId('map-marker')).toHaveLength(0);
  });
});

describe('LM-9: el día vivo no se congela', () => {
  it('recalcula "hoy" pasada la medianoche argentina (la pantalla queda abierta)', () => {
    vi.useFakeTimers();
    // 23:59:30 ART del 26 de julio (ART = UTC-3, sin DST).
    vi.setSystemTime(new Date('2026-07-27T02:59:30.000Z'));

    mockLive({ data: [ACTIVA] });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /ver jornada de denis c\./i }));

    expect((screen.getByLabelText(/día de la jornada/i) as HTMLInputElement).max).toBe(
      '2026-07-26',
    );

    act(() => {
      vi.setSystemTime(new Date('2026-07-27T03:00:30.000Z'));
      vi.advanceTimersByTime(61_000);
    });

    expect((screen.getByLabelText(/día de la jornada/i) as HTMLInputElement).max).toBe(
      '2026-07-27',
    );
  });
});

describe('LM-10: el panel de jornada nunca deja un hueco', () => {
  it('un día fuera de alcance explica el motivo en vez de quedar en blanco', () => {
    mockPerms(['technicians.location_read']);
    mockLive({ data: [ACTIVA] });
    mockJourney(); // enabled:false → isLoading:false, isError:false, data:undefined
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /ver jornada de denis c\./i }));
    // `min` sólo limita el calendario; tipear o pegar una fecha vieja dispara igual.
    fireEvent.change(screen.getByLabelText(/día de la jornada/i), {
      target: { value: '2020-01-01' },
    });

    expect(screen.getByTestId('journey-unavailable').textContent ?? '').toMatch(
      /permiso de auditoría/i,
    );
  });

  it('un 403 se presenta como límite de permiso, no como falla técnica', () => {
    mockPerms(['technicians.location_read']);
    mockLive({ data: [ACTIVA] });
    mockJourney({
      isError: true,
      error: { isAxiosError: true, response: { status: 403 } },
    } as unknown as Partial<JourneyResult>);
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /ver jornada de denis c\./i }));

    expect(screen.getByTestId('journey-forbidden')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reintentar/i })).not.toBeInTheDocument();
  });
});

describe('LM-11: el link a Maps dice de QUÉ posición habla', () => {
  it('en una cuadrilla activa es la posición actual', () => {
    mockLive({ data: [ACTIVA] });
    renderPage();
    const list = screen.getByTestId('active-list');
    expect(within(list).getByRole('link', { name: /abrir en maps/i })).toBeInTheDocument();
  });

  it('en una DESACTUALIZADA califica que es la ÚLTIMA POSICIÓN CONOCIDA', () => {
    mockLive({ data: [DESACTUALIZADA] });
    renderPage();
    const list = screen.getByTestId('stale-list');
    const link = within(list).getByRole('link');
    expect(link).toHaveAccessibleName(/última posición conocida/i);
    expect(link.textContent ?? '').not.toMatch(/^abrir en maps$/i);
  });
});
