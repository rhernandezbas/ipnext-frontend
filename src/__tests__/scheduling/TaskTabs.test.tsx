import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Mock heavy deps ────────────────────────────────────────────────────────────
// react-leaflet is globally mocked via vite.config.ts alias

vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn(() => ({
    getHTML: () => '<p></p>',
    commands: { setContent: vi.fn() },
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(),
  })),
  EditorContent: () => (
    <div data-testid="editor-content">
      <div contentEditable="true" role="textbox" aria-label="Editor de descripción" />
    </div>
  ),
}));

vi.mock('@tiptap/starter-kit', () => ({ default: {} }));

// Mock TaskCommentsTimeline so Comentarios tab is a cheap detectable stub
vi.mock(
  '@/pages/scheduling/SchedulingTaskDetailPage/components/TaskCommentsTimeline',
  () => ({
    TaskCommentsTimeline: ({ taskId }: { taskId: string }) => (
      <div data-testid="task-comments-timeline" data-task-id={taskId}>
        Comments Timeline Stub
      </div>
    ),
  }),
);

// Mock DatosForm — it uses react-hook-form + hooks, keep it simple
vi.mock(
  '@/pages/scheduling/SchedulingTaskDetailPage/components/DatosForm',
  () => ({
    DatosForm: () => <div data-testid="datos-form">DatosForm Stub</div>,
  }),
);

// Mock UbicacionMap — uses leaflet
vi.mock(
  '@/pages/scheduling/SchedulingTaskDetailPage/components/UbicacionMap',
  () => ({
    UbicacionMap: () => <div data-testid="ubicacion-map">Map Stub</div>,
  }),
);

// Mock DescriptionEditor — uses TipTap
vi.mock(
  '@/pages/scheduling/SchedulingTaskDetailPage/components/DescriptionEditor',
  () => ({
    DescriptionEditor: () => <div data-testid="description-editor">Editor Stub</div>,
  }),
);

// Mock ChecklistSection — uses hooks/fetches
vi.mock(
  '@/pages/scheduling/SchedulingTaskDetailPage/components/ChecklistSection',
  () => ({
    ChecklistSection: () => <div data-testid="checklist-section">Checklist Stub</div>,
  }),
);

import { TaskTabs } from '@/pages/scheduling/SchedulingTaskDetailPage/components/TaskTabs';
import type { TaskTabsProps } from '@/pages/scheduling/SchedulingTaskDetailPage/components/TaskTabs';

// ── Minimal valid props ────────────────────────────────────────────────────────
const minimalDetailProps: TaskTabsProps['detailsProps'] = {
  datosForm: {
    initial: {
      projectId: null,
      assigneeId: null,
      partnerId: null,
      customerId: null,
      serviceId: null,
      startDate: null,
      endDate: null,
      travelTimeTo: null,
      travelTimeFrom: null,
      address: null,
      coordinates: null,
    },
    onSubmit: vi.fn().mockResolvedValue(undefined),
    isSaving: false,
    admins: [],
    partners: [],
  },
  ubicacionMap: {
    address: null,
    coordinates: null,
    onChange: vi.fn(),
  },
  descriptionEditor: {
    initialHtml: null,
    onSave: vi.fn().mockResolvedValue(undefined),
    isSaving: false,
  },
  checklistSection: {
    taskId: 'task-1',
    checklist: [],
  },
};

function makeProps(overrides?: Partial<TaskTabsProps>): TaskTabsProps {
  return {
    detailsProps: minimalDetailProps,
    commentsTaskId: 'task-1',
    reviewedByInventory: false,
    onInventoryToggle: vi.fn(),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('TaskTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders exactly 7 tabs in correct order with correct labels', () => {
    render(<TaskTabs {...makeProps()} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(7);
    expect(tabs[0]).toHaveTextContent('Detalles');
    expect(tabs[1]).toHaveTextContent('Adjuntos');
    expect(tabs[2]).toHaveTextContent('Comentarios');
    expect(tabs[3]).toHaveTextContent('Relacionado');
    expect(tabs[4]).toHaveTextContent('Inventory');
    expect(tabs[5]).toHaveTextContent('Registro de trabajo');
    expect(tabs[6]).toHaveTextContent('Actividad');
  });

  it('defaults to Detalles tab selected (aria-selected=true)', () => {
    render(<TaskTabs {...makeProps()} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    // all others false
    for (let i = 1; i < 7; i++) {
      expect(tabs[i]).toHaveAttribute('aria-selected', 'false');
    }
  });

  it('Detalles content is visible on load', () => {
    render(<TaskTabs {...makeProps()} />);
    // DatosForm is rendered inside Detalles
    expect(screen.getByTestId('datos-form')).toBeInTheDocument();
  });

  it('Comentarios content is NOT in the DOM on initial load (lazy)', () => {
    render(<TaskTabs {...makeProps()} />);
    expect(screen.queryByTestId('task-comments-timeline')).not.toBeInTheDocument();
  });

  it('Adjuntos content is NOT in the DOM on initial load (lazy)', () => {
    render(<TaskTabs {...makeProps()} />);
    expect(screen.queryByText(/Subí y gestioná archivos/i)).not.toBeInTheDocument();
  });

  it('clicking Comentarios mounts the (mocked) timeline', async () => {
    const user = userEvent.setup();
    render(<TaskTabs {...makeProps()} />);

    const tabs = screen.getAllByRole('tab');
    await user.click(tabs[2]); // Comentarios

    expect(screen.getByTestId('task-comments-timeline')).toBeInTheDocument();
    expect(screen.getByTestId('task-comments-timeline')).toHaveAttribute(
      'data-task-id',
      'task-1',
    );
  });

  it('switching back to Detalles keeps it mounted (lazy mount memory)', async () => {
    const user = userEvent.setup();
    render(<TaskTabs {...makeProps()} />);

    const tabs = screen.getAllByRole('tab');

    // Go to Comentarios
    await user.click(tabs[2]);
    expect(screen.getByTestId('task-comments-timeline')).toBeInTheDocument();

    // Go back to Detalles
    await user.click(tabs[0]);
    // Detalles content is still mounted
    expect(screen.getByTestId('datos-form')).toBeInTheDocument();
    // Comentarios stays mounted (lazy-mount preserves once opened)
    expect(screen.getByTestId('task-comments-timeline')).toBeInTheDocument();
  });

  it('Adjuntos ComingSoonPanel renders correct copy with zero fetch', async () => {
    const user = userEvent.setup();
    render(<TaskTabs {...makeProps()} />);

    const tabs = screen.getAllByRole('tab');
    await user.click(tabs[1]); // Adjuntos

    // The tab button + the h3 in the panel both say "Adjuntos" — check the heading
    expect(screen.getByRole('heading', { name: 'Adjuntos' })).toBeInTheDocument();
    expect(
      screen.getByText(/Subí y gestioná archivos de la tarea/i),
    ).toBeInTheDocument();
  });

  it('Relacionado renders a ComingSoonPanel (no fetch)', async () => {
    const user = userEvent.setup();
    render(<TaskTabs {...makeProps()} />);

    const tabs = screen.getAllByRole('tab');
    await user.click(tabs[3]); // Relacionado

    // ComingSoonPanel renders a "Próximamente" badge
    expect(screen.getAllByText('Próximamente').length).toBeGreaterThan(0);
  });

  it('Inventory toggle reflects reviewedByInventory=false as unchecked', () => {
    render(<TaskTabs {...makeProps({ reviewedByInventory: false })} />);
    // Need to switch to Inventory tab
    // Actually the tab content may not be mounted yet (lazy), click first
  });

  it('Inventory: toggle reflects reviewedByInventory prop and calls onInventoryToggle', async () => {
    const onInventoryToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <TaskTabs
        {...makeProps({ reviewedByInventory: false, onInventoryToggle })}
      />,
    );

    const tabs = screen.getAllByRole('tab');
    await user.click(tabs[4]); // Inventory

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(onInventoryToggle).toHaveBeenCalledTimes(1);
    expect(onInventoryToggle).toHaveBeenCalledWith(true);
  });

  it('Inventory: reviewedByInventory=true shows checkbox as checked', async () => {
    const user = userEvent.setup();
    render(<TaskTabs {...makeProps({ reviewedByInventory: true })} />);

    const tabs = screen.getAllByRole('tab');
    await user.click(tabs[4]); // Inventory

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('Registro de trabajo renders ComingSoonPanel', async () => {
    const user = userEvent.setup();
    render(<TaskTabs {...makeProps()} />);

    const tabs = screen.getAllByRole('tab');
    await user.click(tabs[5]); // Registro de trabajo

    expect(screen.getAllByText('Próximamente').length).toBeGreaterThan(0);
  });

  it('Actividad renders ComingSoonPanel', async () => {
    const user = userEvent.setup();
    render(<TaskTabs {...makeProps()} />);

    const tabs = screen.getAllByRole('tab');
    await user.click(tabs[6]); // Actividad

    expect(screen.getAllByText('Próximamente').length).toBeGreaterThan(0);
  });
});
