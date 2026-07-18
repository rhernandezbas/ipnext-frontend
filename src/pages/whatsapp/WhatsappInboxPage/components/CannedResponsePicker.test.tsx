/**
 * CannedResponsePicker (Ola 4 — respuestas rápidas / macros) — popover con la
 * lista de respuestas rápidas, filtrable, que inserta el `content` elegido en
 * el composer. Patrón combobox+listbox accesible (WAI-ARIA APG):
 * `<input role="combobox">` (foco al abrir) + `<ul role="listbox">`.
 *
 *  CRP-1 loading → estado de carga
 *  CRP-2 error → role=alert + "Reintentar" (refetch)
 *  CRP-3 empty (catálogo vacío) → aviso "todavía no hay respuestas rápidas"
 *  CRP-4 success → lista shortcut + preview del content
 *  CRP-5 filtro client-side por shortcut o content; sin match → aviso
 *  CRP-6 elegir (click) → onSelect(content)
 *  CRP-7 teclado ↓ + Enter → onSelect del activo; Esc → onClose
 *  CRP-8 a11y: combobox con nombre, listbox, options
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/hooks/useCannedResponses');

import * as useCannedResponsesModule from '@/hooks/useCannedResponses';
import { CannedResponsePicker } from './CannedResponsePicker';
import type { CannedResponse } from '@/types/cannedResponses';

const SALUDO: CannedResponse = {
  id: 'cr-1',
  shortcut: 'saludo',
  content: 'Hola, ¿en qué te puedo ayudar?',
  createdById: 'u1',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};
const DESPEDIDA: CannedResponse = {
  ...SALUDO,
  id: 'cr-2',
  shortcut: 'despedida',
  content: 'Gracias por comunicarte. ¡Que tengas buen día!',
};

type ListReturn = ReturnType<typeof useCannedResponsesModule.useCannedResponses>;

function setList(overrides: Partial<{ data: CannedResponse[]; isLoading: boolean; isError: boolean; refetch: () => void }> = {}) {
  vi.mocked(useCannedResponsesModule.useCannedResponses).mockReturnValue({
    data: overrides.data ?? [],
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    isSuccess: !overrides.isLoading && !overrides.isError,
    refetch: overrides.refetch ?? vi.fn(),
  } as unknown as ListReturn);
}

beforeEach(() => {
  vi.clearAllMocks();
  setList({ data: [SALUDO, DESPEDIDA] });
});

describe('CannedResponsePicker — CRP-1 loading', () => {
  it('muestra un estado de carga mientras pide el catálogo', () => {
    setList({ isLoading: true });
    render(<CannedResponsePicker onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });
});

describe('CannedResponsePicker — CRP-2 error', () => {
  it('muestra role=alert y un botón Reintentar que refetchea', async () => {
    const refetch = vi.fn();
    setList({ isError: true, refetch });
    render(<CannedResponsePicker onSelect={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudieron cargar/i);
    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalled();
  });
});

describe('CannedResponsePicker — CRP-3 empty', () => {
  it('con catálogo vacío avisa que no hay respuestas rápidas', () => {
    setList({ data: [] });
    render(<CannedResponsePicker onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/todav[ií]a no hay respuestas r[aá]pidas/i)).toBeInTheDocument();
  });
});

describe('CannedResponsePicker — CRP-4 success', () => {
  it('lista shortcut + preview del content de cada respuesta', () => {
    render(<CannedResponsePicker onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('saludo')).toBeInTheDocument();
    expect(screen.getByText('despedida')).toBeInTheDocument();
    expect(screen.getByText(/en qué te puedo ayudar/i)).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });
});

describe('CannedResponsePicker — CRP-5 filtro', () => {
  it('filtra por shortcut', async () => {
    render(<CannedResponsePicker onSelect={vi.fn()} onClose={vi.fn()} />);
    await userEvent.type(screen.getByRole('combobox'), 'desp');
    expect(screen.getByText('despedida')).toBeInTheDocument();
    expect(screen.queryByText('saludo')).toBeNull();
  });

  it('filtra por content (no solo por shortcut)', async () => {
    render(<CannedResponsePicker onSelect={vi.fn()} onClose={vi.fn()} />);
    await userEvent.type(screen.getByRole('combobox'), 'buen día');
    expect(screen.getByText('despedida')).toBeInTheDocument();
    expect(screen.queryByText('saludo')).toBeNull();
  });

  it('sin coincidencias muestra un aviso', async () => {
    render(<CannedResponsePicker onSelect={vi.fn()} onClose={vi.fn()} />);
    await userEvent.type(screen.getByRole('combobox'), 'zzzzz');
    expect(screen.getByText(/sin coincidencias/i)).toBeInTheDocument();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });
});

describe('CannedResponsePicker — CRP-6 elegir (click)', () => {
  it('clickear una opción llama onSelect con el content', async () => {
    const onSelect = vi.fn();
    render(<CannedResponsePicker onSelect={onSelect} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('option', { name: /saludo/i }));
    expect(onSelect).toHaveBeenCalledWith(SALUDO.content);
  });
});

describe('CannedResponsePicker — CRP-7 teclado', () => {
  it('Enter elige la opción resaltada por defecto (la primera — estilo Chatwoot)', async () => {
    const onSelect = vi.fn();
    render(<CannedResponsePicker onSelect={onSelect} onClose={vi.fn()} />);
    await userEvent.type(screen.getByRole('combobox'), '{Enter}');
    expect(onSelect).toHaveBeenCalledWith(SALUDO.content);
  });

  it('ArrowDown mueve el resaltado y Enter elige esa opción', async () => {
    const onSelect = vi.fn();
    render(<CannedResponsePicker onSelect={onSelect} onClose={vi.fn()} />);
    await userEvent.type(screen.getByRole('combobox'), '{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith(DESPEDIDA.content);
  });

  it('Esc cierra el popover (onClose)', async () => {
    const onClose = vi.fn();
    render(<CannedResponsePicker onSelect={vi.fn()} onClose={onClose} />);
    await userEvent.type(screen.getByRole('combobox'), '{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('CannedResponsePicker — CRP-8 a11y', () => {
  it('el combobox tiene nombre accesible y controla el listbox', () => {
    render(<CannedResponsePicker onSelect={vi.fn()} onClose={vi.fn()} />);
    const combobox = screen.getByRole('combobox', { name: /buscar respuesta r[aá]pida/i });
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('el combobox recibe el foco al abrir', () => {
    render(<CannedResponsePicker onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('combobox')).toHaveFocus();
  });
});
