import { Spinner } from '@/components/atoms/Spinner/Spinner';
import { useAssistantCatalogs, useSetAssistantDataSource } from '@/hooks/useAssistant';
import { useCan } from '@/hooks/useMyPermissions';
import styles from './AssistantDataSourcesCard.module.css';

/**
 * ai-assistant-multiagent (D2 / CFG-3) — qué datos puede consultar el asistente.
 *
 * Este es el tilde que el seed prometía y no existía. `noc.cortes` nace apagada —mientras el
 * hub NOC esté en modo oscuro, responder "no hay cortes en tu zona" sería afirmar sin saber,
 * que es justo el modo de falla que este change combate— y hasta ahora no había forma de
 * prenderla cuando el hub saliera: `setDataSourceEnabled` estaba implementado en los dos
 * adapters y nadie lo llamaba.
 *
 * ⚠️ Acá se PRENDE y se APAGA, nunca se crea. Las fuentes se registran en código con review
 * (frontera R5 del proposal): cada una es una puerta a la base, y fabricarlas por formulario
 * sería una inyección con formulario bonito.
 *
 * Apagar no rompe las intenciones que la usaban: el motor filtra por las habilitadas al
 * resolver los hechos, así que esa intención simplemente deja de recibir ese dato.
 */
export function AssistantDataSourcesCard() {
  const catalogs = useAssistantCatalogs();
  const setSource = useSetAssistantDataSource();
  const canManage = useCan('assistant.manage');

  if (catalogs.isLoading) {
    return (
      <div className={styles.state}>
        <Spinner />
        <span>Cargando fuentes…</span>
      </div>
    );
  }

  // Sin catálogo NO se dibujan tildes: renderizarlos todos en "off" haría creer que el
  // asistente no ve ningún dato, cuando en realidad no sabemos qué ve.
  if (catalogs.isError || !catalogs.data) {
    return (
      <p className={styles.error} role="alert">
        No se pudo leer el catálogo de fuentes.
      </p>
    );
  }

  return (
    <div className={styles.card}>
      <p className={styles.hint}>
        Una fuente apagada <strong>no se consulta</strong>: las intenciones que la usaban dejan
        de recibir ese dato y el asistente no afirma nada sobre él. Las fuentes se registran en
        el código con review — acá sólo se prenden y se apagan.
      </p>

      <ul className={styles.list}>
        {catalogs.data.dataSources.map(source => {
          const id = `data-source-${source.key}`;
          return (
            <li key={source.key} className={styles.row}>
              <input
                id={id}
                type="checkbox"
                className={styles.checkbox}
                checked={source.enabled}
                disabled={!canManage || setSource.isPending}
                onChange={() => setSource.mutate({ key: source.key, enabled: !source.enabled })}
              />
              <label htmlFor={id} className={styles.label}>
                {source.label}
                <code className={styles.key}>{source.key}</code>
              </label>
            </li>
          );
        })}
      </ul>

      {setSource.isError && (
        <p className={styles.error} role="alert">
          No se pudo cambiar el estado de la fuente. Reintentá en unos segundos.
        </p>
      )}
    </div>
  );
}
