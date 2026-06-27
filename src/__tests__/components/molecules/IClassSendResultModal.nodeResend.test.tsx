/**
 * Tests for the ICLASS_NODE_NOT_FOUND manual-resend section added to
 * IClassSendResultModal. Covers:
 *  - section visibility (permission + taskId gating)
 *  - loading skeleton
 *  - empty state
 *  - node list renders
 *  - button disabled until node selected
 *  - successful resend calls mutation with correct nodeCode and closes modal
 *  - failed resend shows error inside modal (does NOT close)
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// ── Mock useMyPermissions (useCan) ───────────────────────────────────────────
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: vi.fn(() => ({
    permissions: ['*'],
    roles: [],
    user: null,
    isLoading: false,
    isError: false,
    can: () => true,
  })),
  useCan: vi.fn(() => true),
}));

// ── Mock useScheduling hooks ─────────────────────────────────────────────────
vi.mock('@/hooks/useScheduling', () => ({
  useIClassNodes: vi.fn(),
  useResendToIClass: vi.fn(),
}));

import { useCan } from '@/hooks/useMyPermissions';
import { useIClassNodes, useResendToIClass } from '@/hooks/useScheduling';
import { IClassSendResultModal } from '@/components/molecules/IClassSendResultModal/IClassSendResultModal';

import { mockMutation, mockQuery } from '@/__tests__/_utils/reactQueryMocks';
// ── Helpers ──────────────────────────────────────────────────────────────────

const NODE_NOT_FOUND_ERROR = { code: 'ICLASS_NODE_NOT_FOUND' };
const SAMPLE_NODES = [
  { code: 'BSAS01', description: 'Buenos Aires Norte' },
  { code: 'CBA01',  description: 'Córdoba Centro' },
];


function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderModal(props: Partial<Parameters<typeof IClassSendResultModal>[0]> = {}) {
  const onClose = props.onClose ?? vi.fn();
  const onRetry = props.onRetry ?? vi.fn();
  const client = makeClient();

  return {
    onClose,
    onRetry,
    ...render(
      <QueryClientProvider client={client}>
        <IClassSendResultModal
          open
          error={NODE_NOT_FOUND_ERROR}
          onClose={onClose}
          onRetry={onRetry}
          taskId="task-123"
          {...props}
        />
      </QueryClientProvider>,
    ),
  };
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useCan).mockReturnValue(true);
  vi.mocked(useIClassNodes).mockReturnValue(mockQuery({ data: SAMPLE_NODES, isLoading: false, isError: false }));
  vi.mocked(useResendToIClass).mockReturnValue(mockMutation({ mutateAsync: vi.fn(), isPending: false }));
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('IClassSendResultModal — ICLASS_NODE_NOT_FOUND node-resend section', () => {

  describe('visibility gating', () => {
    it('shows the node selector when error is ICLASS_NODE_NOT_FOUND, user can resend, and taskId is provided', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /seleccionar nodo/i })).toBeInTheDocument();
    });

    it('does NOT show the node selector when the user lacks the permission', () => {
      vi.mocked(useCan).mockReturnValue(false);
      renderModal();
      expect(screen.queryByRole('button', { name: /seleccionar nodo/i })).not.toBeInTheDocument();
    });

    it('does NOT show the node selector when taskId is omitted', () => {
      renderModal({ taskId: undefined });
      expect(screen.queryByRole('button', { name: /seleccionar nodo/i })).not.toBeInTheDocument();
    });

    it('does NOT show the node selector for a different error code', () => {
      renderModal({ error: { code: 'ICLASS_UNAVAILABLE' } });
      expect(screen.queryByRole('button', { name: /seleccionar nodo/i })).not.toBeInTheDocument();
    });

    it('still shows "Reintentar" when the user lacks the permission (fallback behaviour)', () => {
      vi.mocked(useCan).mockReturnValue(false);
      renderModal();
      expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    });

    it('does NOT show "Reintentar" when the node selector section is visible', () => {
      renderModal();
      expect(screen.queryByRole('button', { name: /reintentar/i })).not.toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('renders the skeleton and no trigger when nodes are loading', () => {
      vi.mocked(useIClassNodes).mockReturnValue(mockQuery({ data: undefined, isLoading: true, isError: false }));
      renderModal();
      expect(screen.getByLabelText(/cargando nodos/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /seleccionar nodo/i })).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty-state message when nodes list is empty', () => {
      vi.mocked(useIClassNodes).mockReturnValue(mockQuery({ data: [], isLoading: false, isError: false }));
      renderModal();
      expect(screen.getByText(/no hay nodos disponibles/i)).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when useIClassNodes returns isError', () => {
      vi.mocked(useIClassNodes).mockReturnValue(mockQuery({ data: undefined, isLoading: false, isError: true }));
      renderModal();
      expect(screen.getByText(/no se pudieron cargar los nodos/i)).toBeInTheDocument();
    });
  });

  describe('node list', () => {
    it('opens the dropdown and shows all nodes when trigger is clicked', () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /seleccionar nodo/i }));
      expect(screen.getByRole('option', { name: /BSAS01/ })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /CBA01/ })).toBeInTheDocument();
    });

    it('displays node code and description as separate elements', () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /seleccionar nodo/i }));
      expect(screen.getByText('BSAS01')).toBeInTheDocument();
      expect(screen.getByText('Buenos Aires Norte')).toBeInTheDocument();
    });
  });

  describe('"Reenviar a IClass" button', () => {
    it('is disabled initially (no node selected)', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /reenviar a iclass/i })).toBeDisabled();
    });

    it('becomes enabled after selecting a node', () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /seleccionar nodo/i }));
      fireEvent.click(screen.getByRole('option', { name: /BSAS01/ }));
      expect(screen.getByRole('button', { name: /reenviar a iclass/i })).not.toBeDisabled();
    });

    it('shows loading text while resend is pending', () => {
      vi.mocked(useResendToIClass).mockReturnValue(mockMutation({ mutateAsync: vi.fn(), isPending: true }));
      renderModal();
      // isPending disables the trigger too, so resend button is disabled + reads "Reenviando..."
      expect(screen.getByRole('button', { name: /reenviando/i })).toBeInTheDocument();
    });
  });

  describe('successful resend', () => {
    it('calls mutation with the selected nodeCode', async () => {
      const mutateAsync = vi.fn().mockResolvedValue({ iclassOrderCode: 'OS-999' });
      vi.mocked(useResendToIClass).mockReturnValue(mockMutation({ mutateAsync, isPending: false }));
      const onClose = vi.fn();
      const onResendSuccess = vi.fn();

      renderModal({ onClose, onResendSuccess });

      // Select node
      fireEvent.click(screen.getByRole('button', { name: /seleccionar nodo/i }));
      fireEvent.click(screen.getByRole('option', { name: /BSAS01/ }));

      // Resend
      fireEvent.click(screen.getByRole('button', { name: /reenviar a iclass/i }));

      await waitFor(() => {
        expect(mutateAsync).toHaveBeenCalledWith('BSAS01');
      });
    });

    it('calls onResendSuccess with the iclassOrderCode on success', async () => {
      const mutateAsync = vi.fn().mockResolvedValue({ iclassOrderCode: 'OS-999' });
      vi.mocked(useResendToIClass).mockReturnValue(mockMutation({ mutateAsync, isPending: false }));
      const onResendSuccess = vi.fn();
      const onClose = vi.fn();

      renderModal({ onResendSuccess, onClose });

      fireEvent.click(screen.getByRole('button', { name: /seleccionar nodo/i }));
      fireEvent.click(screen.getByRole('option', { name: /CBA01/ }));
      fireEvent.click(screen.getByRole('button', { name: /reenviar a iclass/i }));

      await waitFor(() => {
        expect(onResendSuccess).toHaveBeenCalledWith('OS-999');
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('failed resend', () => {
    it('shows the error message inside the modal and does NOT close it', async () => {
      const mutateAsync = vi.fn().mockRejectedValue({
        response: { data: { message: 'Código de nodo inválido.', code: 'VALIDATION_ERROR' } },
      });
      vi.mocked(useResendToIClass).mockReturnValue(mockMutation({ mutateAsync, isPending: false }));
      const onClose = vi.fn();

      renderModal({ onClose });

      fireEvent.click(screen.getByRole('button', { name: /seleccionar nodo/i }));
      fireEvent.click(screen.getByRole('option', { name: /BSAS01/ }));
      fireEvent.click(screen.getByRole('button', { name: /reenviar a iclass/i }));

      await waitFor(() => {
        expect(screen.getByText('Código de nodo inválido.')).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
      });
    });

    it('shows a generic fallback message when the error has no message', async () => {
      const mutateAsync = vi.fn().mockRejectedValue(new Error('network'));
      vi.mocked(useResendToIClass).mockReturnValue(mockMutation({ mutateAsync, isPending: false }));

      renderModal();

      fireEvent.click(screen.getByRole('button', { name: /seleccionar nodo/i }));
      fireEvent.click(screen.getByRole('option', { name: /BSAS01/ }));
      fireEvent.click(screen.getByRole('button', { name: /reenviar a iclass/i }));

      await waitFor(() => {
        expect(screen.getByText(/error al reenviar/i)).toBeInTheDocument();
      });
    });
  });

  describe('useIClassNodes enabled flag', () => {
    it('passes enabled=true to useIClassNodes when section is visible', () => {
      renderModal();
      // The hook must have been called with enabled=true so nodes are fetched
      expect(useIClassNodes).toHaveBeenCalledWith(true);
    });
  });
});
