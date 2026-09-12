/**
 * SuricataAssigneeEditor (Fase I, task I.2, spec `suricata-tickets-ui` UI-7,
 * design D13). `useSetSuricataAssignee` already existed since Fase G but was
 * unwired to any UI — this is that missing wiring.
 *
 *  AE-1 read-only   → without `suricata.manage`, shows plain text (no editable control)
 *  AE-2 editable    → with `suricata.manage`, shows the repo `Select` (combobox) seeded with RBAC users
 *  AE-3 save        → picking an option calls the PATCH mutation with the new assigneeId
 *  AE-4 clear       → picking "Sin asignar" sends `assigneeId: null`
 *  AE-5 saving      → shows a saving indicator while the mutation is in flight
 *  AE-6 error       → a failed save shows a visible, non-blocking error
 *  AE-7 no native   → hard repo rule: NEVER a native `<select>` facing the operator
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
  it('shows the repo Select seeded with RBAC users when holding suricata.manage', async () => {
    const user = userEvent.setup();
    render(<SuricataAssigneeEditor ticketId="t-1" assigneeId={null} assigneeName={null} />);

    const combobox = screen.getByRole('combobox', { name: /asignado a/i });
    expect(combobox).toHaveTextContent(/sin asignar/i);

    await user.click(combobox);
    expect(screen.getByRole('option', { name: 'Ronald' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ana' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /sin asignar/i })).toBeInTheDocument();
  });

  it('reflects the currently assigned user on the trigger', () => {
    render(<SuricataAssigneeEditor ticketId="t-1" assigneeId="u-1" assigneeName="Ronald" />);
    expect(screen.getByRole('combobox', { name: /asignado a/i })).toHaveTextContent('Ronald');
  });
});

describe('AE-3 save', () => {
  it('picking a user saves the new assigneeId', async () => {
    const user = userEvent.setup();
    render(<SuricataAssigneeEditor ticketId="t-1" assigneeId={null} assigneeName={null} />);

    await user.click(screen.getByRole('combobox', { name: /asignado a/i }));
    await user.click(screen.getByRole('option', { name: 'Ana' }));

    expect(mockMutateAsync).toHaveBeenCalledWith({ ticketId: 't-1', assigneeId: 'u-2' });
  });
});

describe('AE-4 clear', () => {
  it('picking "Sin asignar" sends assigneeId: null', async () => {
    const user = userEvent.setup();
    render(<SuricataAssigneeEditor ticketId="t-1" assigneeId="u-1" assigneeName="Ronald" />);

    await user.click(screen.getByRole('combobox', { name: /asignado a/i }));
    await user.click(screen.getByRole('option', { name: /sin asignar/i }));

    expect(mockMutateAsync).toHaveBeenCalledWith({ ticketId: 't-1', assigneeId: null });
  });
});

describe('AE-8 users error', () => {
  // A failed RBAC users fetch used to look exactly like "there is nobody to
  // assign": the combobox rendered with only "Sin asignar" and no warning.
  it('shows a visible error with a retry when the user list fails to load', async () => {
    const refetch = vi.fn();
    vi.mocked(useRbacUsersModule.useRbacUsers).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    } as unknown as ReturnType<typeof useRbacUsersModule.useRbacUsers>);

    const user = userEvent.setup();
    render(<SuricataAssigneeEditor ticketId="t-1" assigneeId={null} assigneeName={null} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/no pudimos cargar/i);

    await user.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('shows no such error when the user list loads fine', () => {
    render(<SuricataAssigneeEditor ticketId="t-1" assigneeId={null} assigneeName={null} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('AE-7 no native select', () => {
  it('never renders a native <select> facing the operator (hard repo rule)', () => {
    render(<SuricataAssigneeEditor ticketId="t-1" assigneeId={null} assigneeName={null} />);
    expect(document.querySelector('select')).toBeNull();
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

    await user.click(screen.getByRole('combobox', { name: /asignado a/i }));
    await user.click(screen.getByRole('option', { name: 'Ana' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo/i);
  });
});
