import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssistantRoutingCard } from '@/components/settings/AssistantRoutingCard';

const useRouting = vi.fn();
const updateMutateAsync = vi.fn();
const updateState = vi.fn();
const useProfiles = vi.fn();
const useAreas = vi.fn();
const mockCan = vi.fn();

vi.mock('@/hooks/useAssistant', () => ({
  useAssistantRouting: () => useRouting(),
  useUpdateAssistantRouting: () => updateState(),
  useAssistantProfiles: () => useProfiles(),
}));

vi.mock('@/hooks/useMyPermissions', () => ({
  useCan: (perm: string) => mockCan(perm),
}));

vi.mock('@/hooks/useTicketAreas', () => ({
  useTicketAreas: () => useAreas(),
}));

/**
 * RTR-0 — la perilla que decide si el asistente existe.
 *
 * `Conversation.areaId` entra SIEMPRE en NULL (los agentes trabajan dentro de Chatwoot). Sin
 * área default el motor hace no-op en todas las conversaciones. Lo que se prueba acá es que
 * ese estado se DIGA con todas las letras — un campo vacío se lee como "falta completar", no
 * como "el bot no le responde a nadie".
 */

const AREAS = [
  { id: 'area-soporte', name: 'Soporte', color: '#3b82f6' },
  { id: 'area-ventas', name: 'Ventas', color: '#10b981' },
  { id: 'area-sin-agente', name: 'Administración', color: '#f59e0b' },
];

const PROFILES = [
  { id: 'p1', areaId: 'area-soporte', enabled: true },
  { id: 'p2', areaId: 'area-ventas', enabled: false },
];

const routingOf = (data: unknown, extra = {}) => {
  useRouting.mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...extra,
  });
};

beforeEach(() => {
  useRouting.mockReset();
  updateMutateAsync.mockReset();
  updateState.mockReturnValue({
    mutateAsync: updateMutateAsync,
    isPending: false,
    isError: false,
    error: null,
  });
  useProfiles.mockReturnValue({ data: PROFILES, isLoading: false, isError: false });
  useAreas.mockReturnValue({ data: AREAS, isLoading: false, isError: false });
  mockCan.mockReturnValue(true);
  routingOf({ defaultAreaId: null, rerouteEnabled: false });
});

const openAreaPicker = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('combobox', { name: /área que atiende/i }));

describe('AssistantRoutingCard — el estado inerte se dice, no se insinúa', () => {
  it('sin área default avisa que el asistente NO responde a nadie', () => {
    render(<AssistantRoutingCard />);

    // No alcanza con un selector vacío: hay que nombrar la consecuencia.
    expect(screen.getByRole('alert')).toHaveTextContent(/no (va a responder|responde)/i);
  });

  it('con área default NO muestra la advertencia', () => {
    routingOf({ defaultAreaId: 'area-soporte', rerouteEnabled: false });
    render(<AssistantRoutingCard />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('AssistantRoutingCard — sólo se puede elegir un área que atienda', () => {
  it('ofrece las áreas CON agente', async () => {
    const user = userEvent.setup();
    render(<AssistantRoutingCard />);

    await openAreaPicker(user);

    expect(screen.getByRole('option', { name: 'Soporte' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ventas' })).toBeInTheDocument();
  });

  it('NO ofrece un área sin agente — guardarla dejaría el bot mudo', async () => {
    // El backend la rechaza con 400, pero ofrecerla para después rechazarla es hacerle perder
    // el tiempo al operador. La opción directamente no existe.
    const user = userEvent.setup();
    render(<AssistantRoutingCard />);

    await openAreaPicker(user);

    expect(screen.queryByRole('option', { name: 'Administración' })).not.toBeInTheDocument();
  });

  it('si NINGÚN área tiene agente, lo dice en vez de ofrecer un selector inútil', () => {
    useProfiles.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<AssistantRoutingCard />);

    expect(screen.getByText(/cre(ar|á) un agente/i)).toBeInTheDocument();
  });
});

describe('AssistantRoutingCard — guardar', () => {
  it('manda el área elegida', async () => {
    const user = userEvent.setup();
    render(<AssistantRoutingCard />);

    await openAreaPicker(user);
    await user.click(screen.getByRole('option', { name: 'Soporte' }));
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() =>
      expect(updateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ defaultAreaId: 'area-soporte' }),
      ),
    );
  });

  it('se puede volver a "nadie": apagar el ruteo es reversible', async () => {
    routingOf({ defaultAreaId: 'area-soporte', rerouteEnabled: true });
    const user = userEvent.setup();
    render(<AssistantRoutingCard />);

    await openAreaPicker(user);
    await user.click(screen.getByRole('option', { name: /nadie/i }));
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() =>
      expect(updateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ defaultAreaId: null }),
      ),
    );
  });

  it('manda el re-ruteo junto con el área', async () => {
    const user = userEvent.setup();
    render(<AssistantRoutingCard />);

    await openAreaPicker(user);
    await user.click(screen.getByRole('option', { name: 'Soporte' }));
    await user.click(screen.getByRole('checkbox', { name: /reasign/i }));
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() =>
      expect(updateMutateAsync).toHaveBeenCalledWith({
        defaultAreaId: 'area-soporte',
        rerouteEnabled: true,
      }),
    );
  });
});

describe('AssistantRoutingCard — errores', () => {
  it('el rechazo del backend se muestra tal cual, no como "algo salió mal"', () => {
    updateState.mockReturnValue({
      mutateAsync: updateMutateAsync,
      isPending: false,
      isError: true,
      error: {
        response: {
          data: { error: 'El área "Ventas" no tiene agente configurado', code: 'X' },
        },
      },
    });
    render(<AssistantRoutingCard />);

    expect(screen.getByText(/no tiene agente configurado/i)).toBeInTheDocument();
  });

  it('si no se puede leer el ruteo NO afirma "nadie atiende" — sería adivinar', () => {
    // Mismo criterio que las cards de flags: ante error de lectura, estado desconocido.
    routingOf(undefined, { isError: true });
    render(<AssistantRoutingCard />);

    expect(screen.getByText(/no se pudo leer/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });
});

describe('AssistantRoutingCard — un ruteo "configurado" que igual no contesta', () => {
  it('avisa si el agente del área default está APAGADO', () => {
    // El motor corta en `profile_disabled` exactamente igual que en `no_profile`: silencio
    // total. Un ruteo que apunta a un agente apagado PARECE configurado y no responde nada.
    routingOf({ defaultAreaId: 'area-ventas', rerouteEnabled: false });
    render(<AssistantRoutingCard />);

    expect(screen.getByRole('alert')).toHaveTextContent(/apagado/i);
  });

  it('avisa si el área default se quedó SIN agente (se lo borraron después)', () => {
    // El backend lo aceptó cuando era válido. Que después dejara de serlo no lo detecta nadie.
    routingOf({ defaultAreaId: 'area-sin-agente', rerouteEnabled: false });
    render(<AssistantRoutingCard />);

    expect(screen.getByRole('alert')).toHaveTextContent(/no tiene agente/i);
  });

  it('con agente ENCENDIDO no hay ninguna advertencia', () => {
    routingOf({ defaultAreaId: 'area-soporte', rerouteEnabled: false });
    render(<AssistantRoutingCard />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('AssistantRoutingCard — quien sólo puede LEER igual ve por qué el bot calla', () => {
  it('sin assistant.manage muestra el diagnóstico pero no deja guardar', () => {
    // El backend expone el ruteo con permiso de LECTURA a propósito. Esconderle el diagnóstico
    // a un supervisor sería tapar justamente el dato que este cambio existe para mostrar.
    mockCan.mockReturnValue(false);
    render(<AssistantRoutingCard />);

    expect(screen.getByRole('alert')).toHaveTextContent(/no va a responder/i);
    expect(screen.queryByRole('button', { name: /guardar/i })).not.toBeInTheDocument();
  });

  it('con assistant.manage sí puede guardar', () => {
    mockCan.mockReturnValue(true);
    render(<AssistantRoutingCard />);

    expect(screen.getByRole('button', { name: /guardar/i })).toBeInTheDocument();
  });
});
