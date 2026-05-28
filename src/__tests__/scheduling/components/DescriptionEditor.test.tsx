import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock TipTap since it doesn't work well in jsdom. The mock captures the
// component's onUpdate handler so tests can simulate user edits by invoking it.
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

import { useEditor } from '@tiptap/react';
import { DescriptionEditor } from '@/pages/scheduling/SchedulingTaskDetailPage/components/DescriptionEditor';

/**
 * Retrieve the editor instance returned by the most recent `useEditor` call.
 * The component's `onUpdate` handler is exposed via `_onUpdate` so tests can
 * simulate edits without relying on jsdom's flaky contentEditable behaviour.
 */
function lastEditor(): { _onUpdate: (props: { editor: { getHTML: () => string } }) => void } {
  const mock = vi.mocked(useEditor);
  const results = mock.mock.results;
  return results[results.length - 1].value as ReturnType<typeof lastEditor>;
}

describe('DescriptionEditor (controlled API)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the editor area', () => {
    render(<DescriptionEditor initialHtml="<p>Hola</p>" onChange={vi.fn()} />);
    expect(screen.getByTestId('editor-content')).toBeInTheDocument();
  });

  it('does NOT render its own Guardar button (single-save lives in the parent)', () => {
    render(<DescriptionEditor initialHtml="<p>Hola</p>" onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /guardar/i })).not.toBeInTheDocument();
  });

  it('shows placeholder when initialHtml is null', () => {
    render(<DescriptionEditor initialHtml={null} onChange={vi.fn()} />);
    expect(screen.getByText(/sin descripción/i)).toBeInTheDocument();
  });

  it('calls onChange with the new html and isDirty=true when content diverges from initial', () => {
    const onChange = vi.fn();
    render(<DescriptionEditor initialHtml="<p>Hola</p>" onChange={onChange} />);

    // Simulate an edit that produces different HTML than the initial value
    lastEditor()._onUpdate({ editor: { getHTML: () => '<p>Cambiado</p>' } });

    expect(onChange).toHaveBeenCalledWith('<p>Cambiado</p>', true);
  });

  it('calls onChange with isDirty=false when the editor reports the same html as initial', () => {
    const onChange = vi.fn();
    render(<DescriptionEditor initialHtml="<p>Hola</p>" onChange={onChange} />);

    // Simulate a no-op update where the HTML matches initial
    lastEditor()._onUpdate({ editor: { getHTML: () => '<p>Hola</p>' } });

    expect(onChange).toHaveBeenLastCalledWith('<p>Hola</p>', false);
  });
});
