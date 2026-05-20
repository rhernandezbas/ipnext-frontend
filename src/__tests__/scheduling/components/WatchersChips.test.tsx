import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { WatchersChips } from '@/pages/scheduling/SchedulingTaskDetailPage/components/WatchersChips';
import type { Admin } from '@/types/admin';

const allAdmins: Admin[] = [
  { id: 'admin-1', name: 'Juan Pérez', email: 'juan@test.com', role: 'admin', status: 'active', createdAt: '', lastLogin: null },
  { id: 'admin-2', name: 'Ana García', email: 'ana@test.com', role: 'admin', status: 'active', createdAt: '', lastLogin: null },
  { id: 'admin-3', name: 'Pedro López', email: 'pedro@test.com', role: 'admin', status: 'active', createdAt: '', lastLogin: null },
];

describe('WatchersChips', () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onChange.mockResolvedValue(undefined);
  });

  it('renders chips for each watcherId', () => {
    render(
      <WatchersChips
        watcherIds={['admin-1', 'admin-2']}
        allAdmins={allAdmins}
        onChange={onChange}
        isSaving={false}
      />
    );
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByText('Ana García')).toBeInTheDocument();
  });

  it('renders empty state when no watchers', () => {
    render(
      <WatchersChips
        watcherIds={[]}
        allAdmins={allAdmins}
        onChange={onChange}
        isSaving={false}
      />
    );
    expect(screen.getByText(/sin watchers/i)).toBeInTheDocument();
  });

  it('renders add watcher button', () => {
    render(
      <WatchersChips
        watcherIds={[]}
        allAdmins={allAdmins}
        onChange={onChange}
        isSaving={false}
      />
    );
    expect(screen.getByRole('button', { name: /añadir watcher/i })).toBeInTheDocument();
  });

  it('calls onChange without the removed id when X is clicked', async () => {
    const user = userEvent.setup();
    render(
      <WatchersChips
        watcherIds={['admin-1', 'admin-2']}
        allAdmins={allAdmins}
        onChange={onChange}
        isSaving={false}
      />
    );
    // click the X for admin-1
    const removeBtn = screen.getByRole('button', { name: /quitar Juan Pérez/i });
    await user.click(removeBtn);
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(['admin-2'])
    );
  });

  it('opens popover when Add watcher is clicked', async () => {
    const user = userEvent.setup();
    render(
      <WatchersChips
        watcherIds={[]}
        allAdmins={allAdmins}
        onChange={onChange}
        isSaving={false}
      />
    );
    await user.click(screen.getByRole('button', { name: /añadir watcher/i }));
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('calls onChange with appended id when admin selected from popover', async () => {
    const user = userEvent.setup();
    render(
      <WatchersChips
        watcherIds={['admin-1']}
        allAdmins={allAdmins}
        onChange={onChange}
        isSaving={false}
      />
    );
    await user.click(screen.getByRole('button', { name: /añadir watcher/i }));
    // admin-2 and admin-3 should show (admin-1 already a watcher)
    const result = screen.getByText('Ana García');
    await user.click(result);
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(['admin-1', 'admin-2'])
    );
  });
});
