import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssistantDataSourcesCard } from '@/components/settings/AssistantDataSourcesCard';

const useCatalogs = vi.fn();
const setMutate = vi.fn();
const setState = vi.fn();
const mockCan = vi.fn();

vi.mock('@/hooks/useAssistant', () => ({
  useAssistantCatalogs: () => useCatalogs(),
  useSetAssistantDataSource: () => setState(),
}));

vi.mock('@/hooks/useMyPermissions', () => ({
  useCan: (perm: string) => mockCan(perm),
}));

/**
 * D2 — prender/apagar una fuente de datos.
 *
 * `noc.cortes` nace apagada (el hub NOC está en modo oscuro) y el seed prometía "se prende con
 * un tilde cuando el hub salga". Ese tilde no existía: `setDataSourceEnabled` estaba
 * implementado en los dos adapters y nadie lo llamaba.
 */

const SOURCES = [
  { key: 'cliente.saldo', label: 'Saldo y vencimiento', enabled: true },
  { key: 'cliente.servicio', label: 'Estado del servicio y plan', enabled: true },
  { key: 'noc.cortes', label: 'Cortes activos en la zona', enabled: false },
];

beforeEach(() => {
  useCatalogs.mockReset();
  setMutate.mockReset();
  mockCan.mockReturnValue(true);
  setState.mockReturnValue({ mutate: setMutate, isPending: false, isError: false });
  useCatalogs.mockReturnValue({
    data: { dataSources: SOURCES, actions: [] },
    isLoading: false,
    isError: false,
  });
});

describe('AssistantDataSourcesCard — el tilde que faltaba', () => {
  it('prender una fuente apagada la manda con enabled true', async () => {
    render(<AssistantDataSourcesCard />);

    fireEvent.click(screen.getByRole('checkbox', { name: /cortes activos/i }));

    await waitFor(() =>
      expect(setMutate).toHaveBeenCalledWith({ key: 'noc.cortes', enabled: true }),
    );
  });

  it('apagar una prendida es reversible', async () => {
    render(<AssistantDataSourcesCard />);

    fireEvent.click(screen.getByRole('checkbox', { name: /saldo y vencimiento/i }));

    await waitFor(() =>
      expect(setMutate).toHaveBeenCalledWith({ key: 'cliente.saldo', enabled: false }),
    );
  });

  it('el estado del tilde refleja lo que dice el catálogo', () => {
    render(<AssistantDataSourcesCard />);

    expect(screen.getByRole('checkbox', { name: /saldo y vencimiento/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /cortes activos/i })).not.toBeChecked();
  });
});

describe('AssistantDataSourcesCard — qué significa apagar', () => {
  it('explica que una fuente apagada NO se consulta, en vez de sólo mostrar un switch', () => {
    render(<AssistantDataSourcesCard />);

    expect(screen.getByText(/no se consulta|deja de/i)).toBeInTheDocument();
  });

  it('NO ofrece crear fuentes nuevas — se registran en código (frontera R5)', () => {
    render(<AssistantDataSourcesCard />);

    expect(screen.queryByRole('button', { name: /agregar|nueva fuente|crear/i })).not.toBeInTheDocument();
  });
});

describe('AssistantDataSourcesCard — permisos y errores', () => {
  it('sin assistant.manage se ve el estado pero no se puede togglear', () => {
    mockCan.mockReturnValue(false);
    render(<AssistantDataSourcesCard />);

    expect(screen.getByRole('checkbox', { name: /cortes activos/i })).toBeDisabled();
  });

  it('un fallo al togglear se avisa', () => {
    setState.mockReturnValue({ mutate: setMutate, isPending: false, isError: true });
    render(<AssistantDataSourcesCard />);

    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo/i);
  });

  it('si no se pudo leer el catálogo NO muestra tildes apagados — sería adivinar', () => {
    // Mostrar todo en "off" cuando no se sabe haría creer que el asistente no ve ningún dato.
    useCatalogs.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<AssistantDataSourcesCard />);

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getByText(/no se pudo/i)).toBeInTheDocument();
  });
});
