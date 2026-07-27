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
    journey: JOURNEY,
    isLoading: false,
    isError: false,
    isForbidden: false,
    onRetry: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
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
    const branches = [
      'journey-skeleton',
      'journey-unavailable',
      'journey-empty',
      'journey-first',
    ] as const;

    const cases: Array<Partial<PanelProps>> = [
      { isLoading: true, journey: undefined },
      { journey: undefined, requiresAudit: true },
      { journey: { ...JOURNEY, pointCount: 0 } },
      {},
    ];

    for (const over of cases) {
      const { unmount } = renderPanel(over);
      const alive = branches.filter((id) => screen.queryByTestId(id) !== null);
      expect(alive).toHaveLength(1);
      unmount();
    }
  });

  it('al abrirse mueve el foco al encabezado del panel', () => {
    renderPanel();
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2 }));
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
