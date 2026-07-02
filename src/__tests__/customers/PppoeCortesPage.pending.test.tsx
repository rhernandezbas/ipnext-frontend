/**
 * PppoeCortesPage — S2 (fix wave pppoe-preprovision): el preview de enforcement
 * puede incluir pendientes de instalación (nasId null).
 *
 * - `EnforcementPreviewSample.nasId` es `string | null` (el fixture de abajo
 *   solo compila con el tipo corregido — lo verifica `tsc --noEmit`).
 * - El desglose "Por router" renderiza "—" para el grupo sin router: la key
 *   JSON de un nasId null llega como el string "null" y NO debe mostrarse
 *   "Router null".
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import PppoeCortesPage from '@/pages/customers/PppoeCortesPage';
import type { EnforcementPreview } from '@/types/pppoe';

vi.mock('@/hooks/usePppoe', () => ({
  usePreviewEnforcement: vi.fn(),
  useStartBulkEnforcement: vi.fn(),
  useBulkEnforcementStatus: vi.fn(),
}));

import {
  usePreviewEnforcement,
  useStartBulkEnforcement,
  useBulkEnforcementStatus,
} from '@/hooks/usePppoe';

// El sample tipa nasId: null — compila solo con EnforcementPreviewSample.nasId string|null.
const PREVIEW_WITH_PENDING: EnforcementPreview = {
  total: 5,
  byRouter: { 'nas-1': 3, null: 2 },
  sample: [
    { id: 'p-1', username: 'preprov01', nasId: null, contractId: null, enforcedState: 'active' },
    { id: 'a-1', username: 'cliente01', nasId: 'nas-1', contractId: 'c-1', enforcedState: 'active' },
  ],
};

function setup(preview: EnforcementPreview = PREVIEW_WITH_PENDING) {
  vi.mocked(usePreviewEnforcement).mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue(preview),
    isPending: false,
  } as never);
  vi.mocked(useStartBulkEnforcement).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as never);
  vi.mocked(useBulkEnforcementStatus).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
  } as never);
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PppoeCortesPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setup();
});

describe('S2: preview con pendientes (nasId null)', () => {
  it('el desglose por router muestra "Router —" para el grupo sin router y nunca "Router null"', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /previsualizar/i }));

    expect(await screen.findByText('Router nas-1')).toBeInTheDocument();
    expect(screen.getByText('Router —')).toBeInTheDocument();
    expect(screen.queryByText(/router null/i)).toBeNull();
    // El sample (incluido el pendiente) se lista sin romper.
    expect(screen.getByText(/preprov01/)).toBeInTheDocument();
  });
});
