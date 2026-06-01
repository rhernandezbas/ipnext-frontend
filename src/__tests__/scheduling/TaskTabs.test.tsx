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
      contractId: null,
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
    onChange: vi.fn(),
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

  it('renders exactly 6 tabs in correct order with correct labels (no Adjuntos)', () => {
    render(<TaskTabs {...makeProps()} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(6);
    expect(tabs[0]).toHaveTextContent('Detalles');
    expect(tabs[1]).toHaveTextContent('Comentarios');
    expect(tabs[2]).toHaveTextContent('Relacionado');
    expect(tabs[3]).toHaveTextContent('Inventory');
    expect(tabs[4]).toHaveTextContent('Registro de trabajo');
    expect(tabs[5]).toHaveTextContent('Actividad');
  });

  it('does not render an Adjuntos tab', () => {
    render(<TaskTabs {...makeProps()} />);
    const tabs = screen.getAllByRole('tab');
    for (const tab of tabs) {
      expect(tab).not.toHaveTextContent('Adjuntos');
    }
  });

  it('defaults to Detalles tab selected (aria-selected=true)', () => {
    render(<TaskTabs {...makeProps()} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    for (let i = 1; i < tabs.length; i++) {
      expect(tabs[i]).toHaveAttribute('aria-selected', 'false');
    }
  });

  it('Detalles content is visible on load', () => {
    render(<TaskTabs {...makeProps()} />);
    expect(screen.getByTestId('datos-form')).toBeInTheDocument();
  });

  it('Comentarios content is NOT in the DOM on initial load (lazy)', () => {
    render(<TaskTabs {...makeProps()} />);
    expect(screen.queryByTestId('task-comments-timeline')).not.toBeInTheDocument();
  });

  it('clicking Comentarios mounts the (mocked) timeline', async () => {
    const user = userEvent.setup();
    render(<TaskTabs {...makeProps()} />);

    const tabs = screen.getAllByRole('tab');
    await user.click(tabs[1]); // Comentarios

    expect(screen.getByTestId('task-comments-timeline')).toBeInTheDocument();
    expect(screen.getByTestId('task-comments-timeline')).toHaveAttribute(
      'data-task-id',
      'task-1',
    );
  });

  it('switching back to Detalles keeps Comentarios mounted (lazy mount memory)', async () => {
    const user = userEvent.setup();
    render(<TaskTabs {...makeProps()} />);

    const tabs = screen.getAllByRole('tab');

    await user.click(tabs[1]); // Comentarios
    expect(screen.getByTestId('task-comments-timeline')).toBeInTheDocument();

    await user.click(tabs[0]); // back to Detalles
    expect(screen.getByTestId('datos-form')).toBeInTheDocument();
    expect(screen.getByTestId('task-comments-timeline')).toBeInTheDocument();
  });

  it('Relacionado shows an empty state when the task has no linked ticket', async () => {
    const user = userEvent.setup();
    render(<TaskTabs {...makeProps()} />);
    const tabs = screen.getAllByRole('tab');
    await user.click(tabs[2]); // Relacionado
    expect(screen.getByText(/no está vinculada a ningún ticket/i)).toBeInTheDocument();
  });

  it('Relacionado renders a linked-ticket card when ticketId is present', async () => {
    const user = userEvent.setup();
    render(<TaskTabs {...makeProps({ ticketId: 42, ticketSubject: 'Sin internet' })} />);
    const tabs = screen.getAllByRole('tab');
    await user.click(tabs[2]); // Relacionado
    const link = screen.getByRole('link', { name: /#42/ });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/admin/tickets/42');
    expect(screen.getByText(/Sin internet/)).toBeInTheDocument();
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
    await user.click(tabs[3]); // Inventory

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
    await user.click(tabs[3]);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('Registro de trabajo renders ComingSoonPanel', async () => {
    const user = userEvent.setup();
    render(<TaskTabs {...makeProps()} />);
    const tabs = screen.getAllByRole('tab');
    await user.click(tabs[4]);
    expect(screen.getAllByText('Próximamente').length).toBeGreaterThan(0);
  });

  it('Actividad renders ComingSoonPanel', async () => {
    const user = userEvent.setup();
    render(<TaskTabs {...makeProps()} />);
    const tabs = screen.getAllByRole('tab');
    await user.click(tabs[5]);
    expect(screen.getAllByText('Próximamente').length).toBeGreaterThan(0);
  });
});
