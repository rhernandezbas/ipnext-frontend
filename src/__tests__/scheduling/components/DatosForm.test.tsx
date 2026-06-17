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

// Stub useIClassNodes — not relevant for these tests (locality field only shows
// on network+fibra tasks, which these tests don't exercise).
vi.mock('@/hooks/useIClassNodes', () => ({
  useIClassNodes: vi.fn(() => ({ data: [], isLoading: false })),
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

// Mixed list for the kind-filter tests (#40 FIX-3): one customer + one network.
const mixedProjects: Project[] = [
  { id: 'cust-1', title: 'Instalación', description: null, workflowId: null, isNetworkProject: false, createdAt: '', updatedAt: '' },
  { id: 'net-1', title: 'Red - fibra', description: null, workflowId: null, isNetworkProject: true, createdAt: '', updatedAt: '' },
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
        { id: '77', plan: 'Plan 100Mbps', type: 'internet', status: 'active', price: 3000, startDate: '2024-01-01', endDate: null, description: '', address: '' },
        { id: '88', plan: 'Plan 50Mbps', type: 'internet', status: 'active', price: 2000, startDate: '2024-01-01', endDate: null, description: '', address: '' },
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
        { id: '77', plan: 'Plan 100Mbps', type: 'internet', status: 'active', price: 3000, startDate: '2024-01-01', endDate: null, description: '', address: 'Av. Servicio 2000' },
        { id: '88', plan: 'Plan 50Mbps', type: 'internet', status: 'active', price: 2000, startDate: '2024-01-01', endDate: null, description: '', address: 'Calle Otra 50' },
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

    // ── #40 FIX-3: the edit-form project select must filter by the task's kind,
    // mirroring the create modal + the BE UpdateTask guard. Editing a customer
    // task must NOT offer network projects (and vice-versa) — otherwise the
    // operator can reassign a customer task to "Red - fibra" and trip the 422.
    describe('kind filtering (FIX-3)', () => {
      it('customer task: options EXCLUDE network-flagged projects', () => {
        render(
          <MemoryRouter>
            <DatosForm
              initial={{ ...initialValues, projectId: 'cust-1' }}
              onSubmit={onSubmit}
              isSaving={false}
              admins={mockAdmins}
              partners={mockPartners}
              projects={mixedProjects}
              kind="customer"
            />
          </MemoryRouter>
        );
        const options = Array.from((screen.getByLabelText(/proyecto/i) as HTMLSelectElement).options).map(o => o.text);
        expect(options).toContain('Instalación');
        expect(options).not.toContain('Red - fibra');
      });

      it('network task: options are ONLY network-flagged projects', () => {
        render(
          <MemoryRouter>
            <DatosForm
              initial={{ ...initialValues, projectId: 'net-1' }}
              onSubmit={onSubmit}
              isSaving={false}
              admins={mockAdmins}
              partners={mockPartners}
              projects={mixedProjects}
              kind="network"
            />
          </MemoryRouter>
        );
        const options = Array.from((screen.getByLabelText(/proyecto/i) as HTMLSelectElement).options).map(o => o.text);
        expect(options).toContain('Red - fibra');
        expect(options).not.toContain('Instalación');
      });

      it('no kind given: shows all projects (back-compat)', () => {
        render(
          <MemoryRouter>
            <DatosForm
              initial={{ ...initialValues, projectId: 'cust-1' }}
              onSubmit={onSubmit}
              isSaving={false}
              admins={mockAdmins}
              partners={mockPartners}
              projects={mixedProjects}
            />
          </MemoryRouter>
        );
        const options = Array.from((screen.getByLabelText(/proyecto/i) as HTMLSelectElement).options).map(o => o.text);
        expect(options).toContain('Instalación');
        expect(options).toContain('Red - fibra');
      });
    });

    // ── #40 FIX-3 (focused re-review): when the task's CURRENT project is
    // excluded by the kind filter (e.g. a customer task whose project was later
    // flagged isNetworkProject=true), the bare filter hides it and the select
    // shows the placeholder while RHF silently holds the stale id → saving ANY
    // field re-submits the flagged projectId → BE 422 INVALID_PROJECT_KIND.
    // The current project must stay VISIBLE (pinned with a "(fuera de tipo)"
    // suffix) so the value remains valid/selectable and the user can re-pick.
    describe('current project out-of-filter pinning (FIX-3 re-review)', () => {
      // Two flagged network projects + one customer project. A customer task is
      // currently on net-1 (out of its filter); net-2 must stay excluded.
      const reviewProjects: Project[] = [
        { id: 'cust-1', title: 'Instalación', description: null, workflowId: null, isNetworkProject: false, createdAt: '', updatedAt: '' },
        { id: 'net-1', title: 'Red - fibra', description: null, workflowId: null, isNetworkProject: true, createdAt: '', updatedAt: '' },
        { id: 'net-2', title: 'Red - troncal', description: null, workflowId: null, isNetworkProject: true, createdAt: '', updatedAt: '' },
      ];

      it('customer task whose current project is flagged network: pins it, keeps value, excludes the other flagged projects', () => {
        render(
          <MemoryRouter>
            <DatosForm
              initial={{ ...initialValues, projectId: 'net-1' }}
              onSubmit={onSubmit}
              isSaving={false}
              admins={mockAdmins}
              partners={mockPartners}
              projects={reviewProjects}
              kind="customer"
            />
          </MemoryRouter>
        );
        const select = screen.getByLabelText(/proyecto/i) as HTMLSelectElement;
        // The DOM select shows the real current value (not the placeholder).
        expect(select.value).toBe('net-1');
        const options = Array.from(select.options).map(o => o.text);
        // The current project is pinned with the suffix.
        expect(options).toContain('Red - fibra (fuera de tipo)');
        // Customer projects still offered.
        expect(options).toContain('Instalación');
        // The OTHER flagged project is still excluded.
        expect(options).not.toContain('Red - troncal');
        expect(options).not.toContain('Red - troncal (fuera de tipo)');
      });

      it('network task whose current project is NOT flagged: pins it with suffix and keeps value', () => {
        render(
          <MemoryRouter>
            <DatosForm
              initial={{ ...initialValues, projectId: 'cust-1' }}
              onSubmit={onSubmit}
              isSaving={false}
              admins={mockAdmins}
              partners={mockPartners}
              projects={reviewProjects}
              kind="network"
            />
          </MemoryRouter>
        );
        const select = screen.getByLabelText(/proyecto/i) as HTMLSelectElement;
        expect(select.value).toBe('cust-1');
        const options = Array.from(select.options).map(o => o.text);
        expect(options).toContain('Instalación (fuera de tipo)');
        // Network projects still offered.
        expect(options).toContain('Red - fibra');
        expect(options).toContain('Red - troncal');
      });

      it('normal case: current project within filter → no "(fuera de tipo)" option anywhere', () => {
        render(
          <MemoryRouter>
            <DatosForm
              initial={{ ...initialValues, projectId: 'cust-1' }}
              onSubmit={onSubmit}
              isSaving={false}
              admins={mockAdmins}
              partners={mockPartners}
              projects={reviewProjects}
              kind="customer"
            />
          </MemoryRouter>
        );
        const options = Array.from((screen.getByLabelText(/proyecto/i) as HTMLSelectElement).options).map(o => o.text);
        expect(options.some(o => /fuera de tipo/i.test(o))).toBe(false);
      });

      it('saving without touching the project keeps the original (out-of-filter) projectId — no silent change', async () => {
        const user = userEvent.setup();
        render(
          <MemoryRouter>
            <DatosForm
              initial={{ ...initialValues, projectId: 'net-1' }}
              onSubmit={onSubmit}
              isSaving={false}
              admins={mockAdmins}
              partners={mockPartners}
              projects={reviewProjects}
              kind="customer"
            />
          </MemoryRouter>
        );
        await user.click(screen.getByRole('button', { name: /guardar cambios/i }));
        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ projectId: 'net-1' })
        ));
      });
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

  // ---------------------------------------------------------------------------
  // #122 — Bloqueo de asignación de técnico sin cuadrilla IClass
  //
  // Cuando el flag `iclass-assign-action` está ON, elegir un técnico que NO
  // tiene cuadrilla IClass mapeada debe BLOQUEAR la selección: abre un modal
  // de aviso y revierte el <select> al valor previo. Con el flag OFF la
  // asignación es libre. "Sin asignar" (value '') nunca bloquea.
  // ---------------------------------------------------------------------------
  describe('#122 assignee sin cuadrilla IClass', () => {
    const modalText = /no tiene una cuadrilla iclass/i;

    // admin-1 tiene cuadrilla, admin-2 NO.
    const technicianHasTeam = (userId: string) => userId === 'admin-1';

    it('flag OFF: elegir un técnico sin cuadrilla NO bloquea (sin modal, queda elegido)', async () => {
      render(
        <MemoryRouter>
          <DatosForm
            initial={{ ...initialValues, assigneeId: null }}
            onSubmit={onSubmit}
            isSaving={false}
            admins={mockAdmins}
            partners={mockPartners}
            projects={mockProjects}
            iclassAssignActive={false}
            technicianHasTeam={technicianHasTeam}
          />
        </MemoryRouter>
      );
      const select = screen.getByLabelText(/asignado a/i) as HTMLSelectElement;
      fireEvent.change(select, { target: { value: 'admin-2' } });

      expect(screen.queryByText(modalText)).not.toBeInTheDocument();
      expect(select.value).toBe('admin-2');
    });

    it('flag ON + técnico SIN cuadrilla: abre modal y revierte el assignee al valor previo', async () => {
      render(
        <MemoryRouter>
          <DatosForm
            initial={{ ...initialValues, assigneeId: 'admin-1' }}
            onSubmit={onSubmit}
            isSaving={false}
            admins={mockAdmins}
            partners={mockPartners}
            projects={mockProjects}
            iclassAssignActive={true}
            technicianHasTeam={technicianHasTeam}
          />
        </MemoryRouter>
      );
      const select = screen.getByLabelText(/asignado a/i) as HTMLSelectElement;
      // El valor previo es admin-1 (que SÍ tiene cuadrilla).
      expect(select.value).toBe('admin-1');

      // Elijo admin-2 (sin cuadrilla) → debe bloquear.
      fireEvent.change(select, { target: { value: 'admin-2' } });

      // Modal abierto.
      expect(await screen.findByText(modalText)).toBeInTheDocument();
      // El assignee NO debe quedar en admin-2: revierte al valor previo.
      await waitFor(() => {
        expect((screen.getByLabelText(/asignado a/i) as HTMLSelectElement).value).toBe('admin-1');
      });
    });

    it('flag ON + técnico SIN cuadrilla desde "Sin asignar": revierte a vacío', async () => {
      render(
        <MemoryRouter>
          <DatosForm
            initial={{ ...initialValues, assigneeId: null }}
            onSubmit={onSubmit}
            isSaving={false}
            admins={mockAdmins}
            partners={mockPartners}
            projects={mockProjects}
            iclassAssignActive={true}
            technicianHasTeam={technicianHasTeam}
          />
        </MemoryRouter>
      );
      const select = screen.getByLabelText(/asignado a/i) as HTMLSelectElement;
      expect(select.value).toBe('');
      fireEvent.change(select, { target: { value: 'admin-2' } });

      expect(await screen.findByText(modalText)).toBeInTheDocument();
      await waitFor(() => {
        expect((screen.getByLabelText(/asignado a/i) as HTMLSelectElement).value).toBe('');
      });
    });

    it('flag ON + técnico CON cuadrilla: sin modal, queda elegido', async () => {
      render(
        <MemoryRouter>
          <DatosForm
            initial={{ ...initialValues, assigneeId: null }}
            onSubmit={onSubmit}
            isSaving={false}
            admins={mockAdmins}
            partners={mockPartners}
            projects={mockProjects}
            iclassAssignActive={true}
            technicianHasTeam={technicianHasTeam}
          />
        </MemoryRouter>
      );
      const select = screen.getByLabelText(/asignado a/i) as HTMLSelectElement;
      fireEvent.change(select, { target: { value: 'admin-1' } });

      expect(screen.queryByText(modalText)).not.toBeInTheDocument();
      expect(select.value).toBe('admin-1');
    });

    it('flag ON + "Sin asignar" (value vacío) nunca bloquea', async () => {
      render(
        <MemoryRouter>
          <DatosForm
            initial={{ ...initialValues, assigneeId: 'admin-1' }}
            onSubmit={onSubmit}
            isSaving={false}
            admins={mockAdmins}
            partners={mockPartners}
            projects={mockProjects}
            iclassAssignActive={true}
            technicianHasTeam={technicianHasTeam}
          />
        </MemoryRouter>
      );
      const select = screen.getByLabelText(/asignado a/i) as HTMLSelectElement;
      // Pasar a "Sin asignar" desde un técnico con cuadrilla.
      fireEvent.change(select, { target: { value: '' } });

      expect(screen.queryByText(modalText)).not.toBeInTheDocument();
      expect(select.value).toBe('');
    });

    it('cerrar el modal ("Entendido") lo oculta y mantiene el valor revertido', async () => {
      render(
        <MemoryRouter>
          <DatosForm
            initial={{ ...initialValues, assigneeId: 'admin-1' }}
            onSubmit={onSubmit}
            isSaving={false}
            admins={mockAdmins}
            partners={mockPartners}
            projects={mockProjects}
            iclassAssignActive={true}
            technicianHasTeam={technicianHasTeam}
          />
        </MemoryRouter>
      );
      const select = screen.getByLabelText(/asignado a/i) as HTMLSelectElement;
      fireEvent.change(select, { target: { value: 'admin-2' } });
      expect(await screen.findByText(modalText)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /entendido/i }));

      await waitFor(() => expect(screen.queryByText(modalText)).not.toBeInTheDocument());
      expect((screen.getByLabelText(/asignado a/i) as HTMLSelectElement).value).toBe('admin-1');
    });

    // ── WARNING #2 — un intento BLOQUEADO no debe dejar el form DIRTY ─────────
    // Hoy el handler hace assigneeReg.onChange(e) (marca dirty) y después
    // setValue(prev, {shouldDirty:false}) (no limpia el dirty ya aplicado), así
    // que isDirty queda true → onDirtyChange(true) sin cambio real. El fix: NO
    // commitear el cambio bloqueado a RHF, así nunca se marca dirty.
    it('intento bloqueado NO marca el form como dirty (onDirtyChange nunca con true) (#122 WARNING-2)', async () => {
      const onDirtyChange = vi.fn();
      render(
        <MemoryRouter>
          <DatosForm
            initial={{ ...initialValues, assigneeId: 'admin-1' }}
            onSubmit={onSubmit}
            isSaving={false}
            admins={mockAdmins}
            partners={mockPartners}
            projects={mockProjects}
            iclassAssignActive={true}
            technicianHasTeam={technicianHasTeam}
            onDirtyChange={onDirtyChange}
          />
        </MemoryRouter>
      );
      const select = screen.getByLabelText(/asignado a/i) as HTMLSelectElement;
      // Intento bloqueado: elijo admin-2 (sin cuadrilla).
      fireEvent.change(select, { target: { value: 'admin-2' } });

      // El modal abre (confirma que el intento fue bloqueado).
      expect(await screen.findByText(modalText)).toBeInTheDocument();
      // El select revirtió a admin-1.
      await waitFor(() => {
        expect((screen.getByLabelText(/asignado a/i) as HTMLSelectElement).value).toBe('admin-1');
      });
      // CLAVE: onDirtyChange jamás debe haberse llamado con true por un intento
      // bloqueado (no hubo cambio real).
      expect(onDirtyChange).not.toHaveBeenCalledWith(true);
    });

    // Paridad: un cambio NO bloqueado (técnico con cuadrilla) SÍ debe marcar dirty.
    it('cambio NO bloqueado (técnico con cuadrilla) SÍ marca dirty (#122 WARNING-2 paridad)', async () => {
      const onDirtyChange = vi.fn();
      render(
        <MemoryRouter>
          <DatosForm
            initial={{ ...initialValues, assigneeId: 'admin-2' }}
            onSubmit={onSubmit}
            isSaving={false}
            admins={mockAdmins}
            partners={mockPartners}
            projects={mockProjects}
            iclassAssignActive={true}
            technicianHasTeam={technicianHasTeam}
            onDirtyChange={onDirtyChange}
          />
        </MemoryRouter>
      );
      const select = screen.getByLabelText(/asignado a/i) as HTMLSelectElement;
      // admin-1 SÍ tiene cuadrilla → cambio permitido → debe marcar dirty.
      fireEvent.change(select, { target: { value: 'admin-1' } });

      await waitFor(() => expect(onDirtyChange).toHaveBeenCalledWith(true));
      expect((screen.getByLabelText(/asignado a/i) as HTMLSelectElement).value).toBe('admin-1');
    });
  });
});
