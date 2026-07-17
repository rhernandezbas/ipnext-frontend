import { useEffect, useRef } from 'react';
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
  /**
   * H1 (K2-FE fix wave) — señal de RESYNC ordenada por el padre. TipTap se
   * inicializa UNA vez; cuando el task refetchea con descripción nueva (p. ej.
   * el bloque de aprovisionamiento appendeado por el BE) y el padre determinó
   * que NO hay edición local, bumpea este nonce y el editor reemplaza su
   * contenido por el `initialHtml` vigente y resetea el baseline de dirty.
   * El editor JAMÁS resincroniza solo por un cambio de `initialHtml`: la
   * decisión de pisar contenido es exclusivamente del padre (que conoce el
   * estado dirty). Sin nonce el comportamiento es el histórico.
   */
  resyncNonce?: number;
}

/** Description editor (TipTap) — controlled. Surfaces every change to the parent
 *  so a single unified save at the page footer persists description + Datos in
 *  one updateTask call. */
export function DescriptionEditor({ initialHtml, onChange, resyncNonce }: DescriptionEditorProps) {
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

  // H1 — resync ordenado por el padre (ver doc de `resyncNonce`): reemplaza el
  // contenido por el html del servidor, mueve el baseline de dirty y notifica
  // al padre que el editor quedó limpio y alineado.
  const lastNonceRef = useRef(resyncNonce ?? 0);
  useEffect(() => {
    const nonce = resyncNonce ?? 0;
    if (!editor || nonce === lastNonceRef.current) return;
    lastNonceRef.current = nonce;
    const next = initialHtml ?? '';
    editor.commands.setContent(next);
    initialRef.current = next;
    onChange(next, false);
    // Solo el nonce dispara el resync — initialHtml/onChange se leen del render vigente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resyncNonce, editor]);

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
