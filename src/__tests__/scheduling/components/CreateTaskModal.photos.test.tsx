import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Same hook stubs as CreateTaskModal.test.tsx so the modal renders without a
// QueryClientProvider.
const useClientListMock = vi.fn(() => ({ data: { data: [] as unknown[], total: 0, page: 1, pageSize: 20, totalPages: 0 }, isFetching: false }));
const useClientDetailMock = vi.fn(() => ({ data: undefined as unknown }));
const useClientContractsMock = vi.fn(() => ({ data: [] as unknown[], isLoading: false }));
vi.mock('@/hooks/useCustomers', () => ({
  useClientList: () => useClientListMock(),
  useClientDetail: () => useClientDetailMock(),
  useClientContracts: () => useClientContractsMock(),
}));
vi.mock('@/hooks/useTaskCategories', () => ({
  useTaskCategories: () => ({ data: [{ id: 'c5', name: 'Otro', description: null }] }),
}));
vi.mock('@/hooks/useTaskPriorities', () => ({
  useTaskPriorities: () => ({ data: [{ id: 'p2', name: 'Normal', color: '#3b82f6', weight: 2 }] }),
}));
vi.mock('@/hooks/useNetworkSites', () => ({
  useNetworkSites: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/hooks/useIClassNodes', () => ({
  useIClassNodes: () => ({ data: [] }),
}));

import { CreateTaskModal } from '@/pages/scheduling/SchedulingTasksPage/components/CreateTaskModal';
import { useCan } from '@/hooks/useMyPermissions';
import type { Project } from '@/types/project';
import type { Workflow } from '@/types/workflow';

const workflows: Workflow[] = [
  {
    id: 'wf-1',
    name: 'Default',
    description: null,
    createdAt: '',
    updatedAt: '',
    stages: [
      { id: 'stage-new', workflowId: 'wf-1', name: 'Nuevo', category: 'nuevo', code: 'nuevo', order: 0 },
    ],
  },
];
const projects: Project[] = [
  { id: 'proj-1', title: 'Instalaciones', description: null, workflowId: 'wf-1', createdAt: '', updatedAt: '' },
];

const onClose = vi.fn();
const onCreate = vi.fn();
const onUploadPhotos = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useCan).mockReturnValue(true); // scheduling.write granted by default
  onCreate.mockResolvedValue({ id: 'new-task-1' });
  onUploadPhotos.mockResolvedValue([]);
  useClientListMock.mockReturnValue({ data: { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 }, isFetching: false });
  useClientDetailMock.mockReturnValue({ data: undefined });
  useClientContractsMock.mockReturnValue({ data: [], isLoading: false });
  // jsdom doesn't implement object URLs — stub them for the local previews.
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  globalThis.URL.revokeObjectURL = vi.fn();
});

/** Render with a fully filled customer form so the submit button is enabled. */
async function setupFullForm() {
  const customer = { id: 'c-full', name: 'FULL CUSTOMER', email: 'full@test.com' };
  useClientListMock.mockReturnValue({ data: { data: [customer], total: 1, page: 1, pageSize: 20, totalPages: 1 }, isFetching: false });
  useClientDetailMock.mockReturnValue({ data: { id: 'c-full', name: 'FULL CUSTOMER', address: 'Calle Full 1' } });
  useClientContractsMock.mockReturnValue({
    data: [{ id: '1', plan: 'Plan 100Mbps', type: 'internet', status: 'active', price: 3000, startDate: '2024-01-01', endDate: null, description: '', address: null }],
    isLoading: false,
  });
  render(
    <CreateTaskModal
      projects={projects}
      workflows={workflows}
      onClose={onClose}
      onCreate={onCreate}
      onUploadPhotos={onUploadPhotos}
      loading={false}
    />,
  );
  fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Con fotos' } });
  fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'Full' } });
  fireEvent.click(await screen.findByText('FULL CUSTOMER'));
  fireEvent.change(await screen.findByRole('combobox', { name: /contrato/i }), { target: { value: '1' } });
  fireEvent.change(screen.getByRole('combobox', { name: /proyecto/i }), { target: { value: 'proj-1' } });
  fireEvent.change(screen.getByPlaceholderText('Detalles de la tarea…'), { target: { value: 'desc' } });
}

function addPhoto(name = 'foto.jpg') {
  const file = new File(['x'], name, { type: 'image/jpeg' });
  const input = screen.getByTestId('create-photos-input') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
  return file;
}

describe('CreateTaskModal — photo uploader', () => {
  it('adds and removes local photo previews', async () => {
    await setupFullForm();
    addPhoto('frente.jpg');

    const preview = await screen.findByAltText('frente.jpg');
    expect(preview).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /quitar frente\.jpg/i }));
    await waitFor(() => expect(screen.queryByAltText('frente.jpg')).not.toBeInTheDocument());
  });

  it('on submit, creates the task FIRST then uploads the photos with the returned id', async () => {
    await setupFullForm();
    const file = addPhoto('frente.jpg');
    await screen.findByAltText('frente.jpg');

    fireEvent.click(screen.getByRole('button', { name: /crear tarea/i }));

    await waitFor(() => expect(onUploadPhotos).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onUploadPhotos).toHaveBeenCalledWith('new-task-1', [file]);
    // create must run BEFORE upload
    expect(onCreate.mock.invocationCallOrder[0]).toBeLessThan(onUploadPhotos.mock.invocationCallOrder[0]);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('keeps the created task and shows a notice (no close) when the upload fails', async () => {
    onUploadPhotos.mockRejectedValueOnce(new Error('storage down'));
    await setupFullForm();
    addPhoto('frente.jpg');
    await screen.findByAltText('frente.jpg');

    fireEvent.click(screen.getByRole('button', { name: /crear tarea/i }));

    expect(await screen.findByText(/Podés re-subir las fotos desde el detalle/i)).toBeInTheDocument();
    expect(onCreate).toHaveBeenCalledTimes(1); // task WAS created
    expect(onClose).not.toHaveBeenCalled();    // modal stays open with the notice
  });

  it('does not re-create the task if the user retries after an upload failure', async () => {
    onUploadPhotos.mockRejectedValueOnce(new Error('storage down'));
    await setupFullForm();
    addPhoto('frente.jpg');
    await screen.findByAltText('frente.jpg');

    fireEvent.click(screen.getByRole('button', { name: /crear tarea/i }));
    await screen.findByText(/Podés re-subir las fotos desde el detalle/i);

    // In notice mode the footer offers only "Cerrar" — no second create path.
    expect(screen.queryByRole('button', { name: /crear tarea/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledTimes(1); // still only one create
  });

  it('guards against double-submit during the create→upload window (single task, single upload)', async () => {
    // Keep the upload in-flight so we can re-click during the await window —
    // exactly the gap where `loading` alone re-enabled the button.
    let resolveUpload!: (v: unknown) => void;
    onUploadPhotos.mockReturnValueOnce(new Promise((r) => { resolveUpload = r; }));

    await setupFullForm();
    addPhoto('frente.jpg');
    await screen.findByAltText('frente.jpg');

    const btn = screen.getByRole('button', { name: /crear tarea/i });
    fireEvent.click(btn);

    // create resolved, upload is pending → the re-entrancy window
    await waitFor(() => expect(onUploadPhotos).toHaveBeenCalledTimes(1));

    // second submit while the upload is still running (same button node)
    fireEvent.click(btn);

    resolveUpload([]);
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onUploadPhotos).toHaveBeenCalledTimes(1);
  });

  it('shows the specific storage-unavailable message when the post-create upload fails with 503', async () => {
    onUploadPhotos.mockRejectedValueOnce({ response: { status: 503, data: { code: 'STORAGE_NOT_CONFIGURED' } } });
    await setupFullForm();
    addPhoto('frente.jpg');
    await screen.findByAltText('frente.jpg');

    fireEvent.click(screen.getByRole('button', { name: /crear tarea/i }));

    expect(await screen.findByText(/almacenamiento de fotos no está disponible/i)).toBeInTheDocument();
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('revokes the object URL when a photo is removed (no blob leak)', async () => {
    await setupFullForm();
    addPhoto('frente.jpg');
    await screen.findByAltText('frente.jpg');

    fireEvent.click(screen.getByRole('button', { name: /quitar frente\.jpg/i }));

    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url'));
  });

  it('hides the photo uploader without scheduling.write', async () => {
    vi.mocked(useCan).mockReturnValue(false);
    await setupFullForm();
    expect(screen.queryByTestId('create-photos-input')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /agregar fotos/i })).not.toBeInTheDocument();
  });

  it('does not show the uploader when onUploadPhotos is not wired (BE-graceful)', async () => {
    render(
      <CreateTaskModal projects={projects} workflows={workflows} onClose={onClose} onCreate={onCreate} loading={false} />,
    );
    expect(screen.queryByTestId('create-photos-input')).not.toBeInTheDocument();
  });
});
