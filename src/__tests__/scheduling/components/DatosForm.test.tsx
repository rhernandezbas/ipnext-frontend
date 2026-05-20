import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DatosForm } from '@/pages/scheduling/SchedulingTaskDetailPage/components/DatosForm';
import type { Admin } from '@/types/admin';
import type { Partner } from '@/types/partner';

const mockAdmins: Admin[] = [
  { id: 'admin-1', name: 'Juan Pérez', email: 'juan@example.com', role: 'admin', status: 'active', createdAt: '', lastLogin: null },
  { id: 'admin-2', name: 'Ana García', email: 'ana@example.com', role: 'admin', status: 'active', createdAt: '', lastLogin: null },
];

const mockPartners: Partner[] = [
  { id: 'partner-1', name: 'Partner A', status: 'active', primaryEmail: '', phone: '', address: '', city: '', country: '', timezone: '', currency: '', logoUrl: null, clientCount: 0, adminCount: 0, createdAt: '' },
];

const initialValues = {
  projectId: null,
  assigneeId: 'admin-1',
  partnerId: null,
  customerId: null,
  serviceId: null,
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
    expect(screen.getByLabelText(/servicio/i)).toBeInTheDocument();
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
          initial={initialValues}
          onSubmit={onSubmit}
          isSaving={false}
          admins={mockAdmins}
          partners={mockPartners}
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
            startDate: '2026-06-10T10:00',
            endDate: '2026-06-09T10:00',
          }}
          onSubmit={onSubmit}
          isSaving={false}
          admins={mockAdmins}
          partners={mockPartners}
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
});
