import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssistantEvalCard } from '@/components/settings/AssistantEvalCard';

const useEvals = vi.fn();
const recordMutateAsync = vi.fn();
const recordState = vi.fn();
const mockCan = vi.fn();

vi.mock('@/hooks/useAssistant', () => ({
  useAssistantEvals: () => useEvals(),
  useRecordAssistantEval: () => recordState(),
}));

vi.mock('@/hooks/useMyPermissions', () => ({
  useCan: (perm: string) => mockCan(perm),
}));

/**
 * EVAL-1/EVAL-2 — el candado de `resolve_conversation`.
 *
 * Lo que se prueba acá NO es que el formulario mande datos: es que **no se pueda destrabar la
 * acción de riesgo con un número vacío**. Un eval que sólo mide resolución premia justo al
 * modelo peligroso — el que contesta siempre, incluso cuando no sabe.
 */

const RUN = {
  id: 'r1',
  model: 'deepseek-chat',
  resolutionAccuracy: 0.85,
  abstentionRate: 0.9,
  resolutionTotal: 80,
  abstentionTotal: 20,
  notes: 'muestra de julio',
  createdAt: '2026-07-27T10:00:00.000Z',
};

const fill = (values: Record<string, string>) => {
  for (const [label, value] of Object.entries(values)) {
    fireEvent.change(screen.getByLabelText(new RegExp(label, 'i')), { target: { value } });
  }
};

beforeEach(() => {
  useEvals.mockReset();
  recordMutateAsync.mockReset();
  mockCan.mockReturnValue(true);
  recordState.mockReturnValue({
    mutateAsync: recordMutateAsync,
    isPending: false,
    isError: false,
    error: null,
  });
  useEvals.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() });
});

describe('AssistantEvalCard — sin corridas, la acción de riesgo está trabada', () => {
  it('dice explícitamente que resolve_conversation no se puede habilitar', () => {
    render(<AssistantEvalCard />);

    expect(screen.getByRole('status')).toHaveTextContent(/no se puede habilitar|bloquead/i);
  });

  it('con una corrida registrada, avisa que quedó destrabada', () => {
    useEvals.mockReturnValue({ data: [RUN], isLoading: false, isError: false, refetch: vi.fn() });
    render(<AssistantEvalCard />);

    expect(screen.getByRole('status')).toHaveTextContent(/habilitar/i);
  });
});

describe('AssistantEvalCard — el formulario exige medir abstención', () => {
  it('con abstención en 0 NO deja registrar', async () => {
    // La regla de fondo. El backend también la impone (422), pero dejar que el operador
    // llegue hasta el submit para recién ahí decirle que no, es hacerle perder el tiempo.
    render(<AssistantEvalCard />);

    fill({
      'casos de resolución': '80',
      'aciertos de resolución': '68',
      'casos de abstención': '0',
      'veces que se calló': '0',
    });
    fireEvent.click(screen.getByRole('button', { name: /registrar/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/abstenci/i));
    expect(recordMutateAsync).not.toHaveBeenCalled();
  });

  it('con las dos particiones cargadas, registra', async () => {
    render(<AssistantEvalCard />);

    fill({
      'casos de resolución': '80',
      'aciertos de resolución': '68',
      'casos de abstención': '20',
      'veces que se calló': '18',
    });
    fireEvent.click(screen.getByRole('button', { name: /registrar/i }));

    await waitFor(() =>
      expect(recordMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          resolutionTotal: 80,
          resolutionCorrect: 68,
          abstentionTotal: 20,
          abstentionCorrect: 18,
        }),
      ),
    );
  });

  it('aciertos mayores que el total NO se mandan', async () => {
    render(<AssistantEvalCard />);

    fill({
      'casos de resolución': '80',
      'aciertos de resolución': '999',
      'casos de abstención': '20',
      'veces que se calló': '18',
    });
    fireEvent.click(screen.getByRole('button', { name: /registrar/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(recordMutateAsync).not.toHaveBeenCalled();
  });
});

describe('AssistantEvalCard — el historial hace auditable el candado', () => {
  it('muestra las dos tasas POR SEPARADO, nunca un promedio', () => {
    // Promediarlas escondería el modo de falla que importa.
    useEvals.mockReturnValue({ data: [RUN], isLoading: false, isError: false, refetch: vi.fn() });
    render(<AssistantEvalCard />);

    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('muestra el tamaño de la muestra: una tasa sin N no se puede leer', () => {
    useEvals.mockReturnValue({ data: [RUN], isLoading: false, isError: false, refetch: vi.fn() });
    render(<AssistantEvalCard />);

    expect(screen.getByText(/80 casos/i)).toBeInTheDocument();
    expect(screen.getByText(/20 casos/i)).toBeInTheDocument();
  });

  it('sin corridas invita a registrar la primera en vez de mostrar una tabla vacía', () => {
    render(<AssistantEvalCard />);

    expect(screen.getByText(/todavía no hay/i)).toBeInTheDocument();
  });
});

describe('AssistantEvalCard — permisos y errores', () => {
  it('sin assistant.manage se ve el historial pero no el formulario', () => {
    useEvals.mockReturnValue({ data: [RUN], isLoading: false, isError: false, refetch: vi.fn() });
    mockCan.mockReturnValue(false);
    render(<AssistantEvalCard />);

    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /registrar/i })).not.toBeInTheDocument();
  });

  it('el rechazo del backend se muestra tal cual', () => {
    recordState.mockReturnValue({
      mutateAsync: recordMutateAsync,
      isPending: false,
      isError: true,
      error: { response: { data: { error: 'la partición de abstención no puede estar vacía' } } },
    });
    render(<AssistantEvalCard />);

    expect(screen.getByText(/partición de abstención/i)).toBeInTheDocument();
  });

  it('si no se puede leer el historial, lo dice y ofrece reintentar', () => {
    useEvals.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });
    render(<AssistantEvalCard />);

    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });
});
