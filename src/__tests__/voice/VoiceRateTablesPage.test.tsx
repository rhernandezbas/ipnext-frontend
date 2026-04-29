import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import VoiceRateTablesPage from '@/pages/voice/VoiceRateTablesPage';
import * as useVoiceRateTablesModule from '@/hooks/useVoiceRateTables';
import type { VoiceRateTable } from '@/types/voiceRateTable';

vi.mock('@/hooks/useVoiceRateTables');

const mockRates: VoiceRateTable[] = [
  { id: '1', destino: 'Nacional móvil test', prefijo: '15', tarifaMin: 0.85, zona: 'Nacional' },
  { id: '2', destino: 'Internacional USA test', prefijo: '001', tarifaMin: 1.20, zona: 'América del Norte' },
];

describe('VoiceRateTablesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useVoiceRateTablesModule.useVoiceRateTables).mockReturnValue({
      data: mockRates,
      isLoading: false,
    } as ReturnType<typeof useVoiceRateTablesModule.useVoiceRateTables>);
  });

  it('renders the page title', () => {
    render(<MemoryRouter><VoiceRateTablesPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Tablas de tarifas/i })).toBeInTheDocument();
  });

  it('renders rate table rows from hook data', () => {
    render(<MemoryRouter><VoiceRateTablesPage /></MemoryRouter>);
    expect(screen.getByText('Nacional móvil test')).toBeInTheDocument();
    expect(screen.getByText('Internacional USA test')).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    vi.mocked(useVoiceRateTablesModule.useVoiceRateTables).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useVoiceRateTablesModule.useVoiceRateTables>);
    render(<MemoryRouter><VoiceRateTablesPage /></MemoryRouter>);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });
});
