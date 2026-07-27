import { useState } from 'react';
import { Button } from '@/components/atoms/Button/Button';
import { Input } from '@/components/atoms/Input/Input';
import { Spinner } from '@/components/atoms/Spinner/Spinner';
import { ConfirmModal } from '@/components/molecules/ConfirmModal/ConfirmModal';
import {
  useAssistantProvider,
  useTestAssistantProvider,
  useUpdateAssistantProvider,
} from '@/hooks/useAssistant';
import { PROVIDER_SOURCE_LABELS } from '@/types/assistant';
import styles from './AssistantProviderCard.module.css';

/**
 * ai-assistant-multiagent — credenciales del proveedor de IA.
 *
 * ⚠️ **La API key se escribe acá pero NO vive acá.** Viaja al backend, se guarda del lado del
 * servidor, y lo único que vuelve es una máscara (`hasApiKey` + últimos 4). El input está
 * SIEMPRE vacío al cargar: no hay nada que precargar, porque no tenemos la key.
 *
 * "Probar conexión" tampoco llama al proveedor desde el navegador — le pide al backend que lo
 * haga y muestra el resultado. Si el browser hiciera esa llamada, la key tendría que estar en
 * el bundle, que es público.
 */
export function AssistantProviderCard() {
  const provider = useAssistantProvider();
  const update = useUpdateAssistantProvider();
  const test = useTestAssistantProvider();

  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [saved, setSaved] = useState(false);

  if (provider.isLoading) {
    return (
      <div className={styles.state}>
        <Spinner />
        <span>Cargando credenciales…</span>
      </div>
    );
  }

  if (provider.isError || !provider.data) {
    return (
      <div className={styles.state} role="alert">
        <p className={styles.errorText}>No se pudieron cargar las credenciales.</p>
        <Button variant="secondary" onClick={() => provider.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  const data = provider.data;
  const currentBaseUrl = baseUrl ?? data.baseUrl;

  const save = async () => {
    setSaved(false);
    await update.mutateAsync({
      baseUrl: currentBaseUrl,
      // Vacío ⇒ el backend PRESERVA la guardada. Nunca se manda la máscara.
      ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
    });
    setApiKey('');
    setSaved(true);
  };

  return (
    <div className={styles.card}>
      <div className={styles.statusRow}>
        <span
          className={`${styles.sourceBadge} ${
            data.source === 'none' ? styles.sourceNone : styles.sourceOk
          }`}
        >
          {PROVIDER_SOURCE_LABELS[data.source]}
        </span>
        {data.apiKeyLast4 && (
          <span className={styles.masked}>
            Termina en <code>{data.apiKeyLast4}</code>
          </span>
        )}
      </div>

      {/* label = NOMBRE del campo, hint = DESCRIPCIÓN (aria-describedby). Si el hint
          viviera dentro del <label>, el lector de pantalla anunciaría el párrafo entero
          como nombre del input. */}
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="provider-base-url">
          URL del proveedor
        </label>
        <Input
          id="provider-base-url"
          value={currentBaseUrl}
          onChange={e => setBaseUrl(e.target.value)}
          placeholder="https://api.deepseek.com"
        />
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="provider-api-key">
          API key
        </label>
        <span className={styles.fieldHint} id="provider-api-key-hint">
          {data.hasApiKey
            ? 'Ya hay una credencial guardada. Dejá este campo vacío para conservarla, o pegá una nueva para reemplazarla.'
            : 'Pegá la API key del proveedor. Se guarda en el servidor y no vuelve a mostrarse.'}
        </span>
        <Input
          id="provider-api-key"
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder={data.hasApiKey ? '•••••••••• (sin cambios)' : 'sk-…'}
          autoComplete="off"
          aria-describedby="provider-api-key-hint"
        />
      </div>

      {saved && (
        <p className={styles.ok} role="status">
          Credenciales guardadas.
        </p>
      )}

      {update.isError && (
        <p className={styles.error} role="alert">
          No se pudieron guardar. Revisá que la URL sea válida.
        </p>
      )}

      <div className={styles.actions}>
        <Button variant="primary" onClick={save} disabled={update.isPending}>
          {update.isPending ? 'Guardando…' : 'Guardar'}
        </Button>

        <Button
          variant="secondary"
          onClick={() => test.mutate()}
          disabled={test.isPending || !data.hasApiKey}
        >
          {test.isPending ? 'Probando…' : 'Probar conexión'}
        </Button>

        {data.source === 'db' && (
          <Button variant="danger" onClick={() => setConfirmClear(true)}>
            Borrar credencial
          </Button>
        )}
      </div>

      {test.data && (
        <p
          className={test.data.ok ? styles.ok : styles.error}
          role={test.data.ok ? 'status' : 'alert'}
        >
          {test.data.detail}
          {test.data.latencyMs !== null && ` (${test.data.latencyMs} ms)`}
        </p>
      )}

      {confirmClear && (
        <ConfirmModal
          open
          tone="danger"
          title="Borrar la credencial guardada"
          message={
            'Se va a borrar la API key cargada desde esta pantalla. Si hay una configurada en el ' +
            'deploy, el asistente va a volver a usarla; si no, se queda sin poder responder.'
          }
          confirmLabel="Sí, borrar"
          onConfirm={async () => {
            setConfirmClear(false);
            await update.mutateAsync({ clearApiKey: true });
          }}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
}
