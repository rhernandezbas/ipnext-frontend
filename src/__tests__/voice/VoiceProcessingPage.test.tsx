import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import VoiceProcessingPage from '@/pages/voice/VoiceProcessingPage';
import * as useVoiceProcessingModule from '@/hooks/useVoiceProcessing';
import type { VoiceCall } from '@/types/voiceProcessing';

vi.mock('@/hooks/useVoiceProcessing');

const mockCalls: VoiceCall[] = [
  { id: 'CALL-TEST-001', origen: '+54 11 4000-0001', destino: '+54 11 5000-0001', duracion: 222, estado: 'Completada' },
  { id: 'CALL-TEST-002', origen: '+54 11 4000-0002', destino: '+54 11 5000-0002', duracion: 0, estado: 'Fallida' },
];

describe('VoiceProcessingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useVoiceProcessingModule.useVoiceProcessing).mockReturnValue({
      data: mockCalls,
      isLoading: false,
    } as ReturnType<typeof useVoiceProcessingModule.useVoiceProcessing>);
  });

  it('renders the page title', () => {
    render(<MemoryRouter><VoiceProcessingPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Procesando/i })).toBeInTheDocument();
  });

  it('renders voice calls from hook data', () => {
    render(<MemoryRouter><VoiceProcessingPage /></MemoryRouter>);
    expect(screen.getByText('CALL-TEST-001')).toBeInTheDocument();
    expect(screen.getByText('CALL-TEST-002')).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    vi.mocked(useVoiceProcessingModule.useVoiceProcessing).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useVoiceProcessingModule.useVoiceProcessing>);
    render(<MemoryRouter><VoiceProcessingPage /></MemoryRouter>);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });
});
