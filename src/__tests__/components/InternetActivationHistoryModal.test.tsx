import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { InternetServiceEvent } from '@/types/internetService';

vi.mock('@/hooks/useInternetServices', () => ({
  useInternetActivationHistory: vi.fn(),
}));

import { useInternetActivationHistory } from '@/hooks/useInternetServices';
import { InternetActivationHistoryModal } from '@/components/molecules/InternetActivationHistoryModal/InternetActivationHistoryModal';

const events: InternetServiceEvent[] = [
  {
    id: 'e1',
    clientId: 'client-1',
    customerName: 'Juan Pérez',
    contractId: 'c1',
    eventType: 'alta',
    actorName: 'Operador Uno',
    reason: 'Alta nueva por instalación',
    createdAt: '2026-06-01T10:00:00Z',
  },
  {
    id: 'e2',
    clientId: 'client-1',
    customerName: 'Juan Pérez',
    contractId: 'c1',
    eventType: 'baja',
    actorName: 'Operador Dos',
    reason: null,
    createdAt: '2026-05-01T10:00:00Z',
  },
];

function mockHistory(over: { data?: InternetServiceEvent[]; isLoading?: boolean; isError?: boolean } = {}) {
  vi.mocked(useInternetActivationHistory).mockReturnValue({
    data: over.data ?? events,
    isLoading: over.isLoading ?? false,
    isError: over.isError ?? false,
  } as ReturnType<typeof useInternetActivationHistory>);
}

function renderModal(props: { open?: boolean; clientId?: string } = {}) {
  return render(
    <MemoryRouter>
      <InternetActivationHistoryModal
        open={props.open ?? true}
        clientId={props.clientId ?? 'client-1'}
        onClose={vi.fn()}
      />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('InternetActivationHistoryModal', () => {
  it('does not render when closed', () => {
    mockHistory();
    renderModal({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders a dialog with the history title when open', () => {
    mockHistory();
    renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/historial de internet/i)).toBeInTheDocument();
  });

  it('renders the column headers Fecha/Tipo/Operador/Motivo', () => {
    mockHistory();
    renderModal();
    expect(screen.getByText(/fecha/i)).toBeInTheDocument();
    expect(screen.getByText('Tipo')).toBeInTheDocument();
    expect(screen.getByText('Operador')).toBeInTheDocument();
    expect(screen.getByText('Motivo')).toBeInTheDocument();
  });

  it('renders one row per event with the operator name and the type badge', () => {
    mockHistory();
    renderModal();
    expect(screen.getByText('Operador Uno')).toBeInTheDocument();
    expect(screen.getByText('Operador Dos')).toBeInTheDocument();
    expect(screen.getByText('Alta')).toBeInTheDocument();
    expect(screen.getByText('Baja')).toBeInTheDocument();
  });

  it('passes the clientId filter to the hook (round-trip)', () => {
    mockHistory();
    renderModal({ clientId: 'client-99' });
    expect(useInternetActivationHistory).toHaveBeenCalledWith({ clientId: 'client-99' }, true);
  });

  it('a reason with text shows a "ver" button; opening it shows the reason', async () => {
    const user = userEvent.setup();
    mockHistory();
    renderModal();
    const verButtons = screen.getAllByRole('button', { name: /ver motivo/i });
    expect(verButtons).toHaveLength(1); // only the event WITH a reason
    await user.click(verButtons[0]);
    expect(screen.getByText('Alta nueva por instalación')).toBeInTheDocument();
  });

  it('shows a loading state while fetching', () => {
    mockHistory({ isLoading: true, data: undefined });
    renderModal();
    // DataTable renders skeleton rows while loading — the empty message must NOT show.
    expect(screen.queryByText(/sin eventos/i)).not.toBeInTheDocument();
  });

  it('shows an empty message when there are no events', () => {
    mockHistory({ data: [] });
    renderModal();
    expect(screen.getByText(/sin eventos/i)).toBeInTheDocument();
  });

  it('closes the modal when the close button is clicked', async () => {
    const user = userEvent.setup();
    mockHistory();
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <InternetActivationHistoryModal open clientId="client-1" onClose={onClose} />
      </MemoryRouter>,
    );
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
