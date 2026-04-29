import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import SchedulingCalendarPage from '@/pages/scheduling/SchedulingCalendarPage';

vi.mock('@/hooks/useScheduling', () => ({
  useTasks: vi.fn(),
}));

import { useTasks } from '@/hooks/useScheduling';

describe('SchedulingCalendarPage', () => {
  beforeEach(() => {
    vi.mocked(useTasks).mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useTasks>);
  });

  it('renders heading containing "Calendario"', () => {
    render(<MemoryRouter><SchedulingCalendarPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Calendario/i })).toBeInTheDocument();
  });

  it('renders day headers', () => {
    render(<MemoryRouter><SchedulingCalendarPage /></MemoryRouter>);
    expect(screen.getByText('Lun')).toBeInTheDocument();
    expect(screen.getByText('Mar')).toBeInTheDocument();
    expect(screen.getByText('Mié')).toBeInTheDocument();
    expect(screen.getByText('Jue')).toBeInTheDocument();
    expect(screen.getByText('Vie')).toBeInTheDocument();
  });
});
