import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock TipTap since it doesn't work well in jsdom. The mock captures the
// component's onUpdate handler so tests can simulate user edits by invoking it.
// `mockState.html` es el contenido "vivo" del editor mockeado: los tests H1 lo
// setean para simular editor limpio/dirty, y setContent lo actualiza como el
// TipTap real.
const mockState = vi.hoisted(() => ({ html: '<p>content</p>' }));
vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn(({ onUpdate }: { content?: string; onUpdate?: (props: { editor: { getHTML: () => string } }) => void }) => ({
    getHTML: () => mockState.html,
    commands: {
      setContent: vi.fn((html: string) => {
        mockState.html = html;
      }),
    },
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
function lastEditor(): {
  _onUpdate: (props: { editor: { getHTML: () => string } }) => void;
  commands: { setContent: ReturnType<typeof vi.fn> };
} {
  const mock = vi.mocked(useEditor);
  const results = mock.mock.results;
  return results[results.length - 1].value as ReturnType<typeof lastEditor>;
}

describe('DescriptionEditor (controlled API)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.html = '<p>content</p>';
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

// ── H1 (K2-FE fix wave) — resync del contenido tras cambio en el servidor ────
// El refetch del task (p. ej. el bloque de aprovisionamiento appendeado por el
// BE) cambia `initialHtml`. El editor SOLO resincroniza cuando el padre se lo
// ordena via `resyncNonce` (el padre es quien sabe si hay edición local); un
// cambio de initialHtml sin nonce JAMÁS pisa el contenido del operador.
describe('DescriptionEditor — H1 resync ordenado por el padre', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.html = '<p>Hola</p>';
  });

  it('bump de resyncNonce → setContent con el html nuevo del servidor + onChange limpio', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <DescriptionEditor initialHtml="<p>Hola</p>" onChange={onChange} resyncNonce={0} />,
    );
    rerender(
      <DescriptionEditor
        initialHtml="<p>Hola</p><p>── Aprovisionamiento ONU ──</p>"
        onChange={onChange}
        resyncNonce={1}
      />,
    );
    expect(lastEditor().commands.setContent).toHaveBeenCalledWith(
      '<p>Hola</p><p>── Aprovisionamiento ONU ──</p>',
    );
    expect(onChange).toHaveBeenCalledWith('<p>Hola</p><p>── Aprovisionamiento ONU ──</p>', false);
    // El baseline se movió: un update igual al server nuevo reporta limpio.
    lastEditor()._onUpdate({
      editor: { getHTML: () => '<p>Hola</p><p>── Aprovisionamiento ONU ──</p>' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      '<p>Hola</p><p>── Aprovisionamiento ONU ──</p>',
      false,
    );
  });

  it('initialHtml nuevo SIN bump de nonce → NO pisa el contenido local', () => {
    mockState.html = '<p>editado local</p>'; // el operador tiene cambios propios
    const onChange = vi.fn();
    const { rerender } = render(
      <DescriptionEditor initialHtml="<p>Hola</p>" onChange={onChange} resyncNonce={0} />,
    );
    rerender(
      <DescriptionEditor
        initialHtml="<p>Hola</p><p>── Aprovisionamiento ONU ──</p>"
        onChange={onChange}
        resyncNonce={0}
      />,
    );
    expect(lastEditor().commands.setContent).not.toHaveBeenCalled();
  });
});
