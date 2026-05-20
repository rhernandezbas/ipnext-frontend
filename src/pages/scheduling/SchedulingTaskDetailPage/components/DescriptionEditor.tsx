import { useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import styles from './DescriptionEditor.module.css';

interface DescriptionEditorProps {
  initialHtml: string | null;
  onSave: (html: string) => Promise<void>;
  isSaving: boolean;
}

export function DescriptionEditor({ initialHtml, onSave, isSaving }: DescriptionEditorProps) {
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setStatus] = useState<string>('');
  const initialRef = useRef(initialHtml);

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialHtml ?? '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const empty = html === '<p></p>' || html === '';
      setIsDirty(html !== (initialRef.current ?? '') && !empty || (html !== (initialRef.current ?? '') && !empty));
      // simpler: just set dirty on any change
      setIsDirty(true);
    },
    editorProps: {
      attributes: {
        'aria-label': 'Editor de descripción',
        role: 'textbox',
      },
    },
  });

  const handleSave = async () => {
    if (!editor) return;
    const html = editor.getHTML();
    await onSave(html);
    setIsDirty(false);
    initialRef.current = html;
    setStatus('Descripción guardada');
    setTimeout(() => setStatus(''), 3000);
  };

  const isEmpty = !initialHtml && !isDirty;

  return (
    <section className={styles.section} aria-labelledby="desc-heading">
      <h2 id="desc-heading" className={styles.sectionTitle}>▣ Descripción</h2>

      {isEmpty && !editor?.isFocused && (
        <p className={styles.placeholder}>Sin descripción. Haz clic para añadir.</p>
      )}

      <div className={styles.editorWrapper}>
        <EditorContent editor={editor} data-testid="editor-content" />
      </div>

      <div className={styles.actions}>
        <div aria-live="polite" aria-atomic="true" className={styles.saveStatus}>
          {saveStatus}
        </div>
        <button
          className={styles.saveBtn}
          onClick={() => void handleSave()}
          disabled={!isDirty || isSaving}
          aria-label={isSaving ? 'Guardando descripción' : 'Guardar descripción'}
        >
          {isSaving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </section>
  );
}
