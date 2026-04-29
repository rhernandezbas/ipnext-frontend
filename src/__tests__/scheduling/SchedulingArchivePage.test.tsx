import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import SchedulingArchivePage from '@/pages/scheduling/SchedulingArchivePage';
import * as useSchedulingArchiveModule from '@/hooks/useSchedulingArchive';
import type { SchedulingArchiveTask } from '@/types/schedulingArchive';

vi.mock('@/hooks/useSchedulingArchive');

const mockTasks: SchedulingArchiveTask[] = [
  { id: '1', proyecto: 'Instalación Test Zona Norte', tecnico: 'Carlos Test', fecha: '2024-03-01', estado: 'Completado' },
  { id: '2', proyecto: 'Mantenimiento Test Zona Sur', tecnico: 'Ana Test', fecha: '2024-03-05', estado: 'Completado' },
];

describe('SchedulingArchivePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSchedulingArchiveModule.useSchedulingArchive).mockReturnValue({
      data: mockTasks,
      isLoading: false,
    } as ReturnType<typeof useSchedulingArchiveModule.useSchedulingArchive>);
  });

  it('renders the page title', () => {
    render(<MemoryRouter><SchedulingArchivePage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Archivo de Scheduling/i })).toBeInTheDocument();
  });

  it('renders archive tasks from hook data', () => {
    render(<MemoryRouter><SchedulingArchivePage /></MemoryRouter>);
    expect(screen.getByText('Instalación Test Zona Norte')).toBeInTheDocument();
    expect(screen.getByText('Mantenimiento Test Zona Sur')).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    vi.mocked(useSchedulingArchiveModule.useSchedulingArchive).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useSchedulingArchiveModule.useSchedulingArchive>);
    render(<MemoryRouter><SchedulingArchivePage /></MemoryRouter>);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });
});
