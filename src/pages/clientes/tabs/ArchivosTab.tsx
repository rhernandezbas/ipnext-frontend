import { useRef } from 'react';
import { useClientFiles, useUploadFile } from '../../../hooks/useClients';
import styles from './Tab.module.css';

interface Props { clientId: string; active: boolean; }

function formatSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function ArchivosTab({ clientId }: Props) {
  const { data, isLoading } = useClientFiles(clientId);
  const uploadFile = useUploadFile();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadFile.mutate({ clientId, name: file.name, size: file.size });
    e.target.value = '';
  }

  return (
    <div className={styles.tab}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <input
          ref={inputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploadFile.isPending}>
          {uploadFile.isPending ? 'Subiendo...' : 'Subir archivo'}
        </button>
      </div>

      {isLoading ? (
        <p>Cargando archivos...</p>
      ) : (data ?? []).length === 0 ? (
        <p>Sin archivos</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tamaño</th>
              <th>Fecha subida</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((file) => (
              <tr key={file.id}>
                <td>{file.name}</td>
                <td>{formatSize(file.size)}</td>
                <td>{new Date(file.uploadedAt).toLocaleDateString('es-AR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
