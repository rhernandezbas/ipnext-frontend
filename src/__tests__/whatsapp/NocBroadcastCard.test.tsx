/**
 * NocBroadcastCard tests — N1-FE: tarjeta de configuración de Difusión NOC
 * (Evolution API en el Pi). Config editable desde UI, guardada en DB.
 *
 * Contrato BE — /api/messaging/noc-broadcast:
 *   GET  /config → { enabled, evolutionBaseUrl, evolutionInstance, targetChat,
 *                    appPublicUrl, hasApiKey, apiKeyLast4, configured } — la
 *                    apiKey NUNCA viene completa.
 *   PUT  /config → mismo DTO enmascarado. evolutionApiKey vacío/ausente PRESERVA
 *                  la key guardada.
 *   POST /test   → { ok:true }. 503 NOC_BROADCAST_NOT_CONFIGURED · 502 EVOLUTION_API_ERROR.
 *
 * Covers:
 *  1. Loading state (fetch config)
 *  2. Fetch error → banner + Reintentar → refetch (nunca un form con datos falsos)
 *  3. GET puebla el form (URLs/instancia/canal) + apiKey enmascarada (last4, input vacío, type=password)
 *  4. Indicador `configured` (listo para usar / falta configurar)
 *  5. Guardar manda SOLO lo cambiado; apiKey NO se manda si no se toca (preserva)
 *  6. Guardar manda evolutionApiKey SOLO si el usuario escribe la key
 *  7. URL inválida → error legible, NO se llama a mutate
 *  8. Botón "Probar conexión" → POST /test + toast de éxito
 *  9. Botón "Probar conexión" deshabilitado si !configured
 * 10. Errores del test legibles (503 / 502)
 * 11. Error de guardado 400 → mensaje legible
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useNocBroadcast', () => ({
  useNocBroadcastConfig: vi.fn(),
  useUpdateNocBroadcastConfig: vi.fn(),
  useTestNocBroadcast: vi.fn(),
}));

import {
  useNocBroadcastConfig,
  useUpdateNocBroadcastConfig,
  useTestNocBroadcast,
} from '@/hooks/useNocBroadcast';
import type { NocBroadcastConfigDTO } from '@/types/nocBroadcast';
import { NocBroadcastCard } from '@/components/settings/NocBroadcastCard';

const LABELS = {
  base: 'URL de Evolution (Pi)',
  instance: 'Instancia de Evolution',
  chat: 'Canal destino (JID)',
  app: 'URL pública de la app',
  apiKey: 'API key de Evolution',
  enabled: 'Habilitar difusión NOC',
} as const;

function baseConfig(over: Partial<NocBroadcastConfigDTO> = {}): NocBroadcastConfigDTO {
  return {
    enabled: true,
    evolutionBaseUrl: 'http://192.168.1.50:8080',
    evolutionInstance: 'ronald noc',
    targetChat: '12036@g.us',
    appPublicUrl: 'http://190.7.234.37:7778',
    hasApiKey: true,
    apiKeyLast4: 'cd12',
    configured: true,
    ...over,
  };
}

function setup({
  config = baseConfig(),
  configLoading = false,
  configError = false,
  updatePending = false,
  updateSuccess = false,
  updateError = null as unknown,
  testPending = false,
  testSuccess = false,
  testError = null as unknown,
}: {
  config?: NocBroadcastConfigDTO;
  configLoading?: boolean;
  configError?: boolean;
  updatePending?: boolean;
  updateSuccess?: boolean;
  updateError?: unknown;
  testPending?: boolean;
  testSuccess?: boolean;
  testError?: unknown;
} = {}) {
  const updateMutate = vi.fn();
  const testMutate = vi.fn();
  const refetch = vi.fn();
  const updateReset = vi.fn();
  const testReset = vi.fn();

  vi.mocked(useNocBroadcastConfig).mockReturnValue({
    data: configLoading || configError ? undefined : config,
    isLoading: configLoading,
    isError: configError,
    refetch,
  } as unknown as ReturnType<typeof useNocBroadcastConfig>);

  vi.mocked(useUpdateNocBroadcastConfig).mockReturnValue({
    mutate: updateMutate,
    isPending: updatePending,
    isSuccess: updateSuccess,
    isError: updateError != null,
    error: updateError,
    reset: updateReset,
  } as unknown as ReturnType<typeof useUpdateNocBroadcastConfig>);

  vi.mocked(useTestNocBroadcast).mockReturnValue({
    mutate: testMutate,
    isPending: testPending,
    isSuccess: testSuccess,
    isError: testError != null,
    error: testError,
    reset: testReset,
  } as unknown as ReturnType<typeof useTestNocBroadcast>);

  return { updateMutate, testMutate, refetch, updateReset };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NocBroadcastCard — fetch states', () => {
  it('renders a loading state while the config loads', () => {
    setup({ configLoading: true });
    render(<NocBroadcastCard />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(LABELS.base)).not.toBeInTheDocument();
  });

  it('fetch error shows a banner + Reintentar (never a form with fake data)', () => {
    const { refetch } = setup({ configError: true });
    render(<NocBroadcastCard />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByLabelText(LABELS.base)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('NocBroadcastCard — GET populates the form', () => {
  it('fills the URL/instance/chat inputs from the DTO', () => {
    setup();
    render(<NocBroadcastCard />);

    expect((screen.getByLabelText(LABELS.base) as HTMLInputElement).value).toBe('http://192.168.1.50:8080');
    expect((screen.getByLabelText(LABELS.instance) as HTMLInputElement).value).toBe('ronald noc');
    expect((screen.getByLabelText(LABELS.chat) as HTMLInputElement).value).toBe('12036@g.us');
    expect((screen.getByLabelText(LABELS.app) as HTMLInputElement).value).toBe('http://190.7.234.37:7778');
    expect((screen.getByLabelText(LABELS.enabled) as HTMLInputElement).checked).toBe(true);
  });

  it('renders the apiKey masked (last4 + type=password + empty value), never the real key', () => {
    setup({ config: baseConfig({ hasApiKey: true, apiKeyLast4: 'cd12' }) });
    render(<NocBroadcastCard />);

    const apiKeyInput = screen.getByLabelText(LABELS.apiKey) as HTMLInputElement;
    expect(apiKeyInput).toHaveAttribute('type', 'password');
    expect(apiKeyInput.value).toBe('');
    // The masked last4 is surfaced somewhere (hint/placeholder), never the full key.
    expect(screen.getByText(/cd12/)).toBeInTheDocument();
    expect(screen.getByText(/conservar la actual/i)).toBeInTheDocument();
  });

  it('when there is no stored key, does not claim a masked value', () => {
    setup({ config: baseConfig({ hasApiKey: false, apiKeyLast4: null, configured: false }) });
    render(<NocBroadcastCard />);
    expect(screen.queryByText(/••••/)).not.toBeInTheDocument();
  });

  it('Guardar is disabled until the form is dirty', () => {
    setup();
    render(<NocBroadcastCard />);
    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
  });
});

describe('NocBroadcastCard — configured indicator', () => {
  it('configured:true shows a "listo para usar" indicator', () => {
    setup({ config: baseConfig({ configured: true }) });
    render(<NocBroadcastCard />);
    expect(screen.getByText(/listo para usar/i)).toBeInTheDocument();
  });

  it('configured:false shows a "falta configurar" indicator', () => {
    setup({ config: baseConfig({ configured: false }) });
    render(<NocBroadcastCard />);
    expect(screen.getByText(/falta configurar/i)).toBeInTheDocument();
  });
});

describe('NocBroadcastCard — save (only changed fields, apiKey preserved)', () => {
  it('changing one field saves ONLY that field and does NOT send evolutionApiKey', async () => {
    const user = userEvent.setup();
    const { updateMutate } = setup();
    render(<NocBroadcastCard />);

    const chat = screen.getByLabelText(LABELS.chat);
    await user.clear(chat);
    await user.type(chat, 'newchat@g.us');

    const save = screen.getByRole('button', { name: /guardar/i });
    expect(save).toBeEnabled();
    await user.click(save);

    expect(updateMutate).toHaveBeenCalledTimes(1);
    const payload = updateMutate.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload).toEqual({ targetChat: 'newchat@g.us' });
    expect(payload).not.toHaveProperty('evolutionApiKey');
  });

  it('typing a new apiKey sends evolutionApiKey (and only that when nothing else changed)', async () => {
    const user = userEvent.setup();
    const { updateMutate } = setup();
    render(<NocBroadcastCard />);

    await user.type(screen.getByLabelText(LABELS.apiKey), 'brand-new-key');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(updateMutate).toHaveBeenCalledTimes(1);
    expect(updateMutate.mock.calls[0]![0]).toEqual({ evolutionApiKey: 'brand-new-key' });
  });

  it('toggling enabled saves { enabled }', async () => {
    const user = userEvent.setup();
    const { updateMutate } = setup({ config: baseConfig({ enabled: true }) });
    render(<NocBroadcastCard />);

    await user.click(screen.getByLabelText(LABELS.enabled));
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(updateMutate).toHaveBeenCalledWith({ enabled: false });
  });
});

describe('NocBroadcastCard — URL validation', () => {
  it('an invalid evolutionBaseUrl blocks the save and shows a readable error', async () => {
    const user = userEvent.setup();
    const { updateMutate } = setup();
    render(<NocBroadcastCard />);

    const base = screen.getByLabelText(LABELS.base);
    await user.clear(base);
    await user.type(base, 'not-a-url');

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(updateMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/debe empezar con http/i)).toBeInTheDocument();
  });

  it('a non-http scheme (ftp://) is rejected too', async () => {
    const user = userEvent.setup();
    const { updateMutate } = setup();
    render(<NocBroadcastCard />);

    const app = screen.getByLabelText(LABELS.app);
    await user.clear(app);
    await user.type(app, 'ftp://example.com');

    await user.click(screen.getByRole('button', { name: /guardar/i }));
    expect(updateMutate).not.toHaveBeenCalled();
  });
});

describe('NocBroadcastCard — save feedback', () => {
  it('400 error shows a readable validation message', () => {
    setup({ updateError: { response: { status: 400, data: { code: 'VALIDATION_ERROR' } } } });
    render(<NocBroadcastCard />);
    expect(screen.getByText(/datos inválidos|revisá las url/i)).toBeInTheDocument();
  });

  it('success shows a saved confirmation', () => {
    setup({ updateSuccess: true });
    render(<NocBroadcastCard />);
    expect(screen.getByText(/configuración guardada/i)).toBeInTheDocument();
  });
});

describe('NocBroadcastCard — test connection', () => {
  it('clicking "Probar conexión" fires POST /test', async () => {
    const user = userEvent.setup();
    const { testMutate } = setup({ config: baseConfig({ configured: true }) });
    render(<NocBroadcastCard />);

    await user.click(screen.getByRole('button', { name: /probar conexión/i }));
    await waitFor(() => expect(testMutate).toHaveBeenCalledTimes(1));
  });

  it('shows the success toast when the test succeeds', () => {
    setup({ testSuccess: true });
    render(<NocBroadcastCard />);
    expect(screen.getByText(/mensaje de prueba enviado/i)).toBeInTheDocument();
  });

  it('is disabled when the config is not configured', () => {
    setup({ config: baseConfig({ configured: false }) });
    render(<NocBroadcastCard />);
    expect(screen.getByRole('button', { name: /probar conexión/i })).toBeDisabled();
  });

  it('503 shows a "falta configurar / no habilitado" message', () => {
    setup({ testError: { response: { status: 503, data: { code: 'NOC_BROADCAST_NOT_CONFIGURED' } } } });
    render(<NocBroadcastCard />);
    expect(screen.getByText(/falta configurar|no está habilitad/i)).toBeInTheDocument();
  });

  it('502 shows an "error hablando con Evolution API" message', () => {
    setup({ testError: { response: { status: 502, data: { code: 'EVOLUTION_API_ERROR' } } } });
    render(<NocBroadcastCard />);
    expect(screen.getByText(/error hablando con evolution api/i)).toBeInTheDocument();
  });
});

describe('NocBroadcastCard — reachability note', () => {
  it('warns that the server must be able to reach the Pi over the network', () => {
    setup();
    render(<NocBroadcastCard />);
    expect(screen.getByText(/el servidor debe poder/i)).toBeInTheDocument();
  });
});
