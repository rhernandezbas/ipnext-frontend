/**
 * #79 — Tests for TicketSlaBody (SLA / Timer settings). Mocks at the hook layer
 * (useTicketSlaConfig + update mutation). Wire contract: the body reads
 * warnMinutes/dangerMinutes, PUTs the same field names, blocks danger <= warn
 * client-side, and surfaces the BE's 422 TICKET_SLA_THRESHOLD_ORDER.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useTicketSlaConfig');
vi.mock('@/components/auth/Can', () => ({
  Can: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import * as slaModule from '@/hooks/useTicketSlaConfig';
import { TicketSlaBody } from '@/pages/tickets/settings/TicketSlaBody';

const mutateAsync = vi.fn();

function setConfig(data: { warnMinutes: number; dangerMinutes: number } | undefined, isLoading = false) {
  vi.mocked(slaModule.useTicketSlaConfig).mockReturnValue({
    data, isLoading,
  } as ReturnType<typeof slaModule.useTicketSlaConfig>);
}

describe('TicketSlaBody (#79)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync.mockResolvedValue({ warnMinutes: 60, dangerMinutes: 240 });
    setConfig({ warnMinutes: 60, dangerMinutes: 240 });
    vi.mocked(slaModule.useUpdateTicketSlaConfig).mockReturnValue({
      mutateAsync, isPending: false,
    } as unknown as ReturnType<typeof slaModule.useUpdateTicketSlaConfig>);
  });

  it('hydrates the inputs from the loaded config', () => {
    render(<TicketSlaBody />);
    expect(screen.getByLabelText(/Umbral de alerta/i)).toHaveValue(60);
    expect(screen.getByLabelText(/Umbral de peligro/i)).toHaveValue(240);
  });

  it('PUTs the same field names the BE expects (wire contract)', async () => {
    render(<TicketSlaBody />);
    fireEvent.change(screen.getByLabelText(/Umbral de alerta/i), { target: { value: '90' } });
    fireEvent.change(screen.getByLabelText(/Umbral de peligro/i), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ warnMinutes: 90, dangerMinutes: 300 }));
  });

  it('blocks danger <= warn client-side and does NOT call the mutation', async () => {
    render(<TicketSlaBody />);
    fireEvent.change(screen.getByLabelText(/Umbral de alerta/i), { target: { value: '300' } });
    fireEvent.change(screen.getByLabelText(/Umbral de peligro/i), { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await screen.findByText(/El umbral rojo \(peligro\) debe ser mayor/i);
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('surfaces the BE 422 TICKET_SLA_THRESHOLD_ORDER', async () => {
    mutateAsync.mockRejectedValueOnce({
      response: { status: 422, data: { code: 'TICKET_SLA_THRESHOLD_ORDER' } },
    });
    render(<TicketSlaBody />);
    fireEvent.change(screen.getByLabelText(/Umbral de alerta/i), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText(/Umbral de peligro/i), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await screen.findByText(/El umbral rojo debe ser mayor que el amarillo/i);
  });
});
