import { useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import styles from './DescriptionEditor.module.css';

interface DescriptionEditorProps {
  initialHtml: string | null;
  /**
   * Controlled callback fired on every edit. The parent stores the latest html
   * and isDirty flag, and persists them together with the rest of the Datos
   * form when the user clicks the single bottom "Guardar cambios". The editor
   * has no save button of its own.
   */
  onChange: (html: string, isDirty: boolean) => void;
}

/** Description editor (TipTap) — controlled. Surfaces every change to the parent
 *  so a single unified save at the page footer persists description + Datos in
 *  one updateTask call. */
export function DescriptionEditor({ initialHtml, onChange }: DescriptionEditorProps) {
  const initialRef = useRef(initialHtml ?? '');

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialHtml ?? '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const isDirty = html !== initialRef.current;
      onChange(html, isDirty);
    },
    editorProps: {
      attributes: {
        'aria-label': 'Editor de descripción',
        role: 'textbox',
      },
    },
  });

  // Empty-state placeholder when there's no initial content AND the editor
  // hasn't been focused/edited yet. After the user starts editing, the editor
  // takes over visually.
  const isEmpty = !initialHtml && !editor?.isFocused;

  return (
    <section className={styles.section} aria-labelledby="desc-heading">
      <h2 id="desc-heading" className={styles.sectionTitle}>Descripción</h2>

      {isEmpty && (
        <p className={styles.placeholder}>Sin descripción. Haz clic para añadir.</p>
      )}

      <div className={styles.editorWrapper}>
        <EditorContent editor={editor} data-testid="editor-content" />
      </div>
    </section>
  );
}
