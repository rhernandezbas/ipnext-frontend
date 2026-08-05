import { useState } from 'react';
import { useConfirm } from '@/context/ConfirmContext';
import { useNetworkSites } from '@/hooks/useNetworkSites';
import { usePushServiceAlertPreview, useSendPushServiceAlert } from '@/hooks/usePushServiceAlert';
import type { PushServiceAlertResult } from '@/types/push';
import styles from './PushAlertsPage.module.css';

/**
 * Alcance ya calculado, junto CON el filtro para el que se calculó. Guardar el
 * filtro no es decorativo: es lo que permite invalidar el número cuando el
 * operador cambia de nodo. Un "128 cuentas" que quedó de otro nodo es peor que
 * no tener número — es el número con el que iba a confirmar el envío.
 */
interface Scope {
  networkSiteId: string | null;
  recipients: number;
  devices: number;
}

function plural(n: number, singular: string, pluralWord: string): string {
  return `${n} ${n === 1 ? singular : pluralWord}`;
}

/**
 * PushAlertsPage (gestion-app) — avisos push de SERVICIO a la app de clientes.
 *
 * Lo único genuinamente nuevo de la sección: hasta ahora mandar un aviso sólo
 * se podía por API. Contrato del BE (en prod, permiso `push.send`):
 *   POST /api/notifications/push-service-alert/preview → { recipients, devices }
 *   POST /api/notifications/push-service-alert        → { recipients, devices, invalidated, dryRun, inboxed }
 *
 * Tres candados, en este orden:
 *  1. NO se puede enviar sin haber visto el alcance. El botón nace deshabilitado
 *     y sólo lo habilita un preview del filtro ACTUAL — nadie manda a ciegas.
 *  2. Cambiar el nodo tira el alcance a la basura (ver `Scope`).
 *  3. DOBLE confirmación con el impacto explícito ("vas a enviar a N clientes"),
 *     la segunda en tono `danger` — regla del repo para acciones de alto riesgo
 *     (mismo criterio que `CureSessionButton`). Cancelar cualquiera de las dos
 *     NO llama al endpoint de envío.
 *
 * Y al volver se muestra el resultado REAL, incluido `dryRun`: si el BE está sin
 * Firebase configurado no salió nada, y eso hay que decirlo con todas las letras.
 */
export default function PushAlertsPage() {
  const confirm = useConfirm();
  const { data: sites, isLoading: sitesLoading, isError: sitesError } = useNetworkSites({ staleTime: 60_000 });
  const previewMutation = usePushServiceAlertPreview();
  const sendMutation = useSendPushServiceAlert();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [networkSiteId, setNetworkSiteId] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope | null>(null);
  const [result, setResult] = useState<PushServiceAlertResult | null>(null);
  const [cancelled, setCancelled] = useState(false);

  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  const scopeIsFresh = scope !== null && scope.networkSiteId === networkSiteId;
  const canSend =
    trimmedTitle.length > 0 && trimmedBody.length > 0 && scopeIsFresh && !sendMutation.isPending;

  function handleNodeChange(value: string) {
    setNetworkSiteId(value === '' ? null : value);
    // Candado 2: el alcance viejo ya no describe lo que se va a enviar.
    setScope(null);
    setResult(null);
    setCancelled(false);
    previewMutation.reset();
  }

  function handlePreview() {
    setCancelled(false);
    setResult(null);
    const target = networkSiteId;
    previewMutation.preview(
      { networkSiteId: target },
      {
        onSuccess: (data) => {
          // `target`, no el state actual: si el operador cambió de nodo mientras
          // el preview volaba, este resultado ya no aplica y `scopeIsFresh` lo
          // descarta solo.
          setScope({ networkSiteId: target, recipients: data.recipients, devices: data.devices });
        },
      },
    );
  }

  async function handleSend() {
    if (!canSend || !scope) return;
    setCancelled(false);
    setResult(null);

    const impacto = `${plural(scope.recipients, 'cliente', 'clientes')} (${plural(scope.devices, 'dispositivo', 'dispositivos')})`;

    const primera = await confirm({
      title: 'Enviar aviso push',
      message: `Vas a enviar este aviso a ${impacto}. Les va a sonar el teléfono ahora mismo. ¿Seguimos?`,
      confirmLabel: 'Sí, seguir',
    });
    if (!primera) {
      setCancelled(true);
      return;
    }

    const segunda = await confirm({
      title: 'Última confirmación',
      message: `Confirmación final: el aviso "${trimmedTitle}" sale AHORA para ${impacto} y no se puede deshacer ni borrar de los teléfonos. ¿Enviar?`,
      tone: 'danger',
      confirmLabel: 'Enviar ahora',
    });
    if (!segunda) {
      setCancelled(true);
      return;
    }

    try {
      const sent = await sendMutation.sendAsync({ title: trimmedTitle, body: trimmedBody, networkSiteId });
      setResult(sent);
      // Post-envío el alcance se limpia: `canSend` vuelve a exigir un preview
      // FRESCO antes del próximo blast. Sin esto, el operador puede re-disparar
      // otro envío masivo sin volver a mirar a cuántos le pega — justo lo que
      // el gate del preview existe para evitar (hallazgo del review, 2026-08-05).
      setScope(null);
    } catch {
      // El mensaje sale por `sendMutation.serverError` (abajo); no hay nada que
      // relanzar — un throw acá sólo rompería el handler del click.
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.breadcrumb}>Gestión de App /</span>
        <h1 className={styles.title}>Avisos push</h1>
        <p className={styles.subtitle}>
          Aviso de servicio al teléfono de los clientes que tienen la app instalada y las notificaciones
          activadas. Para promociones usá <strong>Promociones</strong> — esto es sólo para avisos de servicio.
        </p>
      </div>

      <div className={styles.layout}>
        <section className={styles.form} aria-labelledby="push-form-heading">
          <h2 id="push-form-heading" className={styles.sectionTitle}>
            El aviso
          </h2>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="push-title">
              Título
            </label>
            <input
              id="push-title"
              className={styles.input}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Corte programado en el nodo Centro"
              autoComplete="off"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="push-body">
              Mensaje
            </label>
            <textarea
              id="push-body"
              className={styles.textarea}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Mañana de 9 a 12 hs vamos a estar trabajando en la red. Pedimos disculpas."
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="push-node">
              Nodo
            </label>
            <select
              id="push-node"
              className={styles.select}
              value={networkSiteId ?? ''}
              onChange={(e) => handleNodeChange(e.target.value)}
              disabled={sitesLoading}
            >
              <option value="">Todos los nodos</option>
              {(sites ?? []).map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
            <p className={styles.hint}>
              {sitesError
                ? 'No se pudo cargar el catálogo de nodos — se puede enviar a todos igual.'
                : 'Sin elegir nodo, el aviso va a TODOS los clientes con la app.'}
            </p>
          </div>
        </section>

        <section className={styles.sidePanel} aria-labelledby="push-scope-heading">
          <h2 id="push-scope-heading" className={styles.sectionTitle}>
            Alcance
          </h2>

          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={handlePreview}
            disabled={previewMutation.isPending}
          >
            {previewMutation.isPending ? 'Calculando…' : 'Ver alcance'}
          </button>

          <div className={styles.liveArea} role="status" aria-live="polite">
            {scopeIsFresh && scope ? (
              <p className={styles.scope} data-testid="push-scope">
                Le va a llegar a <strong>{plural(scope.recipients, 'cuenta', 'cuentas')}</strong> ·{' '}
                <strong>{plural(scope.devices, 'dispositivo', 'dispositivos')}</strong>
              </p>
            ) : (
              <p className={styles.scopePending}>
                Calculá el alcance para poder enviar. El número que veas acá es el que se va a usar en la
                confirmación.
              </p>
            )}
          </div>

          {previewMutation.serverError && !previewMutation.isPending && (
            <p className={styles.error} role="alert">
              {previewMutation.serverError}
            </p>
          )}

          <button
            type="button"
            className={styles.dangerBtn}
            onClick={() => void handleSend()}
            disabled={!canSend}
          >
            {sendMutation.isPending ? 'Enviando…' : 'Enviar aviso'}
          </button>

          {cancelled && (
            <p className={styles.cancelled} role="status">
              Envío cancelado — no se mandó nada.
            </p>
          )}

          {sendMutation.serverError && !sendMutation.isPending && !result && (
            <p className={styles.error} role="alert">
              {sendMutation.serverError}
            </p>
          )}

          {result && (
            <div className={styles.result} data-testid="push-result" role="status">
              {result.dryRun ? (
                <p className={styles.resultWarning}>
                  <strong>Firebase no está configurado en el servidor: no se envió nada.</strong> El aviso
                  quedó igual en el buzón de la app, pero ningún teléfono sonó.
                </p>
              ) : (
                <p className={styles.resultOk}>Aviso enviado.</p>
              )}
              <ul className={styles.resultList}>
                <li>{plural(result.recipients, 'cuenta alcanzada', 'cuentas alcanzadas')}</li>
                <li>{plural(result.devices, 'dispositivo', 'dispositivos')}</li>
                <li>{plural(result.inboxed, 'aviso en el buzón', 'avisos en el buzón')}</li>
                {result.invalidated > 0 && (
                  <li>{plural(result.invalidated, 'dispositivo dado de baja', 'dispositivos dados de baja')}</li>
                )}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
