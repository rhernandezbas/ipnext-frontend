/**
 * SuricataAiAnalysisTab (Fase H, task H.3, spec `suricata-tickets-ui` UI-4).
 *
 *  AIA-1 empty     → explicit "no verdict" state, never an error/blank crash
 *  AIA-2 resolved  → resuelto:true shows the pill + análisis, NEVER motivo/respuestaSugerida blocks
 *  AIA-3 failed    → resuelto:false shows all 4 fields (pill, análisis, motivo, respuestaSugerida)
 *  AIA-4 history   → the FULL verdict history renders (not just the latest), most recent first
 *  AIA-5 stale     → a stale verdict is flagged, never silently mixed with a current one
 */
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SuricataAiAnalysisTab } from '@/pages/suricata/SuricataTicketDetail/SuricataAiAnalysisTab';
import type { SuricataVerdictDto } from '@/pages/suricata/api/suricataClient';

function makeVerdict(overrides: Partial<SuricataVerdictDto> = {}): SuricataVerdictDto {
  return {
    id: 'v-1',
    resuelto: false,
    analisis: 'Corte físico confirmado en la ONU.',
    motivo: 'El bot no puede crear la tarea de visita técnica.',
    respuestaSugerida: 'Ya generamos una orden para que un técnico lo revise.',
    createdAt: '2026-09-12T08:00:00.000Z',
    stale: false,
    ...overrides,
  };
}

describe('AIA-1 empty', () => {
  it('shows an explicit empty state, not an error, with zero verdicts', () => {
    render(<SuricataAiAnalysisTab verdicts={[]} />);
    expect(screen.getByText(/no recibió un veredicto/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('AIA-2 resolved', () => {
  it('shows the "Resuelto solo" pill and análisis, but no motivo/respuestaSugerida blocks', () => {
    render(
      <SuricataAiAnalysisTab
        verdicts={[makeVerdict({ resuelto: true, motivo: null, respuestaSugerida: null, analisis: 'Reinicio remoto resolvió el corte.' })]}
      />,
    );
    expect(screen.getByText(/resuelto solo/i)).toBeInTheDocument();
    expect(screen.getByText('Reinicio remoto resolvió el corte.')).toBeInTheDocument();
    expect(screen.queryByText(/motivo por el que no resolvió/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/qué deberíamos haber contestado/i)).not.toBeInTheDocument();
  });
});

describe('AIA-3 failed', () => {
  it('shows all four fields when resuelto is false', () => {
    render(<SuricataAiAnalysisTab verdicts={[makeVerdict()]} />);
    expect(screen.getByText(/no pudo resolver/i)).toBeInTheDocument();
    expect(screen.getByText('Corte físico confirmado en la ONU.')).toBeInTheDocument();
    expect(screen.getByText(/motivo por el que no resolvió/i)).toBeInTheDocument();
    expect(screen.getByText('El bot no puede crear la tarea de visita técnica.')).toBeInTheDocument();
    expect(screen.getByText(/qué deberíamos haber contestado/i)).toBeInTheDocument();
    expect(screen.getByText('Ya generamos una orden para que un técnico lo revise.')).toBeInTheDocument();
  });
});

describe('AIA-4 history', () => {
  it('renders the FULL verdict history, most recent (verdicts[0]) marked current', () => {
    render(
      <SuricataAiAnalysisTab
        verdicts={[
          makeVerdict({ id: 'v-new', analisis: 'Segundo análisis, más reciente', createdAt: '2026-09-12T10:00:00.000Z' }),
          makeVerdict({ id: 'v-old', analisis: 'Primer análisis, más viejo', createdAt: '2026-09-12T08:00:00.000Z' }),
        ]}
      />,
    );
    const list = screen.getByRole('list', { name: /historial de veredictos/i });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('Segundo análisis, más reciente')).toBeInTheDocument();
    expect(within(items[0]).getByText(/vigente/i)).toBeInTheDocument();
    expect(within(items[1]).getByText('Primer análisis, más viejo')).toBeInTheDocument();
    expect(within(items[1]).queryByText(/vigente/i)).not.toBeInTheDocument();
  });
});

describe('AIA-5 stale', () => {
  it('flags a stale verdict distinctly, without hiding it', () => {
    render(<SuricataAiAnalysisTab verdicts={[makeVerdict({ stale: true, resuelto: true, motivo: null, respuestaSugerida: null })]} />);
    expect(screen.getByText(/mensajes nuevos desde este análisis/i)).toBeInTheDocument();
  });
});
