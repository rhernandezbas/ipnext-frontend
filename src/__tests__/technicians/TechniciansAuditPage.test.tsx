/**
 * TechniciansAuditPage — auditoría por OS + candidatos a revisar.
 *
 * Reglas que los tests blindan (spec `iclass-presence-audit`):
 *  · El listado del pre-filtro se rotula "candidatos a revisar", JAMÁS
 *    "incumplimientos". El pre-filtro prioriza qué mirar, no dictamina.
 *  · El umbral que se muestra es el que aplicó el servidor (`meta.thresholdMinutes`),
 *    no el que tipeó el usuario: pedir 30 y ver resultados de 5 sin enterarse hace
 *    concluir "no hay más casos" sobre datos de otro umbral.
 *  · 4 ramas de estado en todo lo que fetchea.
 *  · Selector de umbral con el combobox propio, no un <select> nativo.
 */
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/hooks/useTechnicianLocation', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useTechnicianLocation')>(
    '@/hooks/useTechnicianLocation',
  );
  return {
    ...actual,
    useServiceOrderPresenceAudit: vi.fn(),
    useSuspiciousClosures: vi.fn(),
  };
});

import {
  useServiceOrderPresenceAudit,
  useSuspiciousClosures,
} from '@/hooks/useTechnicianLocation';
import type {
  ServiceOrderPresenceReport,
  SuspiciousClosure,
} from '@/types/technicianLocation';
import TechniciansAuditPage from '@/pages/technicians/TechniciansAuditPage';

type AuditResult = ReturnType<typeof useServiceOrderPresenceAudit>;
type SuspiciousResult = ReturnType<typeof useSuspiciousClosures>;

const REPORT: ServiceOrderPresenceReport = {
  verdict: 'EN_SITIO',
  reason: null,
  minDistanceMeters: 3,
  closestPointAt: '2026-07-26T21:18:00.000Z',
  closestAccuracyMeters: 12.4,
  pointsEvaluated: 16,
  largestCoverageGapMinutes: 7,
  window: { from: '2026-07-26T23:14:02.000Z', to: '2026-07-26T23:46:18.000Z' },
  mapsUrl: 'https://maps.example/os4905',
  onSiteThresholdMeters: 150,
  serviceOrderCode: '4905',
  teamLogin: 'IPNXDENIC',
  teamTechnicianName: 'Denis C.',
  resultCodeName: 'Instalación OK',
  closureCoordinates: null,
};

const CANDIDATE: SuspiciousClosure = {
  serviceOrderCode: '4995',
  iclassId: '99401',
  executionMinutes: 2.27,
  teamLogin: 'IPNXANDYM',
  teamTechnicianName: 'Andy M.',
  resultCodeName: 'Instalación OK',
  soTypeDescription: 'Instalación',
  isCandidateForReview: true,
};

function mockAudit(over: Partial<AuditResult> = {}) {
  vi.mocked(useServiceOrderPresenceAudit).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...over,
  } as unknown as AuditResult);
}

function mockSuspicious(over: Partial<SuspiciousResult> = {}) {
  vi.mocked(useSuspiciousClosures).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...over,
  } as unknown as SuspiciousResult);
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <TechniciansAuditPage />
    </MemoryRouter>,
  );

async function openCandidatesTab() {
  await userEvent.click(screen.getByRole('tab', { name: /candidatos a revisar/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAudit();
  mockSuspicious();
});

describe('AU-1: auditoría por orden de servicio', () => {
  it('arranca con un empty state que explica qué hay que hacer', () => {
    renderPage();
    expect(screen.getByTestId('audit-empty')).toHaveTextContent(/ingresá el código/i);
  });

  it('muestra skeleton mientras carga', () => {
    mockAudit({ isLoading: true });
    renderPage();
    expect(screen.getByTestId('audit-skeleton')).toBeInTheDocument();
  });

  it('anuncia el error con role=alert y permite reintentar', async () => {
    const refetch = vi.fn();
    mockAudit({ isError: true, refetch });
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo auditar/i);
    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('renderiza el veredicto con su evidencia cuando hay datos', () => {
    mockAudit({ data: REPORT });
    renderPage();
    const card = screen.getByTestId('verdict-card');
    expect(card).toHaveAttribute('data-verdict', 'EN_SITIO');
    expect(within(card).getByTestId('evidence-points')).toHaveTextContent('16');
  });

  it('la búsqueda no dispara con el campo vacío', async () => {
    renderPage();
    const submit = screen.getByRole('button', { name: /auditar/i });
    await userEvent.click(submit);
    expect(screen.getByTestId('audit-empty')).toBeInTheDocument();
  });
});

describe('AU-2: el listado es de CANDIDATOS, no de incumplimientos', () => {
  beforeEach(() => {
    mockSuspicious({ data: { candidates: [CANDIDATE], thresholdMinutes: 5 } });
  });

  it('el tab y el encabezado dicen "candidatos a revisar"', async () => {
    renderPage();
    await openCandidatesTab();
    expect(screen.getByRole('heading', { name: /candidatos a revisar/i })).toBeInTheDocument();
  });

  it('no usa vocabulario de imputación en ninguna parte del panel', async () => {
    renderPage();
    await openCandidatesTab();
    const panel = screen.getByTestId('candidates-panel');
    expect(panel.textContent ?? '').not.toMatch(
      /incumpl|infracci|sanci|culpab|fraude|mintió|mentira/i,
    );
  });

  it('aclara que el pre-filtro no es un veredicto', async () => {
    renderPage();
    await openCandidatesTab();
    expect(screen.getByTestId('candidates-panel').textContent ?? '').toMatch(
      /no es un veredicto/i,
    );
  });

  it('lista la orden con su duración de ejecución', async () => {
    renderPage();
    await openCandidatesTab();
    const panel = screen.getByTestId('candidates-panel');
    expect(within(panel).getByText('4995')).toBeInTheDocument();
    expect(panel).toHaveTextContent(/2m\s?16s|2,3 min/i);
  });
});

describe('AU-3: el umbral que se muestra es el del servidor', () => {
  it('refleja meta.thresholdMinutes aunque el usuario haya pedido otro', async () => {
    mockSuspicious({ data: { candidates: [CANDIDATE], thresholdMinutes: 5 } });
    renderPage();
    await openCandidatesTab();

    await userEvent.click(screen.getByRole('combobox', { name: /umbral/i }));
    await userEvent.click(screen.getByRole('option', { name: /30 minutos/i }));

    expect(screen.getByTestId('applied-threshold')).toHaveTextContent(/5 min/);
  });

  it('usa el combobox propio, no un <select> nativo', async () => {
    mockSuspicious({ data: { candidates: [], thresholdMinutes: 5 } });
    const { container } = renderPage();
    await openCandidatesTab();
    expect(container.querySelector('select')).toBeNull();
    expect(screen.getByRole('combobox', { name: /umbral/i })).toBeInTheDocument();
  });
});

describe('AU-4: las 4 ramas del listado', () => {
  it('loading → skeleton', async () => {
    mockSuspicious({ isLoading: true });
    renderPage();
    await openCandidatesTab();
    expect(screen.getByTestId('candidates-skeleton')).toBeInTheDocument();
  });

  it('empty → explicación, no vacío pelado', async () => {
    mockSuspicious({ data: { candidates: [], thresholdMinutes: 5 } });
    renderPage();
    await openCandidatesTab();
    expect(screen.getByTestId('candidates-empty')).toHaveTextContent(/ninguna orden/i);
  });

  it('error → role=alert + reintentar', async () => {
    const refetch = vi.fn();
    mockSuspicious({ isError: true, refetch });
    renderPage();
    await openCandidatesTab();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/no se pudo/i);
    await userEvent.click(within(alert).getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalled();
  });
});

/**
 * AU-6 — el "por qué puede ser legítimo" tiene que estar DONDE ESTÁ LA TABLA.
 *
 * El BE lo documenta: una ejecución corta puede tener explicación legítima (la
 * cuadrilla ya estaba en el lugar por otra orden, el cliente canceló en la
 * puerta). Si eso vive sólo en el intro, se pierde apenas alguien scrollea o
 * recorta la pantalla para mandarla por WhatsApp — y queda una lista de nombres
 * y apellidos ordenada de "más sospechoso" a "menos".
 */
describe('AU-6: la salvedad viaja pegada a la tabla', () => {
  beforeEach(() => {
    mockSuspicious({ data: { candidates: [CANDIDATE], thresholdMinutes: 5 } });
  });

  it('nombra explicaciones legítimas concretas, no una advertencia genérica', async () => {
    renderPage();
    await openCandidatesTab();
    const caveat = screen.getByTestId('candidates-caveat');
    expect(caveat.textContent ?? '').toMatch(/ya estaba en el lugar/i);
    expect(caveat.textContent ?? '').toMatch(/canceló en la puerta/i);
  });

  it('la salvedad y la tabla comparten contenedor: recortar la tabla no la pierde', async () => {
    renderPage();
    await openCandidatesTab();
    const block = screen.getByTestId('candidates-table-block');
    expect(within(block).getByTestId('candidates-caveat')).toBeInTheDocument();
    expect(within(block).getByRole('table')).toBeInTheDocument();
    // Y va ANTES de la tabla: se lee primero, no como nota al pie.
    const caveat = within(block).getByTestId('candidates-caveat');
    const table = within(block).getByRole('table');
    expect(caveat.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('AU-7: reauditar el mismo código vuelve a consultar', () => {
  it('resubmitir el código ya cargado dispara un refetch, no un no-op', async () => {
    const refetch = vi.fn();
    mockAudit({ data: REPORT, refetch });
    renderPage();

    const input = screen.getByLabelText(/código de la orden/i);
    await userEvent.type(input, '4905');
    await userEvent.click(screen.getByRole('button', { name: /auditar orden/i }));
    expect(refetch).not.toHaveBeenCalled();

    // Mismo código otra vez: sin esto la pantalla se queda muda para siempre.
    await userEvent.click(screen.getByRole('button', { name: /auditar orden/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('AU-8: la jerarquía de encabezados no salta niveles', () => {
  it('el panel de auditoría por orden tiene su h2 entre el h1 y el h3 del veredicto', () => {
    mockAudit({ data: REPORT });
    renderPage();

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
  });
});

describe('AU-5: cota de rango del barrido', () => {
  it('rechaza un rango mayor a 30 días antes de pegarle al backend', async () => {
    mockSuspicious({ data: { candidates: [], thresholdMinutes: 5 } });
    renderPage();
    await openCandidatesTab();

    // fireEvent.change y no userEvent.type: un <input type="date"> tipeado
    // carácter por carácter pasa por valores inválidos intermedios.
    fireEvent.change(screen.getByLabelText(/desde/i), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText(/hasta/i), { target: { value: '2026-07-26' } });

    expect(screen.getByTestId('range-error')).toHaveTextContent(/30 días/i);
  });
});
