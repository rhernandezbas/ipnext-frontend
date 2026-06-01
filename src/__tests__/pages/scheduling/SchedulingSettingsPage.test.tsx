import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the GestionRealBody hooks so the body renders under the tab without real fetches.
vi.mock('@/hooks/useGestionRealIngest', () => ({
  useGestionRealConfig: vi.fn(),
  useUpdateGestionRealConfig: vi.fn(),
  useGestionRealStatus: vi.fn(),
  useGestionRealNeedsReview: vi.fn(),
}));
vi.mock('@/hooks/useProjects', () => ({
  useProjects: vi.fn(),
}));
vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlag: vi.fn(() => ({ data: { key: 'gestion-real-ingest', enabled: false }, isLoading: false, isError: false })),
  useSetFeatureFlag: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, isError: false })),
}));
import {
  useGestionRealConfig,
  useUpdateGestionRealConfig,
  useGestionRealStatus,
  useGestionRealNeedsReview,
} from '@/hooks/useGestionRealIngest';
import { useProjects } from '@/hooks/useProjects';
import SchedulingSettingsPage from '@/pages/scheduling/SchedulingSettingsPage';
import type { IngestConfigDTO, IngestStatusDTO } from '@/types/gestionRealIngest';

const idleMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
  reset: vi.fn(),
};

const config: IngestConfigDTO = {
  intervalMs: 300_000,
  windowMonths: 3,
  fiberProjectId: 'p1',
  wirelessProjectId: 'p2',
  sourceEstado: 'CONF',
};

const status: IngestStatusDTO = {
  lastRunAt: '2026-05-29T12:00:00.000Z',
  created: 0,
  skippedDuplicate: 0,
  skippedUnmirrored: 0,
  unclassified: 0,
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SchedulingSettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SchedulingSettingsPage — Gestión Real tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = '';
    vi.mocked(useGestionRealConfig).mockReturnValue({ data: config, isLoading: false, isError: false } as never);
    vi.mocked(useUpdateGestionRealConfig).mockReturnValue(idleMutation as never);
    vi.mocked(useGestionRealStatus).mockReturnValue({ data: status, isLoading: false, isError: false } as never);
    vi.mocked(useGestionRealNeedsReview).mockReturnValue({ data: [], isLoading: false, isError: false } as never);
    vi.mocked(useProjects).mockReturnValue({ data: [], isLoading: false, isError: false } as never);
  });

  it('renders the "Gestión Real" tab in the tab list', () => {
    renderPage();
    expect(screen.getByRole('tab', { name: /gestión real/i })).toBeInTheDocument();
  });

  it('renders the GestionRealBody sections when the tab is selected', () => {
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /gestión real/i }));

    // Section headings from GestionRealBody (Configuración / Estado / Revisión pendiente).
    expect(screen.getByRole('heading', { name: /configuración/i, level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^estado$/i, level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /revisión pendiente/i, level: 3 })).toBeInTheDocument();
  });
});
