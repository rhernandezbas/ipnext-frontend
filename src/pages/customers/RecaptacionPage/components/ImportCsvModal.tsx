import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useImportCsvLeads, downloadRecaptureCsvTemplate } from '@/hooks/useRecaptacion';
import styles from './ImportCsvModal.module.css';

interface ImportCsvModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the API result after a successful import. */
  onSuccess: (result: { created: number; errors: string[] }) => void;
}

/**
 * Accessible modal dialog for CSV lead import — mirrors the ConfirmModal
 * portal + backdrop + Esc + focus pattern.
 *
 * - "Descargar CSV de ejemplo" triggers a blob download via downloadRecaptureCsvTemplate().
 * - File picker reads the selected .csv via File.text() and posts to useImportCsvLeads.
 * - Displays the selected filename so the user knows what is queued.
 * - "Importar" is disabled when no file is selected or mutation is in flight.
 */
export function ImportCsvModal({ open, onClose, onSuccess }: ImportCsvModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [downloading, setDownloading] = useState(false);
  const importMutation = useImportCsvLeads();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importBtnRef = useRef<HTMLButtonElement>(null);

  // Focus the import button (or download button when no file) on open.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    importBtnRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  // Reset file selection when the modal is closed.
  useEffect(() => {
    if (!open) {
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [open]);

  if (!open) return null;

  async function handleDownloadTemplate() {
    setDownloading(true);
    try {
      await downloadRecaptureCsvTemplate();
    } finally {
      setDownloading(false);
    }
  }

  async function handleImport() {
    if (!file) return;
    const csv = await file.text();
    const result = await importMutation.mutateAsync(csv);
    onSuccess(result);
    onClose();
  }

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-csv-modal-title"
    >
      <div className={styles.dialog}>
        <h2 id="import-csv-modal-title" className={styles.title}>
          Importar leads desde CSV
        </h2>

        <p className={styles.description}>
          Seleccioná un archivo CSV con los leads a importar. Descargá el
          template si necesitás ver el formato esperado.
        </p>

        {/* Template download */}
        <div className={styles.downloadRow}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => void handleDownloadTemplate()}
            disabled={downloading}
          >
            {downloading ? 'Descargando…' : 'Descargar CSV de ejemplo'}
          </button>
        </div>

        {/* File picker */}
        <div className={styles.fileRow}>
          <label className={styles.fileLabel}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className={styles.fileInput}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <span className={styles.fileBrowse}>Elegir archivo</span>
          </label>
          {file && (
            <span className={styles.fileName}>{file.name}</span>
          )}
          {!file && (
            <span className={styles.fileNameEmpty}>Ningún archivo seleccionado</span>
          )}
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancel}
            onClick={onClose}
            disabled={importMutation.isPending}
          >
            Cancelar
          </button>
          <button
            ref={importBtnRef}
            type="button"
            className={styles.confirm}
            onClick={() => void handleImport()}
            disabled={!file || importMutation.isPending}
          >
            {importMutation.isPending ? 'Importando…' : 'Importar'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
