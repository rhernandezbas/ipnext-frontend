import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock TipTap since it doesn't work well in jsdom
vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn(({ onUpdate }: { content?: string; onUpdate?: (props: { editor: { getHTML: () => string } }) => void }) => ({
    getHTML: () => '<p>content</p>',
    commands: { setContent: vi.fn() },
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(),
    // Simulate calling onUpdate to set dirty
    _onUpdate: onUpdate,
  })),
  EditorContent: ({ editor }: { editor: unknown }) => (
    <div data-testid="editor-content" data-editor={JSON.stringify(editor ? 'present' : 'null')}>
      <div contentEditable="true" role="textbox" aria-label="Editor de descripción" />
    </div>
  ),
}));

vi.mock('@tiptap/starter-kit', () => ({ default: {} }));

import { DescriptionEditor } from '@/pages/scheduling/SchedulingTaskDetailPage/components/DescriptionEditor';

describe('DescriptionEditor', () => {
  const onSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onSave.mockResolvedValue(undefined);
  });

  it('renders the editor area', () => {
    render(
      <DescriptionEditor
        initialHtml="<p>Hola</p>"
        onSave={onSave}
        isSaving={false}
      />
    );
    expect(screen.getByTestId('editor-content')).toBeInTheDocument();
  });

  it('shows save button', () => {
    render(
      <DescriptionEditor
        initialHtml="<p>Hola</p>"
        onSave={onSave}
        isSaving={false}
      />
    );
    expect(screen.getByRole('button', { name: /guardar/i })).toBeInTheDocument();
  });

  it('disables save button when not dirty', () => {
    render(
      <DescriptionEditor
        initialHtml="<p>Hola</p>"
        onSave={onSave}
        isSaving={false}
      />
    );
    const btn = screen.getByRole('button', { name: /guardar/i });
    expect(btn).toBeDisabled();
  });

  it('shows placeholder when initialHtml is null', () => {
    render(
      <DescriptionEditor
        initialHtml={null}
        onSave={onSave}
        isSaving={false}
      />
    );
    expect(screen.getByText(/sin descripción/i)).toBeInTheDocument();
  });

  it('disables save button while saving', () => {
    render(
      <DescriptionEditor
        initialHtml="<p>Hola</p>"
        onSave={onSave}
        isSaving={true}
      />
    );
    expect(screen.getByRole('button', { name: /guardando/i })).toBeDisabled();
  });
});
