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
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const renderPage = () =>
  render(
    <MemoryRouter>
      <TechniciansLiveMapPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockPerms(['technicians.location_read']);
  mockJourney();
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
    expect(within(list).getByText(/última posición conocida/i)).toBeInTheDocument();
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
