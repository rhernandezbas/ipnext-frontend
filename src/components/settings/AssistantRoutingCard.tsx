import { useState } from 'react';
import { Button } from '@/components/atoms/Button/Button';
import { Spinner } from '@/components/atoms/Spinner/Spinner';
import { Select } from '@/components/molecules/Select/Select';
import {
  useAssistantProfiles,
  useAssistantRouting,
  useUpdateAssistantRouting,
} from '@/hooks/useAssistant';
import { useTicketAreas } from '@/hooks/useTicketAreas';
import { useCan } from '@/hooks/useMyPermissions';
import styles from './AssistantRoutingCard.module.css';

/**
 * ai-assistant-multiagent (RTR-0) — quién atiende lo que entra SIN clasificar.
 *
 * **Esta es la perilla que decide si el asistente existe.** Las conversaciones de WhatsApp
 * entran siempre con `areaId = NULL` porque los agentes trabajan dentro de Chatwoot y nadie
 * clasifica desde Prominense. Sin un área default, el motor hace no-op en TODAS: la feature
 * queda en producción, verde y completamente muda.
 *
 * Por eso "sin área default" se muestra como una ADVERTENCIA con su consecuencia escrita, no
 * como un campo vacío. Un campo vacío se lee "falta completar"; esto es "el bot no le responde
 * a nadie".
 *
 * Sólo se ofrecen áreas que YA tienen agente: el backend rechaza las demás con un 400, pero
 * ofrecer una opción para después rechazarla es hacerle perder el tiempo al operador.
 */

/** El backend manda `{ error, code }`. Mostrar su mensaje > un "algo salió mal" genérico. */
function backendMessage(error: unknown): string | null {
  const data = (error as { response?: { data?: { error?: unknown } } })?.response?.data;
  return typeof data?.error === 'string' ? data.error : null;
}

/** Valor centinela del combobox para "nadie". `Select` trabaja con strings, no con null. */
const NOBODY = '';

/**
 * Por qué el ruteo GUARDADO no va a producir ninguna respuesta, si es que no va a producirla.
 *
 * Son TRES formas distintas de terminar en el mismo silencio, y el motor las trata igual
 * (`no_area_no_default`, `no_profile`, `profile_disabled` — todas no-op). Un ruteo que apunta a
 * un agente apagado se ve idéntico a uno que funciona: la pantalla diría "Ventas" y el bot no
 * contestaría jamás. Nombrar cuál de las tres es la diferencia entre "está roto" y "está roto
 * ASÍ, arreglalo ACÁ".
 */
type RoutingProblem = 'nobody' | 'no-agent' | 'agent-off';

function diagnoseRouting(
  defaultAreaId: string | null,
  agentEnabled: boolean | undefined,
): RoutingProblem | null {
  if (defaultAreaId === null) return 'nobody';
  // Hay área guardada pero ningún perfil la reclama: se la borraron después de configurarla.
  if (agentEnabled === undefined) return 'no-agent';
  if (!agentEnabled) return 'agent-off';
  return null;
}

export function AssistantRoutingCard() {
  const routing = useAssistantRouting();
  const profiles = useAssistantProfiles();
  const areas = useTicketAreas();
  const update = useUpdateAssistantRouting();
  // El diagnóstico se muestra SIEMPRE (el backend expone el ruteo con permiso de lectura);
  // lo que se gatea es la edición. Taparle a un supervisor el motivo por el que el bot calla
  // sería esconder justo el dato que esta pantalla existe para dar.
  const canManage = useCan('assistant.manage');

  const [areaId, setAreaId] = useState<string | null>(null);
  const [reroute, setReroute] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);

  if (routing.isLoading || profiles.isLoading || areas.isLoading) {
    return (
      <div className={styles.state}>
        <Spinner />
        <span>Cargando ruteo…</span>
      </div>
    );
  }

  // Ante un error de lectura NO se afirma "nadie atiende": sería adivinar el estado de la
  // perilla que decide si el bot contesta. Mismo criterio que las cards de flags.
  if (routing.isError || !routing.data) {
    return (
      <div className={styles.state} role="alert">
        <p className={styles.errorText}>No se pudo leer la configuración de ruteo.</p>
        <Button variant="secondary" onClick={() => routing.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  const data = routing.data;
  const currentAreaId = areaId ?? data.defaultAreaId ?? NOBODY;
  const currentReroute = reroute ?? data.rerouteEnabled;

  // Un área sólo sirve como default si tiene agente: el motor busca el perfil por área y, si
  // no lo encuentra, calla. Sin agente la opción no existiría más que para romper.
  const areasWithAgent = (areas.data ?? []).filter(area =>
    (profiles.data ?? []).some(p => p.areaId === area.id),
  );

  const options = [
    { value: NOBODY, label: 'Nadie — el asistente no responde' },
    ...areasWithAgent.map(a => ({ value: a.id, label: a.name, swatch: a.color })),
  ];

  // El diagnóstico va sobre lo GUARDADO, no sobre lo que el operador está tipeando: describe
  // el comportamiento actual del bot, no una intención a medio confirmar.
  const savedAreaName = (areas.data ?? []).find(a => a.id === data.defaultAreaId)?.name;
  const savedAgentEnabled = (profiles.data ?? []).find(p => p.areaId === data.defaultAreaId)
    ?.enabled;
  const problem = diagnoseRouting(data.defaultAreaId, savedAgentEnabled);

  const touch = () => setSaved(false);

  const save = async () => {
    touch();
    await update.mutateAsync({
      defaultAreaId: currentAreaId === NOBODY ? null : currentAreaId,
      rerouteEnabled: currentReroute,
    });
    setSaved(true);
  };

  const rejection = update.isError ? backendMessage(update.error) : null;

  return (
    <div className={styles.card}>
      {problem === 'nobody' && (
        <p className={styles.warning} role="alert">
          <strong>Nadie atiende las conversaciones sin clasificar.</strong> Las de WhatsApp
          entran todas así, o sea que el asistente <strong>no va a responder a nadie</strong>{' '}
          hasta que elijas un área acá.
        </p>
      )}

      {problem === 'no-agent' && (
        <p className={styles.warning} role="alert">
          El área default (<strong>{savedAreaName ?? data.defaultAreaId}</strong>){' '}
          <strong>no tiene agente</strong>. Se lo debe haber borrado después de configurar el
          ruteo — el asistente no responde nada. Elegí otra área o creale un agente a ésa.
        </p>
      )}

      {problem === 'agent-off' && (
        <p className={styles.warning} role="alert">
          El agente de <strong>{savedAreaName}</strong> está <strong>apagado</strong>, así que
          el asistente no responde nada aunque el ruteo esté configurado. Prendelo en la sección
          &quot;Estado&quot;, más abajo.
        </p>
      )}

      {areasWithAgent.length === 0 ? (
        <p className={styles.empty}>
          Ningún área tiene agente todavía. Elegí un área más abajo y creá un agente para ella;
          recién entonces vas a poder asignarla acá.
        </p>
      ) : (
        <>
          <div className={styles.field}>
            <Select
              label="Área que atiende lo que entra sin clasificar"
              options={options}
              value={currentAreaId}
              disabled={!canManage}
              onChange={value => {
                touch();
                setAreaId(value);
              }}
              aria-describedby="routing-area-hint"
            />
            <span className={styles.fieldHint} id="routing-area-hint">
              Sólo aparecen las áreas que ya tienen un agente configurado.
            </span>
          </div>

          <div className={styles.toggleRow}>
            <input
              id="routing-reroute"
              type="checkbox"
              disabled={!canManage}
              checked={currentReroute}
              onChange={e => {
                touch();
                setReroute(e.target.checked);
              }}
              aria-describedby="routing-reroute-hint"
            />
            <label className={styles.toggleLabel} htmlFor="routing-reroute">
              Reasignar a otra área cuando el tema no le corresponde
            </label>
          </div>
          <span className={styles.fieldHint} id="routing-reroute-hint">
            Si el agente default no sabe del tema y otra área con agente sí, le pasa la
            conversación. Apagado, el default atiende todo y nunca reasigna.
          </span>

          {saved && (
            <p className={styles.ok} role="status">
              Ruteo guardado.
            </p>
          )}

          {rejection && (
            <p className={styles.error} role="alert">
              {rejection}
            </p>
          )}

          {canManage && (
            <div className={styles.actions}>
              <Button variant="primary" onClick={save} disabled={update.isPending}>
                {update.isPending ? 'Guardando…' : 'Guardar ruteo'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
