/**
 * SuricataAssigneeEditor (Fase I, task I.2, spec `suricata-tickets-ui` UI-7,
 * design D13). `useSetSuricataAssignee` already existed since Fase G but was
 * unwired to any UI — this is that missing wiring.
 *
 *  AE-1 read-only   → without `suricata.manage`, shows plain text (no editable control)
 *  AE-2 editable    → with `suricata.manage`, shows a `<select>` seeded with RBAC users
 *  AE-3 save        → changing the select calls the PATCH mutation with the new assigneeId
 *  AE-4 clear       → picking "Sin asignar" sends `assigneeId: null`
 *  AE-5 saving      → shows a saving indicator while the mutation is in flight
 *  AE-6 error       → a failed save shows a visible, non-blocking error
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useMyPermissions');
vi.mock('@/hooks/useRbacUsers');
vi.mock('@/pages/suricata/hooks/useSuricataTickets');

import { useCan } from '@/hooks/useMyPermissions';
import * as useRbacUsersModule from '@/hooks/useRbacUsers';
import * as useSuricataTicketsModule from '@/pages/suricata/hooks/useSuricataTickets';
import { SuricataAssigneeEditor } from '@/pages/suricata/SuricataTicketDetail/SuricataAssigneeEditor';

const mockMutateAsync = vi.fn();

function mockAssigneeMutation(overrides: Partial<ReturnType<typeof useSuricataTicketsModule.useSetSuricataAssignee>> = {}) {
  vi.mocked(useSuricataTicketsModule.useSetSuricataAssignee).mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useSuricataTicketsModule.useSetSuricataAssignee>);
}

const USERS = [
  { id: 'u-1', name: 'Ronald' },
  { id: 'u-2', name: 'Ana' },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockMutateAsync.mockReset().mockResolvedValue({ id: 't-1', assigneeId: 'u-1' });
  vi.mocked(useCan).mockReturnValue(true);
  vi.mocked(useRbacUsersModule.useRbacUsers).mockReturnValue({
    data: USERS,
    isLoading: false,
  } as unknown as ReturnType<typeof useRbacUsersModule.useRbacUsers>);
  mockAssigneeMutation();
});

describe('AE-1 read-only', () => {
  it('shows plain text without an editable control when lacking suricata.manage', () => {
    vi.mocked(useCan).mockReturnValue(false);
    render(<SuricataAssigneeEditor ticketId="t-1" assigneeId={null} assigneeName={null} />);
    expect(screen.getByText(/sin asignar/i)).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('shows the assignee name read-only when assigned and lacking permission', () => {
    vi.mocked(useCan).mockReturnValue(false);
    render(<SuricataAssigneeEditor ticketId="t-1" assigneeId="u-1" assigneeName="Ronald" />);
    expect(screen.getByText(/ronald/i)).toBeInTheDocument();
  });
});

describe('AE-2 editable', () => {
  it('shows a select seeded with RBAC users when holding suricata.manage', () => {
    render(<SuricataAssigneeEditor ticketId="t-1" assigneeId={null} assigneeName={null} />);
    const select = screen.getByRole('combobox', { name: /asignado a/i });
    expect(select).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Ronald' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ana' })).toBeInTheDocument();
  });
});

describe('AE-3 save', () => {
  it('changing the select saves the new assigneeId', async () => {
    const user = userEvent.setup();
    render(<SuricataAssigneeEditor ticketId="t-1" assigneeId={null} assigneeName={null} />);
    await user.selectOptions(screen.getByRole('combobox', { name: /asignado a/i }), 'u-2');
    expect(mockMutateAsync).toHaveBeenCalledWith({ ticketId: 't-1', assigneeId: 'u-2' });
  });
});

describe('AE-4 clear', () => {
  it('picking "Sin asignar" sends assigneeId: null', async () => {
    const user = userEvent.setup();
    render(<SuricataAssigneeEditor ticketId="t-1" assigneeId="u-1" assigneeName="Ronald" />);
    await user.selectOptions(screen.getByRole('combobox', { name: /asignado a/i }), '');
    expect(mockMutateAsync).toHaveBeenCalledWith({ ticketId: 't-1', assigneeId: null });
  });
});

describe('AE-5 saving', () => {
  it('shows a saving indicator while the mutation is in flight', () => {
    mockAssigneeMutation({ isPending: true });
    render(<SuricataAssigneeEditor ticketId="t-1" assigneeId={null} assigneeName={null} />);
    expect(screen.getByRole('status')).toHaveTextContent(/guardando/i);
    expect(screen.getByRole('combobox', { name: /asignado a/i })).toBeDisabled();
  });
});

describe('AE-6 error', () => {
  it('shows a visible error when the save fails', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('network'));
    const user = userEvent.setup();
    render(<SuricataAssigneeEditor ticketId="t-1" assigneeId={null} assigneeName={null} />);
    await user.selectOptions(screen.getByRole('combobox', { name: /asignado a/i }), 'u-2');
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo/i);
  });
});
