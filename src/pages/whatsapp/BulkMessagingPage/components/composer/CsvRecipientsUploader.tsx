import { useRef, useState } from 'react';
import { parseRecipientsCsv, type CsvContact, type CsvInvalidRow, type CsvParseError, type CsvParseErrorCode } from './parseRecipientsCsv';
import { RECIPIENT_REASON_LABELS } from './recipientReasonLabels';
import styles from './CsvRecipientsUploader.module.css';

interface CsvRecipientsUploaderProps {
  /**
   * Se llama SIEMPRE que cambia el resultado del archivo: `contacts` son SOLO
   * las filas VÁLIDAS (CSV-FE-4/CSV-FE-5) y `fileName` es `null` cuando no hay
   * archivo cargado (removido o RECHAZADO — un rechazo total no deja NINGÚN
   * contacto en el estado del composer).
   */
  onChange: (contacts: CsvContact[], fileName: string | null) => void;
}

type UploaderState =
  | { status: 'idle' }
  | { status: 'ok'; fileName: string; contacts: CsvContact[]; invalidRows: CsvInvalidRow[] }
  | { status: 'error'; fileName: string; error: CsvParseError };

const CSV_ERROR_MESSAGES: Record<CsvParseErrorCode, string> = {
  ESTRUCTURA: 'El archivo debe tener exactamente 2 columnas (nombre y teléfono) en todas las filas.',
  COMILLAS: 'Hay una comilla sin cerrar en el archivo.',
  VACIO: 'El archivo está vacío o sólo tiene el encabezado.',
  DEMASIADAS_FILAS: 'El archivo supera el límite permitido (5000 filas o 1MB).',
};

const FILE_INPUT_ID = 'csv-recipients-file-input';

/**
 * CsvRecipientsUploader (bulk-csv-recipients FE, CSV-FE-4) — input de archivo
 * `.csv`/`text/csv` que parsea CLIENT-SIDE (`parseRecipientsCsv`, D8 — parser
 * propio, sin libs) y muestra: en éxito, el resumen (archivo + N válidos + M
 * inválidos con detalle expandible línea+motivo) con "Quitar archivo"; en
 * rechazo total, el motivo + línea (role=alert, TEXTO — nunca solo color).
 *
 * Presentacional con estado LOCAL del archivo (molde `ImportCsvModal` —
 * `file.text()`, sin FileReader) — `CampaignComposer` es dueño del RESULTADO
 * (`onChange`), no del detalle de parseo. Un archivo nuevo REEMPLAZA
 * completamente al anterior (mismo handler, sin merge).
 */
export function CsvRecipientsUploader({ onChange }: CsvRecipientsUploaderProps) {
  const [state, setState] = useState<UploaderState>({ status: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    // Permite re-seleccionar el MISMO nombre de archivo después de un rechazo/quitar.
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    const text = await file.text();
    const result = parseRecipientsCsv(text);

    if (result.ok) {
      setState({ status: 'ok', fileName: file.name, contacts: result.contacts, invalidRows: result.invalidRows });
      onChange(result.contacts, file.name);
    } else {
      setState({ status: 'error', fileName: file.name, error: result.error });
      onChange([], null);
    }
  }

  function handleRemove() {
    setState({ status: 'idle' });
    onChange([], null);
  }

  const validCount = state.status === 'ok' ? state.contacts.length : 0;
  const invalidCount = state.status === 'ok' ? state.invalidRows.length : 0;

  return (
    <fieldset className={styles.wrap}>
      <legend className={styles.title}>Destinatarios desde archivo CSV</legend>
      <p className={styles.subtitle}>
        Subí un CSV de 2 columnas (nombre, teléfono). Se combina con el segmento y la lista manual, sin duplicados.
      </p>

      <label htmlFor={FILE_INPUT_ID} className={styles.fileLabel}>
        Archivo CSV
      </label>
      <input
        ref={fileInputRef}
        id={FILE_INPUT_ID}
        type="file"
        accept=".csv,text/csv"
        className={styles.fileInput}
        onChange={(e) => void handleFileChange(e)}
      />

      {state.status === 'error' && (
        <p className={styles.error} role="alert">
          {state.fileName}: {CSV_ERROR_MESSAGES[state.error.code]}
          {state.error.line ? ` (línea ${state.error.line})` : ''}
        </p>
      )}

      {state.status === 'ok' && (
        <div className={styles.summary}>
          <p className={styles.fileName}>{state.fileName}</p>
          <p className={styles.counts} role="status" aria-live="polite">
            {validCount} destinatario{validCount === 1 ? '' : 's'} del archivo
            {invalidCount > 0 && (
              <>
                {' — '}
                {invalidCount} fila{invalidCount === 1 ? '' : 's'} inválida{invalidCount === 1 ? '' : 's'}
              </>
            )}
          </p>

          {invalidCount > 0 && (
            <details className={styles.detail}>
              <summary className={styles.detailSummary}>Ver detalle de filas inválidas</summary>
              <ul className={styles.invalidList}>
                {state.invalidRows.map((row) => (
                  <li key={row.line} className={styles.invalidItem}>
                    Línea {row.line}: {RECIPIENT_REASON_LABELS[row.reason]}
                    {row.name ? ` — ${row.name}` : ''}
                    {row.phone ? ` — ${row.phone}` : ''}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <button type="button" className={styles.removeBtn} onClick={handleRemove}>
            Quitar archivo
          </button>
        </div>
      )}
    </fieldset>
  );
}
