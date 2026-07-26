import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssistantRunsPanel } from '@/components/settings/AssistantRunsPanel';
import type { AssistantRun } from '@/types/assistant';

const useAssistantRuns = vi.fn();

vi.mock('@/hooks/useAssistant', () => ({
  useAssistantRuns: (...args: unknown[]) => useAssistantRuns(...args),
}));

/**
 * ai-assistant-multiagent (OBS-1) — historial de intervenciones.
 *
 * Las 4 ramas de estado son regla innegociable del proyecto: loading, error (con reintento),
 * empty (con explicación) y success. Una pantalla en blanco o un spinner infinito son bugs.
 */

const RUN: AssistantRun = {
  id: 'run-1',
  areaId: 'area-1',
  subjectType: 'conversation',
  subjectId: 'conv-1',
  intentName: 'estado de cuenta',
  dataSources: ['cliente.saldo'],
  actionKey: 'whatsapp_reply',
  outcome: 'replied',
  reason: null,
  latencyMs: 820,
  createdAt: '2026-07-26T12:00:00.000Z',
};

const mockRuns = (overrides: Record<string, unknown>) => {
  useAssistantRuns.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  });
};

describe('AssistantRunsPanel', () => {
  beforeEach(() => {
    useAssistantRuns.mockReset();
  });

  it('rama LOADING', () => {
    mockRuns({ isLoading: true });
    render(<AssistantRunsPanel />);

    expect(screen.getByText(/Cargando intervenciones/)).toBeInTheDocument();
  });

  it('rama ERROR con reintento y role=alert', () => {
    mockRuns({ isError: true });
    render(<AssistantRunsPanel />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reintentar/ })).toBeInTheDocument();
  });

  it('rama EMPTY explica por qué está vacío, no muestra una tabla pelada', () => {
    mockRuns({ data: { items: [], total: 0 } });
    render(<AssistantRunsPanel />);

    expect(screen.getByText(/todavía no intervino/)).toBeInTheDocument();
  });

  it('rama SUCCESS: muestra la intervención con su resultado en TEXTO', () => {
    mockRuns({ data: { items: [RUN], total: 1 } });
    render(<AssistantRunsPanel />);

    expect(screen.getByText('Respondió')).toBeInTheDocument();
    expect(screen.getByText('estado de cuenta')).toBeInTheDocument();
    expect(screen.getByText('820 ms')).toBeInTheDocument();
  });

  it('la métrica clave se lee en castellano, no como código interno', () => {
    // `rejected_numbers` es una alucinación sobre plata que NO llegó al cliente. El operador
    // tiene que poder entenderlo sin saber qué significa la key del backend.
    mockRuns({
      data: {
        items: [{ ...RUN, outcome: 'rejected_numbers', reason: 'number_not_in_facts' }],
        total: 1,
      },
    });
    render(<AssistantRunsPanel />);

    expect(screen.getByText('Descartó cifra sin respaldo')).toBeInTheDocument();
  });

  it('un handoff sin tema matcheado no rompe la tabla', () => {
    mockRuns({
      data: {
        items: [{ ...RUN, outcome: 'handoff', intentName: null, latencyMs: null }],
        total: 1,
      },
    });
    render(<AssistantRunsPanel />);

    expect(screen.getByText('Derivó a humano')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('NO muestra contenido de los mensajes (la auditoría no guarda qué se dijo)', () => {
    mockRuns({ data: { items: [RUN], total: 1 } });
    const { container } = render(<AssistantRunsPanel />);

    // El DTO del backend directamente no trae contenido; esto lo pinea del lado del FE.
    expect(container.textContent).not.toContain('conv-1');
  });

  it('la tabla tiene caption con el total (contexto para lectores de pantalla)', () => {
    mockRuns({ data: { items: [RUN], total: 1 } });
    render(<AssistantRunsPanel />);

    expect(screen.getByText(/1 intervención registrada/)).toBeInTheDocument();
  });
});
