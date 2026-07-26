import { useState } from 'react';
import { Button } from '@/components/atoms/Button/Button';
import { Input } from '@/components/atoms/Input/Input';
import { Select } from '@/components/molecules/Select/Select';
import { ConfirmModal } from '@/components/molecules/ConfirmModal/ConfirmModal';
import { AssistantRiskChip } from './AssistantRiskChip';
import {
  useCreateAssistantIntent,
  useDeleteAssistantIntent,
  useUpdateAssistantIntent,
} from '@/hooks/useAssistant';
import type { AssistantCatalogs, AssistantIntent } from '@/types/assistant';
import styles from './AssistantIntentsEditor.module.css';

interface AssistantIntentsEditorProps {
  profileId: string;
  intents: AssistantIntent[];
  catalogs: AssistantCatalogs;
  canManage: boolean;
}

interface DraftIntent {
  name: string;
  description: string;
  examples: string;
  dataSourceKeys: string[];
  responseGuide: string;
  actionKey: string;
}

const EMPTY_DRAFT: DraftIntent = {
  name: '',
  description: '',
  examples: '',
  dataSourceKeys: [],
  responseGuide: '',
  actionKey: '',
};

/**
 * ai-assistant-multiagent (CFG-2) — CRUD de intenciones.
 *
 * **Es la razón de ser del diseño entero**: agregar un tema que el bot sepa atender es cargar
 * una fila desde acá, sin deploy y sin programador. `description` y los ejemplos son el
 * material que después lee el clasificador — por eso el formulario los explica en vez de
 * mostrar sólo el nombre del campo.
 *
 * Apagar una intención (`enabled:false`) la saca del juego SIN borrarla. La UI ofrece apagar
 * como acción primaria y borrar detrás de confirmación: apagar es reversible, borrar no.
 */
export function AssistantIntentsEditor({
  profileId,
  intents,
  catalogs,
  canManage,
}: AssistantIntentsEditorProps) {
  const [draft, setDraft] = useState<DraftIntent>(EMPTY_DRAFT);
  const [showForm, setShowForm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AssistantIntent | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const createIntent = useCreateAssistantIntent();
  const updateIntent = useUpdateAssistantIntent();
  const deleteIntent = useDeleteAssistantIntent();

  const actionOptions = catalogs.actions.map(a => ({ value: a.key, label: a.label }));

  const submit = async () => {
    setFormError(null);
    if (!draft.name.trim() || !draft.description.trim() || !draft.actionKey) {
      setFormError('Completá el nombre, la descripción y qué hace el asistente con este tema.');
      return;
    }

    try {
      await createIntent.mutateAsync({
        profileId,
        input: {
          name: draft.name.trim(),
          description: draft.description.trim(),
          examples: draft.examples
            .split('\n')
            .map(e => e.trim())
            .filter(Boolean),
          dataSourceKeys: draft.dataSourceKeys,
          responseGuide: draft.responseGuide.trim(),
          actionKey: draft.actionKey,
        },
      });
      setDraft(EMPTY_DRAFT);
      setShowForm(false);
    } catch {
      // El BE valida contra los catálogos y por nombre duplicado. El mensaje es genérico a
      // propósito: exponer el detalle del error del servidor acá no ayuda al operador.
      setFormError('No se pudo guardar. Revisá que el nombre no esté repetido en esta área.');
    }
  };

  const toggleSource = (key: string) => {
    setDraft(d => ({
      ...d,
      dataSourceKeys: d.dataSourceKeys.includes(key)
        ? d.dataSourceKeys.filter(k => k !== key)
        : [...d.dataSourceKeys, key],
    }));
  };

  return (
    <div className={styles.wrapper}>
      {intents.length === 0 && !showForm && (
        <p className={styles.empty}>
          Este agente todavía no tiene temas cargados, así que no va a responder nada por su
          cuenta. Agregá el primero para que sepa de qué puede hablar.
        </p>
      )}

      {intents.length > 0 && (
        <ul className={styles.list}>
          {intents.map(intent => {
            const action = catalogs.actions.find(a => a.key === intent.actionKey);

            return (
              <li key={intent.id} className={styles.item}>
                <div className={styles.itemMain}>
                  <div className={styles.itemHeader}>
                    <span className={styles.itemName}>{intent.name}</span>
                    {action && <AssistantRiskChip level={action.riskLevel} />}
                    {!intent.enabled && <span className={styles.offBadge}>Apagado</span>}
                  </div>
                  <p className={styles.itemDescription}>{intent.description}</p>
                  {intent.dataSourceKeys.length > 0 && (
                    <p className={styles.itemSources}>
                      Datos que ve:{' '}
                      {intent.dataSourceKeys
                        .map(k => catalogs.dataSources.find(s => s.key === k)?.label ?? k)
                        .join(' · ')}
                    </p>
                  )}
                </div>

                {canManage && (
                  <div className={styles.itemActions}>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        updateIntent.mutate({ id: intent.id, input: { enabled: !intent.enabled } })
                      }
                    >
                      {intent.enabled ? 'Apagar' : 'Prender'}
                    </Button>
                    <Button variant="danger" onClick={() => setPendingDelete(intent)}>
                      Borrar
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canManage && !showForm && (
        <Button variant="primary" onClick={() => setShowForm(true)}>
          Agregar tema
        </Button>
      )}

      {canManage && showForm && (
        <div className={styles.form}>
          {/* `Input` no expone `label` — el label se asocia por `htmlFor`/`id` acá, que es lo
              que le da nombre accesible al campo. */}
          <label className={styles.field} htmlFor="intent-name">
            <span className={styles.fieldLabel}>Nombre del tema</span>
            <Input
              id="intent-name"
              value={draft.name}
              onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
              placeholder="estado de cuenta"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Cuándo aplica</span>
            <span className={styles.fieldHint}>
              Describí el tema como se lo explicarías a alguien nuevo. Esto es lo que el
              asistente lee para decidir si una consulta entra acá.
            </span>
            <textarea
              className={styles.textarea}
              rows={2}
              value={draft.description}
              onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
              placeholder="El cliente pregunta cuánto debe o por su factura"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Ejemplos de cómo lo dice el cliente</span>
            <span className={styles.fieldHint}>Uno por línea. Ayudan a que acierte más.</span>
            <textarea
              className={styles.textarea}
              rows={3}
              value={draft.examples}
              onChange={e => setDraft(d => ({ ...d, examples: e.target.value }))}
              placeholder={'¿cuánto debo?\nmi factura\n¿tengo deuda?'}
            />
          </label>

          <fieldset className={styles.fieldset}>
            <legend className={styles.fieldLabel}>Qué datos puede ver</legend>
            <span className={styles.fieldHint}>
              El asistente sólo recibe estos datos, ya resueltos. Nunca ve el nombre, el
              documento ni el domicilio del cliente.
            </span>
            {catalogs.dataSources.map(source => {
              const id = `intent-source-${source.key}`;
              return (
                <div key={source.key} className={styles.checkRow}>
                  <input
                    id={id}
                    type="checkbox"
                    className={styles.checkbox}
                    checked={draft.dataSourceKeys.includes(source.key)}
                    onChange={() => toggleSource(source.key)}
                  />
                  <label htmlFor={id} className={styles.checkLabel}>
                    {source.label}
                    {!source.enabled && (
                      <span className={styles.disabledHint}>
                        {' '}
                        — deshabilitado, no se va a consultar
                      </span>
                    )}
                  </label>
                </div>
              );
            })}
          </fieldset>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Cómo debe responder</span>
            <textarea
              className={styles.textarea}
              rows={2}
              value={draft.responseGuide}
              onChange={e => setDraft(d => ({ ...d, responseGuide: e.target.value }))}
              placeholder="Decile el saldo y la fecha de vencimiento, breve y cordial."
            />
          </label>

          <Select
            label="Qué hace con este tema"
            options={actionOptions}
            value={draft.actionKey}
            onChange={value => setDraft(d => ({ ...d, actionKey: value }))}
            placeholder="Elegí una acción"
          />

          {formError && (
            <p className={styles.error} role="alert">
              {formError}
            </p>
          )}

          <div className={styles.formActions}>
            <Button variant="primary" onClick={submit} disabled={createIntent.isPending}>
              {createIntent.isPending ? 'Guardando…' : 'Guardar tema'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setShowForm(false);
                setDraft(EMPTY_DRAFT);
                setFormError(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {pendingDelete && (
        <ConfirmModal
          open
          tone="danger"
          title="Borrar el tema"
          message={
            `Se va a borrar "${pendingDelete.name}" y su historial de configuración. Si sólo ` +
            'querés que el asistente deje de atenderlo, usá "Apagar": es reversible.'
          }
          confirmLabel="Sí, borrar"
          onConfirm={() => {
            deleteIntent.mutate(pendingDelete.id);
            setPendingDelete(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
