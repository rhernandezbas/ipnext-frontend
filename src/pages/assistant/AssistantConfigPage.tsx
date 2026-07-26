import { useState } from 'react';
import { Can } from '@/components/auth/Can';
import { Button } from '@/components/atoms/Button/Button';
import { Spinner } from '@/components/atoms/Spinner/Spinner';
import { Select } from '@/components/molecules/Select/Select';
import { AssistantActionsEditor } from '@/components/settings/AssistantActionsEditor';
import { AssistantIntentsEditor } from '@/components/settings/AssistantIntentsEditor';
import { AssistantRunsPanel } from '@/components/settings/AssistantRunsPanel';
import { useTicketAreas } from '@/hooks/useTicketAreas';
import {
  useAssistantCatalogs,
  useAssistantProfile,
  useAssistantProfiles,
  useCreateAssistantProfile,
  useUpdateAssistantProfile,
} from '@/hooks/useAssistant';
import styles from './AssistantConfigPage.module.css';

/**
 * ai-assistant-multiagent — configuración del asistente IA conversacional.
 *
 * Un agente POR ÁREA. El operador elige el área, edita la persona y el tono, marca qué puede
 * HACER (con doble confirmación en lo riesgoso) y carga los TEMAS que sabe atender — todo sin
 * deploy: agregar comportamiento es cargar filas desde acá.
 *
 * Lo único que NO se puede hacer desde esta pantalla es fabricar una fuente de datos o una
 * acción nueva: cada una es una puerta a la base y se registra en código, con review. Acá se
 * COMPONEN piezas seguras, no se fabrican.
 */
export default function AssistantConfigPage() {
  const [areaId, setAreaId] = useState<string>('');

  const areas = useTicketAreas();
  const catalogs = useAssistantCatalogs();
  const profiles = useAssistantProfiles();
  const createProfile = useCreateAssistantProfile();
  const updateProfile = useUpdateAssistantProfile();

  const profileForArea = profiles.data?.find(p => p.areaId === areaId) ?? null;
  const detail = useAssistantProfile(profileForArea?.id ?? null);

  const areaOptions =
    areas.data?.map(a => ({ value: a.id, label: a.name, swatch: a.color })) ?? [];

  const loading = areas.isLoading || catalogs.isLoading || profiles.isLoading;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Asistente IA</h1>
        <p className={styles.subtitle}>
          Un agente por área, sobre las conversaciones de WhatsApp. Configurá qué sabe atender y
          qué puede hacer por su cuenta.
        </p>
      </header>

      {loading && (
        <div className={styles.state}>
          <Spinner />
          <span>Cargando configuración…</span>
        </div>
      )}

      {!loading && (areas.isError || catalogs.isError || profiles.isError) && (
        <div className={styles.state} role="alert">
          <p className={styles.errorText}>No se pudo cargar la configuración del asistente.</p>
        </div>
      )}

      {!loading && !areas.isError && !catalogs.isError && !profiles.isError && catalogs.data && (
        <>
          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>Área</h2>
            <Select
              label="Elegí el área a configurar"
              options={areaOptions}
              value={areaId}
              onChange={setAreaId}
              placeholder="Seleccioná un área"
            />
          </section>

          {areaId && !profileForArea && (
            <section className={styles.section}>
              <p className={styles.empty}>
                Esta área todavía no tiene agente. Al crearlo va a nacer <strong>apagado</strong> y
                sin ninguna capacidad: no responde nada hasta que lo habilites y le cargues temas.
              </p>
              <Can permission="assistant.manage">
                <Button
                  variant="primary"
                  onClick={() => createProfile.mutate({ areaId })}
                  disabled={createProfile.isPending}
                >
                  {createProfile.isPending ? 'Creando…' : 'Crear agente para esta área'}
                </Button>
              </Can>
            </section>
          )}

          {profileForArea && detail.data && (
            <>
              <section className={styles.section}>
                <h2 className={styles.sectionHeading}>Estado</h2>
                <div className={styles.statusRow}>
                  <span
                    className={`${styles.statusBadge} ${
                      detail.data.enabled ? styles.on : styles.off
                    }`}
                  >
                    {detail.data.enabled ? 'Activo' : 'Apagado'}
                  </span>
                  <Can permission="assistant.manage">
                    <Button
                      variant={detail.data.enabled ? 'secondary' : 'primary'}
                      onClick={() =>
                        updateProfile.mutate({
                          id: detail.data.id,
                          input: { enabled: !detail.data.enabled },
                        })
                      }
                    >
                      {detail.data.enabled ? 'Apagar agente' : 'Activar agente'}
                    </Button>
                  </Can>
                </div>
              </section>

              <section className={styles.section}>
                <h2 className={styles.sectionHeading}>Qué puede hacer</h2>
                <p className={styles.sectionDescription}>
                  Habilitá sólo lo que quieras que resuelva sin supervisión. Las acciones de
                  riesgo alto piden confirmación y necesitan una evaluación corrida.
                </p>
                <Can
                  permission="assistant.manage"
                  fallback={
                    <AssistantActionsEditor
                      actions={catalogs.data.actions}
                      enabledKeys={detail.data.enabledActions}
                      onChange={() => undefined}
                      disabled
                    />
                  }
                >
                  <AssistantActionsEditor
                    actions={catalogs.data.actions}
                    enabledKeys={detail.data.enabledActions}
                    onChange={keys =>
                      updateProfile.mutate({ id: detail.data.id, input: { enabledActions: keys } })
                    }
                  />
                </Can>
              </section>

              <section className={styles.section}>
                <h2 className={styles.sectionHeading}>Temas que sabe atender</h2>
                <p className={styles.sectionDescription}>
                  Cada tema es una fila. Agregar uno nuevo no requiere programar ni desplegar.
                </p>
                <Can permission="assistant.manage" fallback={null}>
                  <AssistantIntentsEditor
                    profileId={detail.data.id}
                    intents={detail.data.intents}
                    catalogs={catalogs.data}
                    canManage
                  />
                </Can>
              </section>
            </>
          )}

          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>Historial de intervenciones</h2>
            <p className={styles.sectionDescription}>
              Qué hizo el asistente y por qué. El resultado &ldquo;Descartó cifra sin
              respaldo&rdquo; son respuestas que se bloquearon antes de llegar al cliente.
            </p>
            <AssistantRunsPanel />
          </section>
        </>
      )}
    </div>
  );
}
