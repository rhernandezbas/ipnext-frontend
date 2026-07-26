import { useState } from 'react';
import { Select } from '@/components/molecules/Select/Select';
import { Spinner } from '@/components/atoms/Spinner/Spinner';
import { useAssistantRuns } from '@/hooks/useAssistant';
import { formatDateTimeShort } from '@/utils/formatDate';
import { OUTCOME_LABELS, type AssistantOutcome } from '@/types/assistant';
import styles from './AssistantRunsPanel.module.css';

const OUTCOME_OPTIONS = [
  { value: '', label: 'Todos los resultados' },
  ...(Object.keys(OUTCOME_LABELS) as AssistantOutcome[]).map(key => ({
    value: key,
    label: OUTCOME_LABELS[key],
  })),
];

/**
 * ai-assistant-multiagent (OBS-1) — historial de intervenciones del asistente.
 *
 * Responde las preguntas que vas a querer hacerle al bot cuando algo salga raro: *¿por qué no
 * contestó?*, *¿cuántas veces se calló pudiendo hablar?*
 *
 * El filtro **"Descartó cifra sin respaldo"** es el más valioso: cada fila ahí es una
 * alucinación sobre plata que NO llegó al cliente. Si ese número sube, el modelo o el prompt
 * se degradaron — y te enterás por acá, no por un reclamo.
 *
 * NO muestra el contenido de los mensajes a propósito: la auditoría registra QUÉ pasó y POR
 * QUÉ, nunca QUÉ SE DIJO. Para eso está el hilo, que es su fuente de verdad.
 */
export function AssistantRunsPanel() {
  const [outcome, setOutcome] = useState<string>('');
  const { data, isLoading, isError, refetch } = useAssistantRuns(
    outcome ? { outcome: outcome as AssistantOutcome, limit: 50 } : { limit: 50 },
  );

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <Select
          label="Filtrar por resultado"
          options={OUTCOME_OPTIONS}
          value={outcome}
          onChange={setOutcome}
        />
      </div>

      {/* 4 ramas de estado: loading · error · empty · success (regla innegociable del repo). */}
      {isLoading && (
        <div className={styles.state}>
          <Spinner />
          <span>Cargando intervenciones…</span>
        </div>
      )}

      {isError && (
        <div className={styles.state} role="alert">
          <p className={styles.errorText}>No se pudo cargar el historial.</p>
          <button type="button" className={styles.retry} onClick={() => refetch()}>
            Reintentar
          </button>
        </div>
      )}

      {!isLoading && !isError && data && data.items.length === 0 && (
        <p className={styles.state}>
          {outcome
            ? 'No hay intervenciones con ese resultado.'
            : 'El asistente todavía no intervino en ninguna conversación.'}
        </p>
      )}

      {!isLoading && !isError && data && data.items.length > 0 && (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <caption className={styles.caption}>
              {data.total} intervención{data.total === 1 ? '' : 'es'} registrada
              {data.total === 1 ? '' : 's'}
            </caption>
            <thead>
              <tr>
                <th scope="col">Cuándo</th>
                <th scope="col">Resultado</th>
                <th scope="col">Tema</th>
                <th scope="col">Motivo</th>
                <th scope="col">Demora</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map(run => (
                <tr key={run.id}>
                  {/* AR-fijo, NUNCA la TZ del browser: el BE serializa UTC y el container
                      de prod corre en UTC — `toLocaleString` sin timeZone mostraría la hora
                      equivocada. Lo pinea el guard `no-browser-tz`. */}
                  <td>{formatDateTimeShort(run.createdAt)}</td>
                  <td>
                    <span className={`${styles.outcome} ${styles[run.outcome]}`}>
                      {OUTCOME_LABELS[run.outcome]}
                    </span>
                  </td>
                  <td>{run.intentName ?? '—'}</td>
                  <td className={styles.reason}>{run.reason ?? '—'}</td>
                  <td>{run.latencyMs === null ? '—' : `${run.latencyMs} ms`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
