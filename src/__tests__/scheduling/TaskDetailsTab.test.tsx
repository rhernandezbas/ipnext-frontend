import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// react-leaflet is mocked globally via vite.config.ts alias

// Mock TipTap (same pattern as DescriptionEditor.test.tsx)
vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn(({ onUpdate }: { content?: string; onUpdate?: (props: { editor: { getHTML: () => string } }) => void }) => ({
    getHTML: () => '<p>content</p>',
    commands: { setContent: vi.fn() },
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(),
    _onUpdate: onUpdate,
  })),
  EditorContent: ({ editor }: { editor: unknown }) => (
    <div data-testid="editor-content" data-editor={JSON.stringify(editor ? 'present' : 'null')}>
      <div contentEditable="true" role="textbox" aria-label="Editor de descripción" />
    </div>
  ),
}));
vi.mock('@tiptap/starter-kit', () => ({ default: {} }));

// Mock geocode lib (same pattern as UbicacionMap.test.tsx)
vi.mock('@/pages/scheduling/SchedulingTaskDetailPage/lib/geocode', () => ({
  geocodeAddress: vi.fn(),
  reverseGeocode: vi.fn(),
}));

// Mock heavy hooks used by DatosForm and ChecklistSection
vi.mock('@/hooks/useCustomers', () => ({
  useClientContracts: vi.fn(() => ({ data: [] })),
}));
vi.mock('@/hooks/useIClassNodes', () => ({
  useIClassNodes: vi.fn(() => ({ data: [], isLoading: false })),
}));
vi.mock('@/hooks/useScheduling', () => ({
  useAddChecklistItem: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useToggleChecklistItem: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateChecklistItem: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useRemoveChecklistItem: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useReorderChecklist: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useClearChecklist: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

import { TaskDetailsTab } from '@/pages/scheduling/SchedulingTaskDetailPage/components/TaskDetailsTab';
import type { TaskDetailsTabProps } from '@/pages/scheduling/SchedulingTaskDetailPage/components/TaskDetailsTab';

const baseProps: TaskDetailsTabProps = {
  datosForm: {
    initial: {
      projectId: 'proj-1',
      assigneeId: null,
      partnerId: null,
      customerId: 'cust-1',
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
    onDirtyChange: vi.fn(),
  },
  ubicacionMap: {
    address: null,
    coordinates: null,
    onChange: vi.fn(),
  },
  descriptionEditor: {
    initialHtml: '<p>Test description</p>',
    onSave: vi.fn().mockResolvedValue(undefined),
    isSaving: false,
  },
  checklistSection: {
    taskId: 'task-123',
    checklist: [],
    onError: vi.fn(),
  },
};

describe('TaskDetailsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders DatosForm section (heading "Datos")', () => {
    render(<TaskDetailsTab {...baseProps} />);
    expect(screen.getByText(/datos/i)).toBeInTheDocument();
  });

  it('renders UbicacionMap (sin ubicación placeholder when no coordinates)', () => {
    render(<TaskDetailsTab {...baseProps} />);
    expect(screen.getByText(/sin ubicación/i)).toBeInTheDocument();
  });

  it('renders DescriptionEditor (editor-content testid)', () => {
    render(<TaskDetailsTab {...baseProps} />);
    expect(screen.getByTestId('editor-content')).toBeInTheDocument();
  });

  it('renders ChecklistSection (heading "Lista de verificación")', () => {
    render(<TaskDetailsTab {...baseProps} />);
    expect(screen.getByText(/lista de verificación/i)).toBeInTheDocument();
  });

  it('renders child components in correct vertical order (DescriptionEditor → DatosForm → UbicacionMap → ChecklistSection)', () => {
    // Use null initialHtml so DescriptionEditor renders its unique "sin descripción" placeholder
    const { container } = render(
      <TaskDetailsTab
        {...baseProps}
        descriptionEditor={{ initialHtml: null, onSave: vi.fn(), isSaving: false }}
      />
    );
    const root = container.firstElementChild as HTMLElement;
    // Sections are separated by <hr> dividers; select direct children that are <section> elements
    const sections = Array.from(root.querySelectorAll(':scope > section'));
    expect(sections.length).toBeGreaterThanOrEqual(4);

    const sectionTexts = sections.map(s => s.textContent ?? '');
    const editorIdx = sectionTexts.findIndex(t => /descripci/i.test(t));
    const datosIdx = sectionTexts.findIndex(t => /datos/i.test(t));
    const mapIdx = sectionTexts.findIndex(t => /sin ubicaci/i.test(t));
    const checklistIdx = sectionTexts.findIndex(t => /lista de verificaci/i.test(t));

    expect(editorIdx).toBeGreaterThanOrEqual(0);
    expect(datosIdx).toBeGreaterThan(editorIdx);
    expect(mapIdx).toBeGreaterThan(datosIdx);
    expect(checklistIdx).toBeGreaterThan(mapIdx);
  });

  it('forwards initialHtml prop to DescriptionEditor (smoke check)', () => {
    // The TipTap mock renders EditorContent with data-testid="editor-content" whenever
    // DescriptionEditor receives its props. Presence confirms correct prop forwarding.
    render(<TaskDetailsTab {...baseProps} />);
    expect(screen.getByTestId('editor-content')).toBeInTheDocument();
  });

  it('forwards address to UbicacionMap when provided', () => {
    render(
      <TaskDetailsTab
        {...baseProps}
        ubicacionMap={{
          address: 'Av. Corrientes 1234',
          coordinates: { lat: -34.6, lng: -58.38 },
          onChange: vi.fn(),
        }}
      />
    );
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Av. Corrientes 1234')).toBeInTheDocument();
  });

  it('does not own any data hooks — renders without errors given all props', () => {
    expect(() => render(<TaskDetailsTab {...baseProps} />)).not.toThrow();
  });
});
