import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { GigaredConfig } from '@/types/gigared';

vi.mock('@/hooks/useGigared', () => ({
  useGigaredConfig: vi.fn(),
  useUpdateGigaredConfig: vi.fn(),
}));

vi.mock('@/api/gigared.api', () => ({
  gigaredApi: { getSummary: vi.fn() },
}));

import { useGigaredConfig, useUpdateGigaredConfig } from '@/hooks/useGigared';
import { gigaredApi } from '@/api/gigared.api';
import { GigaredTvBody } from '@/pages/customers/settings/GigaredTvBody';

const configured: GigaredConfig = {
  configured: true,
  apiKeyLast4: '1234',
  baseUrl: 'https://partners.gigaredsa.com.ar/api/v1',
  enabled: true,
  updatedAt: '2026-06-10T12:00:00Z',
};

const unconfigured: GigaredConfig = {
  configured: false,
  apiKeyLast4: null,
  baseUrl: 'https://partners.gigaredsa.com.ar/api/v1',
  enabled: false,
  updatedAt: null,
};

const mutateAsync = vi.fn().mockResolvedValue(configured);

function mockHooks(config: GigaredConfig = configured) {
  vi.mocked(useGigaredConfig).mockReturnValue({
    data: config,
    isLoading: false,
    isError: false,
  } as ReturnType<typeof useGigaredConfig>);
  vi.mocked(useUpdateGigaredConfig).mockReturnValue({
    mutateAsync,
    isPending: false,
    isError: false,
    isSuccess: false,
    reset: vi.fn(),
  } as unknown as ReturnType<typeof useUpdateGigaredConfig>);
}

describe('GigaredTvBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync.mockResolvedValue(configured);
  });

  it('shows masked key when configured (···1234)', () => {
    mockHooks(configured);
    render(<GigaredTvBody />);
    expect(screen.getByText(/1234/)).toBeInTheDocument();
  });

  it('shows "Sin configurar" when not configured', () => {
    mockHooks(unconfigured);
    render(<GigaredTvBody />);
    expect(screen.getByText(/sin configurar/i)).toBeInTheDocument();
  });

  it('does NOT call update when the key field is empty (save only if changed)', async () => {
    mockHooks(configured);
    render(<GigaredTvBody />);
    const save = screen.getByRole('button', { name: /guardar/i });
    expect(save).toBeDisabled();
  });

  it('sends only the apiKey when a new key is typed', async () => {
    const user = userEvent.setup();
    mockHooks(configured);
    render(<GigaredTvBody />);
    await user.type(screen.getByLabelText(/nueva api key/i), 'brandnewkey');
    await user.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({ apiKey: 'brandnewkey' }),
    );
  });

  it('toggles the enabled flag through update', async () => {
    const user = userEvent.setup();
    mockHooks(configured);
    render(<GigaredTvBody />);
    await user.click(screen.getByLabelText(/integración activa/i));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ enabled: false }));
  });

  it('probar conexión OK shows account/service counts', async () => {
    const user = userEvent.setup();
    mockHooks(configured);
    vi.mocked(gigaredApi.getSummary).mockResolvedValue({
      accounts: { registered: 5, unregistered: 2, total: 7 },
      services: [{ id: 's1', name: 'Play', qtyAvailable: 1, qtyUsed: 1, qtyPurchased: 2 }],
    });
    render(<GigaredTvBody />);
    await user.click(screen.getByRole('button', { name: /probar conexión/i }));
    await waitFor(() => expect(screen.getByText(/conexión exitosa/i)).toBeInTheDocument());
    expect(screen.getByText(/7/)).toBeInTheDocument();
  });

  it('probar conexión with 502 AUTH_FAILED shows "API key inválida"', async () => {
    const user = userEvent.setup();
    mockHooks(configured);
    vi.mocked(gigaredApi.getSummary).mockRejectedValue({
      response: { status: 502, data: { code: 'GIGARED_AUTH_FAILED' } },
    });
    render(<GigaredTvBody />);
    await user.click(screen.getByRole('button', { name: /probar conexión/i }));
    await waitFor(() => expect(screen.getByText(/api key inválida/i)).toBeInTheDocument());
  });
});
