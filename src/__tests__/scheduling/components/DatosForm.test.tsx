import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DatosForm } from '@/pages/scheduling/SchedulingTaskDetailPage/components/DatosForm';
import type { Admin } from '@/types/admin';
import type { Partner } from '@/types/partner';

// Stub useClientServices so DatosForm can be rendered without a real API.
const useClientServicesMock = vi.fn(() => ({ data: [] as unknown[] }));
vi.mock('@/hooks/useCustomers', () => ({
  useClientServices: () => useClientServicesMock(),
}));

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
    useClientServicesMock.mockReturnValue({ data: [] });
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

  it('autofills address from selected service when service has address', async () => {
    useClientServicesMock.mockReturnValue({
      data: [
        { id: 77, plan: 'Plan 100Mbps', type: 'internet', status: 'active', price: 3000, startDate: '2024-01-01', endDate: null, ipAddress: null, description: '', address: 'Av. Servicio 2000' },
        { id: 88, plan: 'Plan 50Mbps', type: 'internet', status: 'active', price: 2000, startDate: '2024-01-01', endDate: null, ipAddress: null, description: '', address: 'Calle Otra 50' },
      ],
    });

    render(
      <MemoryRouter>
        <DatosForm
          initial={{ ...initialValues, customerId: 'c-5', address: 'Dirección Original' }}
          onSubmit={onSubmit}
          isSaving={false}
          admins={mockAdmins}
          partners={mockPartners}
        />
      </MemoryRouter>
    );

    // Select the first service (has address 'Av. Servicio 2000')
    const serviceSelect = screen.getByLabelText(/servicio/i);
    fireEvent.change(serviceSelect, { target: { value: '77' } });

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
});
