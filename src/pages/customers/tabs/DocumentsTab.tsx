import { useRef } from 'react';
import { Button } from '../../../components/atoms/Button/Button';
import { Can } from '../../../components/auth/Can';
import { useClientDocuments, useUploadDocument } from '../../../hooks/useCustomers';
import styles from './Tab.module.css';
import docStyles from './DocumentsTab.module.css';

interface Props {
  clientId: string;
  active: boolean;
}

function formatSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR');
}

export function DocumentsTab({ clientId }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: docs, isLoading } = useClientDocuments(clientId);
  const uploadDocument = useUploadDocument();

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadDocument.mutate({ clientId, name: file.name, size: file.size });
    // reset so same file can be re-selected if needed
    e.target.value = '';
  }

  return (
    <div className={styles.tab}>
      <div className={styles.tabActions}>
        <Can permission="clients.manage_documents">
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleFileChange}
            aria-label="file-upload-input"
          />
          <Button variant="secondary" size="sm" onClick={handleUploadClick}>
            Subir documento
          </Button>
        </Can>
      </div>

      {isLoading && <p className={styles.emptyList}>Cargando documentos...</p>}

      {!isLoading && (!docs || docs.length === 0) && (
        <p className={styles.emptyList}>Sin documentos</p>
      )}

      {!isLoading && docs && docs.length > 0 && (
        <table className={docStyles.table}>
          <thead>
            <tr>
              <th className={docStyles.th}>Nombre</th>
              <th className={docStyles.th}>Tamaño</th>
              <th className={docStyles.th}>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {docs.map(doc => (
              <tr key={doc.id} className={docStyles.row}>
                <td className={docStyles.td}>{doc.name}</td>
                <td className={docStyles.td}>{formatSize(doc.size)}</td>
                <td className={docStyles.td}>{formatDate(doc.uploadedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
