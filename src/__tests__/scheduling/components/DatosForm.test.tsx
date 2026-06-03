import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DatosForm } from '@/pages/scheduling/SchedulingTaskDetailPage/components/DatosForm';
import type { Admin } from '@/types/admin';
import type { Partner } from '@/types/partner';
import type { Project } from '@/types/project';

// Stub useClientContracts so DatosForm can be rendered without a real API.
const useClientContractsMock = vi.fn(() => ({ data: [] as unknown[] }));
vi.mock('@/hooks/useCustomers', () => ({
  useClientContracts: () => useClientContractsMock(),
}));

const mockAdmins: Admin[] = [
  { id: 'admin-1', name: 'Juan Pérez', email: 'juan@example.com', role: 'admin', status: 'active', createdAt: '', lastLogin: null },
  { id: 'admin-2', name: 'Ana García', email: 'ana@example.com', role: 'admin', status: 'active', createdAt: '', lastLogin: null },
];

const mockPartners: Partner[] = [
  { id: 'partner-1', name: 'Partner A', status: 'active', primaryEmail: '', phone: '', address: '', city: '', country: '', timezone: '', currency: '', logoUrl: null, clientCount: 0, adminCount: 0, createdAt: '' },
];

const mockProjects: Project[] = [
  { id: 'proj-1', title: 'Proyecto Zeta', description: null, workflowId: null, createdAt: '', updatedAt: '' },
  { id: 'proj-2', title: 'Proyecto Alpha', description: null, workflowId: null, createdAt: '', updatedAt: '' },
];

const initialValues = {
  projectId: null,
  assigneeId: 'admin-1',
  partnerId: null,
  customerId: null,
  contractId: null,
  startDate: null,
  endDate: null,
  travelTimeTo: null,
  travelTimeFrom: null,
  address: null,
  coordinates: null,
};

describe('DatosForm', () => {
  const onSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onSubmit.mockResolvedValue(undefined);
    useClientContractsMock.mockReturnValue({ data: [] });
  });

  it('renders all form fields', () => {
    render(
      <MemoryRouter>
        <DatosForm
          initial={initialValues}
          onSubmit={onSubmit}
          isSaving={false}
          admins={mockAdmins}
          partners={mockPartners}
        />
      </MemoryRouter>
    );
    expect(screen.getByLabelText(/asignado a/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/partner/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contrato/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/inicia/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/termina/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tiempo de ida/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tiempo de vuelta/i)).toBeInTheDocument();
  });

  it('renders save button', () => {
    render(
      <MemoryRouter>
        <DatosForm
          initial={initialValues}
          onSubmit={onSubmit}
          isSaving={false}
          admins={mockAdmins}
          partners={mockPartners}
        />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeInTheDocument();
  });

  it('calls onSubmit when form is submitted', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DatosForm
          initial={{ ...initialValues, projectId: 'proj-1' }}
          onSubmit={onSubmit}
          isSaving={false}
          admins={mockAdmins}
          partners={mockPartners}
          projects={mockProjects}
        />
      </MemoryRouter>
    );
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  });

  it('shows inline error when endDate is before startDate', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DatosForm
          initial={{
            ...initialValues,
            projectId: 'proj-1',
            startDate: '2026-06-10T10:00',
            endDate: '2026-06-09T10:00',
          }}
          onSubmit={onSubmit}
          isSaving={false}
          admins={mockAdmins}
          partners={mockPartners}
          projects={mockProjects}
        />
      </MemoryRouter>
    );
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));
    await waitFor(() => {
      expect(screen.getByText(/fecha de fin/i)).toBeInTheDocument();
    });
  });

  it('disables save button while saving', () => {
    render(
      <MemoryRouter>
        <DatosForm
          initial={initialValues}
          onSubmit={onSubmit}
          isSaving={true}
          admins={mockAdmins}
          partners={mockPartners}
        />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: /guardando/i })).toBeDisabled();
  });

  it('hydrates the contract select with initial.contractId once contracts load async', async () => {
    // Real-world sequence: on mount the contracts query is still loading (empty),
    // so the matching <option> does not exist yet. The select must re-sync to
    // initial.contractId once the contracts arrive — otherwise it sticks on
    // "Sin contrato" and the task appears contractless after a refresh.
    useClientContractsMock.mockReturnValue({ data: [] });
    const props = {
      initial: { ...initialValues, customerId: 'c-5', contractId: '77' },
      onSubmit,
      isSaving: false,
      admins: mockAdmins,
      partners: mockPartners,
    };
    const { rerender } = render(
      <MemoryRouter>
        <DatosForm {...props} />
      </MemoryRouter>
    );

    // Contracts arrive from the API after mount
    useClientContractsMock.mockReturnValue({
      data: [
        { id: 77, plan: 'Plan 100Mbps', type: 'internet', status: 'active', price: 3000, startDate: '2024-01-01', endDate: null, ipAddress: null, description: '', address: '' },
        { id: 88, plan: 'Plan 50Mbps', type: 'internet', status: 'active', price: 2000, startDate: '2024-01-01', endDate: null, ipAddress: null, description: '', address: '' },
      ],
    });
    rerender(
      <MemoryRouter>
        <DatosForm {...props} />
      </MemoryRouter>
    );

    await waitFor(() => {
      const contractSelect = screen.getByLabelText(/contrato/i) as HTMLSelectElement;
      expect(contractSelect.value).toBe('77');
    });
  });

  it('autofills address from selected contract when contract has address', async () => {
    useClientContractsMock.mockReturnValue({
      data: [
        { id: 77, plan: 'Plan 100Mbps', type: 'internet', status: 'active', price: 3000, startDate: '2024-01-01', endDate: null, ipAddress: null, description: '', address: 'Av. Servicio 2000' },
        { id: 88, plan: 'Plan 50Mbps', type: 'internet', status: 'active', price: 2000, startDate: '2024-01-01', endDate: null, ipAddress: null, description: '', address: 'Calle Otra 50' },
      ],
    });

    render(
      <MemoryRouter>
        <DatosForm
          initial={{ ...initialValues, customerId: 'c-5', address: 'Dirección Original', projectId: 'proj-1' }}
          onSubmit={onSubmit}
          isSaving={false}
          admins={mockAdmins}
          partners={mockPartners}
          projects={mockProjects}
        />
      </MemoryRouter>
    );

    // Select the first contract (has address 'Av. Servicio 2000')
    const contractSelect = screen.getByLabelText(/contrato/i);
    fireEvent.change(contractSelect, { target: { value: '77' } });

    // The form's address field (in the submit payload) should be updated.
    // We verify by submitting and checking the payload.
    await waitFor(async () => {
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /guardar cambios/i }));
    });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ address: 'Av. Servicio 2000' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Async hydration of selects (#2 — refresh loses Asignado + Proyecto)
  // ---------------------------------------------------------------------------
  describe('async hydration (#2 refresh bug)', () => {
    it('hydrates the assignee select with initial.assigneeId once admins load async', async () => {
      // On a cold refresh the RbacUsers query is still loading, so admins=[] and
      // the matching <option> does not exist yet. RHF fixes defaultValues at mount
      // and never re-applies them — the select sticks on "Sin asignar". It must
      // re-sync once the options arrive.
      const props = {
        initial: { ...initialValues, assigneeId: 'admin-1' },
        onSubmit,
        isSaving: false,
        partners: mockPartners,
        projects: mockProjects,
      };
      const { rerender } = render(
        <MemoryRouter><DatosForm {...props} admins={[]} /></MemoryRouter>
      );
      // Empty options at mount → select cannot show the value yet
      expect((screen.getByLabelText(/asignado a/i) as HTMLSelectElement).value).toBe('');

      // Admins arrive from the API
      rerender(<MemoryRouter><DatosForm {...props} admins={mockAdmins} /></MemoryRouter>);

      await waitFor(() => {
        expect((screen.getByLabelText(/asignado a/i) as HTMLSelectElement).value).toBe('admin-1');
      });
    });

    it('hydrates the project select with initial.projectId once projects load async', async () => {
      const props = {
        initial: { ...initialValues, projectId: 'proj-2' },
        onSubmit,
        isSaving: false,
        admins: mockAdmins,
        partners: mockPartners,
      };
      const { rerender } = render(
        <MemoryRouter><DatosForm {...props} projects={[]} /></MemoryRouter>
      );
      expect((screen.getByLabelText(/proyecto/i) as HTMLSelectElement).value).toBe('');

      rerender(<MemoryRouter><DatosForm {...props} projects={mockProjects} /></MemoryRouter>);

      await waitFor(() => {
        expect((screen.getByLabelText(/proyecto/i) as HTMLSelectElement).value).toBe('proj-2');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Date/time validation (REQ-DATE-1..4)
  // ---------------------------------------------------------------------------

  describe('date/time validation', () => {
    const baseProps = {
      onSubmit,
      isSaving: false,
      admins: mockAdmins,
      partners: mockPartners,
      projects: mockProjects,
    } as const;

    it('disables End input when Start is empty', () => {
      render(
        <MemoryRouter>
          <DatosForm
            initial={{ ...initialValues, startDate: null, endDate: null }}
            {...baseProps}
          />
        </MemoryRouter>
      );
      const endInput = screen.getByLabelText(/termina/i) as HTMLInputElement;
      expect(endInput).toBeDisabled();
    });

    it('enables End input when Start has a value', () => {
      render(
        <MemoryRouter>
          <DatosForm
            initial={{ ...initialValues, startDate: '2026-06-10T10:00', endDate: null }}
            {...baseProps}
          />
        </MemoryRouter>
      );
      const endInput = screen.getByLabelText(/termina/i) as HTMLInputElement;
      expect(endInput).not.toBeDisabled();
    });

    it('auto-defaults End to Start + 1 hour when End is empty and user sets Start', async () => {
      render(
        <MemoryRouter>
          <DatosForm
            initial={{ ...initialValues, projectId: 'proj-1', startDate: null, endDate: null }}
            {...baseProps}
          />
        </MemoryRouter>
      );
      const startInput = screen.getByLabelText(/inicia/i) as HTMLInputElement;
      fireEvent.change(startInput, { target: { value: '2026-06-10T10:00' } });

      await waitFor(() => {
        const endInput = screen.getByLabelText(/termina/i) as HTMLInputElement;
        expect(endInput.value).toBe('2026-06-10T11:00');
        expect(endInput).not.toBeDisabled();
      });
    });

    it('does NOT override End when End already has a value and Start changes', async () => {
      render(
        <MemoryRouter>
          <DatosForm
            initial={{
              ...initialValues,
              projectId: 'proj-1',
              startDate: '2026-06-10T10:00',
              endDate: '2026-06-10T12:30',
            }}
            {...baseProps}
          />
        </MemoryRouter>
      );
      const endInput = screen.getByLabelText(/termina/i) as HTMLInputElement;
      const endBefore = endInput.value;
      expect(endBefore).not.toBe('');

      const startInput = screen.getByLabelText(/inicia/i) as HTMLInputElement;
      fireEvent.change(startInput, { target: { value: '2026-06-11T08:00' } });

      // End must remain exactly as it was before the Start change
      await new Promise((r) => setTimeout(r, 50));
      expect((screen.getByLabelText(/termina/i) as HTMLInputElement).value).toBe(endBefore);
    });
  });

  // ---------------------------------------------------------------------------
  // Project select (FASE 4)
  // ---------------------------------------------------------------------------

  describe('project select', () => {
    it('renders project select with sorted options and placeholder', () => {
      render(
        <MemoryRouter>
          <DatosForm
            initial={{ ...initialValues, projectId: null }}
            onSubmit={onSubmit}
            isSaving={false}
            admins={mockAdmins}
            partners={mockPartners}
            projects={mockProjects}
          />
        </MemoryRouter>
      );
      const select = screen.getByLabelText(/proyecto/i) as HTMLSelectElement;
      expect(select).toBeInTheDocument();
      const options = Array.from(select.options).map(o => o.text);
      // Sorted: Alpha before Zeta; placeholder first
      expect(options[0]).toMatch(/seleccionar proyecto/i);
      expect(options[1]).toBe('Proyecto Alpha');
      expect(options[2]).toBe('Proyecto Zeta');
    });

    it('refuses submit when no project selected and shows error', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <DatosForm
            initial={{ ...initialValues, projectId: null }}
            onSubmit={onSubmit}
            isSaving={false}
            admins={mockAdmins}
            partners={mockPartners}
            projects={mockProjects}
          />
        </MemoryRouter>
      );
      await user.click(screen.getByRole('button', { name: /guardar cambios/i }));
      await waitFor(() => {
        expect(screen.getByText(/proyecto requerido/i)).toBeInTheDocument();
      });
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('submits successfully when a project is selected', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <DatosForm
            initial={{ ...initialValues, projectId: null }}
            onSubmit={onSubmit}
            isSaving={false}
            admins={mockAdmins}
            partners={mockPartners}
            projects={mockProjects}
          />
        </MemoryRouter>
      );
      fireEvent.change(screen.getByLabelText(/proyecto/i), { target: { value: 'proj-1' } });
      await user.click(screen.getByRole('button', { name: /guardar cambios/i }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'proj-1' })
      ));
    });

    it('hydrates select with initial projectId', () => {
      render(
        <MemoryRouter>
          <DatosForm
            initial={{ ...initialValues, projectId: 'proj-2' }}
            onSubmit={onSubmit}
            isSaving={false}
            admins={mockAdmins}
            partners={mockPartners}
            projects={mockProjects}
          />
        </MemoryRouter>
      );
      const select = screen.getByLabelText(/proyecto/i) as HTMLSelectElement;
      expect(select.value).toBe('proj-2');
    });
  });

  // ---------------------------------------------------------------------------
  // Timezone round-trip (TZ-BUG-1) — must not shift date when saving unchanged
  // ---------------------------------------------------------------------------

  describe('timezone round-trip', () => {
    it('preserves UTC ISO startDate when user saves without changes (ARG 18:00 = UTC 21:00)', async () => {
      // Regression: toLocalInput() was using toISOString().slice(0,16) which
      // produces a UTC time string. The datetime-local input then interprets it
      // as LOCAL time, so toIso() on submit shifts it by the UTC offset (+3h
      // for Argentina UTC-3). '2026-06-01T21:00:00.000Z' → stored as
      // '2026-06-02T00:00:00.000Z' after a single save without changes.
      const user = userEvent.setup();
      const startDateUtc = '2026-06-01T21:00:00.000Z';
      render(
        <MemoryRouter>
          <DatosForm
            initial={{
              ...initialValues,
              projectId: 'proj-1',
              startDate: startDateUtc,
              endDate: null,
            }}
            onSubmit={onSubmit}
            isSaving={false}
            admins={mockAdmins}
            partners={mockPartners}
            projects={mockProjects}
          />
        </MemoryRouter>
      );
      await user.click(screen.getByRole('button', { name: /guardar cambios/i }));
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ startDate: startDateUtc }),
        );
      });
    });
  });

  // ---------------------------------------------------------------------------
  // IClass warning (FASE 5)
  // ---------------------------------------------------------------------------

  describe('IClass warning', () => {
    const warningText = /ya tiene OS en IClass/i;

    it('hidden when iclassOrderCode is null', () => {
      render(
        <MemoryRouter>
          <DatosForm
            initial={{ ...initialValues, projectId: 'proj-1' }}
            onSubmit={onSubmit}
            isSaving={false}
            admins={mockAdmins}
            partners={mockPartners}
            projects={mockProjects}
            iclassOrderCode={null}
            originalProjectId="proj-1"
          />
        </MemoryRouter>
      );
      expect(screen.queryByText(warningText)).not.toBeInTheDocument();
    });

    it('hidden when project has not changed', () => {
      render(
        <MemoryRouter>
          <DatosForm
            initial={{ ...initialValues, projectId: 'proj-1' }}
            onSubmit={onSubmit}
            isSaving={false}
            admins={mockAdmins}
            partners={mockPartners}
            projects={mockProjects}
            iclassOrderCode="OS-42"
            originalProjectId="proj-1"
          />
        </MemoryRouter>
      );
      expect(screen.queryByText(warningText)).not.toBeInTheDocument();
    });

    it('visible when iclassOrderCode is set AND project changed', async () => {
      render(
        <MemoryRouter>
          <DatosForm
            initial={{ ...initialValues, projectId: 'proj-1' }}
            onSubmit={onSubmit}
            isSaving={false}
            admins={mockAdmins}
            partners={mockPartners}
            projects={mockProjects}
            iclassOrderCode="OS-42"
            originalProjectId="proj-1"
          />
        </MemoryRouter>
      );
      // Change to a different project
      fireEvent.change(screen.getByLabelText(/proyecto/i), { target: { value: 'proj-2' } });
      await waitFor(() => {
        expect(screen.getByText(warningText)).toBeInTheDocument();
      });
    });

    it('disappears when user reverts to original project', async () => {
      render(
        <MemoryRouter>
          <DatosForm
            initial={{ ...initialValues, projectId: 'proj-1' }}
            onSubmit={onSubmit}
            isSaving={false}
            admins={mockAdmins}
            partners={mockPartners}
            projects={mockProjects}
            iclassOrderCode="OS-42"
            originalProjectId="proj-1"
          />
        </MemoryRouter>
      );
      fireEvent.change(screen.getByLabelText(/proyecto/i), { target: { value: 'proj-2' } });
      await waitFor(() => expect(screen.getByText(warningText)).toBeInTheDocument());
      fireEvent.change(screen.getByLabelText(/proyecto/i), { target: { value: 'proj-1' } });
      await waitFor(() => expect(screen.queryByText(warningText)).not.toBeInTheDocument());
    });
  });
});
