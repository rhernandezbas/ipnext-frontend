import { useState } from 'react';
import { Button } from '@/components/atoms/Button/Button';
import { Input } from '@/components/atoms/Input/Input';
import { Spinner } from '@/components/atoms/Spinner/Spinner';
import { useAssistantEvals, useRecordAssistantEval } from '@/hooks/useAssistant';
import { useCan } from '@/hooks/useMyPermissions';
import { formatDateTimeShort } from '@/utils/formatDate';
import styles from './AssistantEvalCard.module.css';

/**
 * ai-assistant-multiagent (EVAL-1/EVAL-2) — corridas de evaluación.
 *
 * **Esto no es un tablero: es el candado de `resolve_conversation`.** Sin una corrida
 * registrada, esa acción no se puede habilitar. Marcar resuelta una conversación cuyo pedido
 * seguía vivo entierra el reclamo y el cliente queda sin respuesta — por eso se prende con
 * datos, no con entusiasmo.
 *
 * Las dos particiones se muestran SEPARADAS y nunca promediadas:
 *  - **resolución** — ¿acierta cuando la respuesta existe?
 *  - **abstención** — ¿se calla cuando NO existe?
 *
 * Un "accuracy" único esconde el modo de falla peligroso. En el benchmark sobre tickets
 * reales, el modelo que más resolvía era el PEOR resistiendo alucinaciones: promediar lo
 * habría dejado primero en el ranking.
 *
 * El historial existe para que el candado sea AUDITABLE. Un candado que nadie puede
 * inspeccionar deja de ser una salvaguarda: alguien registra cualquier cosa una vez y queda
 * destrabado para siempre sin que se note.
 */

function backendMessage(error: unknown): string | null {
  const data = (error as { response?: { data?: { error?: unknown } } })?.response?.data;
  return typeof data?.error === 'string' ? data.error : null;
}

const pct = (rate: number | null) => (rate === null ? '—' : `${Math.round(rate * 100)}%`);

interface Draft {
  model: string;
  resolutionTotal: string;
  resolutionCorrect: string;
  abstentionTotal: string;
  abstentionCorrect: string;
  notes: string;
}

const EMPTY: Draft = {
  model: 'deepseek-chat',
  resolutionTotal: '',
  resolutionCorrect: '',
  abstentionTotal: '',
  abstentionCorrect: '',
  notes: '',
};

/**
 * Valida ANTES de mandar. El backend impone las mismas reglas (422) y es la autoridad, pero
 * dejar que el operador complete seis campos para recién ahí decirle que la partición de
 * abstención no puede estar vacía es hacerle perder el tiempo.
 */
function validate(d: Draft): string | null {
  const nums = {
    rt: Number(d.resolutionTotal),
    rc: Number(d.resolutionCorrect),
    at: Number(d.abstentionTotal),
    ac: Number(d.abstentionCorrect),
  };
  if (Object.values(nums).some(n => !Number.isInteger(n) || n < 0)) {
    return 'Los cuatro conteos tienen que ser números enteros no negativos.';
  }
  if (d.model.trim() === '') return 'Indicá qué modelo evaluaste.';
  if (nums.at === 0) {
    return (
      'La partición de abstención no puede estar vacía: un eval que sólo mide si el bot acierta ' +
      'ignora el modo de falla peligroso, que es que invente en vez de callarse.'
    );
  }
  if (nums.rt === 0) return 'La partición de resolución no puede estar vacía.';
  if (nums.rc > nums.rt) return 'Los aciertos de resolución no pueden superar sus casos.';
  if (nums.ac > nums.at) return 'Las veces que se calló no pueden superar sus casos.';
  return null;
}

export function AssistantEvalCard() {
  const evals = useAssistantEvals();
  const record = useRecordAssistantEval();
  const canManage = useCan('assistant.manage');

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [localError, setLocalError] = useState<string | null>(null);

  if (evals.isLoading) {
    return (
      <div className={styles.state}>
        <Spinner />
        <span>Cargando evaluaciones…</span>
      </div>
    );
  }

  if (evals.isError || !evals.data) {
    return (
      <div className={styles.state} role="alert">
        <p>No se pudo leer el historial de evaluaciones.</p>
        <Button variant="secondary" onClick={() => evals.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  const runs = evals.data;
  const unlocked = runs.length > 0;

  const set = (field: keyof Draft) => (value: string) => {
    setLocalError(null);
    setDraft(prev => ({ ...prev, [field]: value }));
  };

  const submit = async () => {
    const problem = validate(draft);
    setLocalError(problem);
    if (problem) return;

    await record.mutateAsync({
      model: draft.model.trim(),
      resolutionTotal: Number(draft.resolutionTotal),
      resolutionCorrect: Number(draft.resolutionCorrect),
      abstentionTotal: Number(draft.abstentionTotal),
      abstentionCorrect: Number(draft.abstentionCorrect),
      notes: draft.notes.trim() === '' ? null : draft.notes.trim(),
    });
    setDraft(EMPTY);
  };

  const rejection = record.isError ? backendMessage(record.error) : null;

  return (
    <div className={styles.card}>
      <p className={unlocked ? styles.unlocked : styles.locked} role="status">
        {unlocked ? (
          <>
            Hay {runs.length} evaluación{runs.length === 1 ? '' : 'es'} registrada
            {runs.length === 1 ? '' : 's'}: ya se puede <strong>habilitar</strong> &quot;Marcar
            la conversación como resuelta&quot;.
          </>
        ) : (
          <>
            Todavía no hay ninguna evaluación registrada, así que{' '}
            <strong>&quot;Marcar la conversación como resuelta&quot; no se puede habilitar</strong>.
            Es deliberado: esa acción entierra el reclamo de un cliente si el bot se equivoca.
          </>
        )}
      </p>

      {canManage && (
        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="eval-model">
              Modelo evaluado
            </label>
            <Input
              id="eval-model"
              value={draft.model}
              onChange={e => set('model')(e.target.value)}
            />
          </div>

          <fieldset className={styles.partition}>
            <legend className={styles.legend}>Resolución — ¿acierta cuando sabe?</legend>
            <div className={styles.pairRow}>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="eval-res-total">
                  Casos de resolución
                </label>
                <Input
                  id="eval-res-total"
                  inputMode="numeric"
                  value={draft.resolutionTotal}
                  onChange={e => set('resolutionTotal')(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="eval-res-ok">
                  Aciertos de resolución
                </label>
                <Input
                  id="eval-res-ok"
                  inputMode="numeric"
                  value={draft.resolutionCorrect}
                  onChange={e => set('resolutionCorrect')(e.target.value)}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className={styles.partition}>
            <legend className={styles.legend}>
              Abstención — ¿se calla cuando NO sabe? <span className={styles.key}>(la que importa)</span>
            </legend>
            <span className={styles.fieldHint}>
              Casos donde la respuesta correcta NO existe en los datos. Sin esta partición el
              eval mide sólo lo fácil y premia al modelo que contesta siempre.
            </span>
            <div className={styles.pairRow}>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="eval-abs-total">
                  Casos de abstención
                </label>
                <Input
                  id="eval-abs-total"
                  inputMode="numeric"
                  value={draft.abstentionTotal}
                  onChange={e => set('abstentionTotal')(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="eval-abs-ok">
                  Veces que se calló bien
                </label>
                <Input
                  id="eval-abs-ok"
                  inputMode="numeric"
                  value={draft.abstentionCorrect}
                  onChange={e => set('abstentionCorrect')(e.target.value)}
                />
              </div>
            </div>
          </fieldset>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="eval-notes">
              Notas (qué se corrió, sobre qué muestra)
            </label>
            <Input
              id="eval-notes"
              value={draft.notes}
              onChange={e => set('notes')(e.target.value)}
              placeholder="100 conversaciones reales de julio"
            />
          </div>

          {(localError || rejection) && (
            <p className={styles.error} role="alert">
              {localError ?? rejection}
            </p>
          )}

          <div className={styles.actions}>
            <Button variant="primary" onClick={submit} disabled={record.isPending}>
              {record.isPending ? 'Registrando…' : 'Registrar evaluación'}
            </Button>
          </div>
        </div>
      )}

      {/* Sin corridas NO se renderiza historial: el banner de arriba ya dice que no hay
          ninguna. Un "no hay datos" debajo de un "todavía no hay ninguna evaluación" es el
          mismo mensaje dos veces, y el segundo no agrega nada. */}
      {runs.length > 0 && (
        <div className={styles.history}>
          <ul className={styles.runs}>
            {runs.map(run => (
              <li key={run.id} className={styles.run}>
                <div className={styles.runHead}>
                  <span className={styles.runModel}>{run.model}</span>
                  <span className={styles.runDate}>{formatDateTimeShort(run.createdAt)}</span>
                </div>
                <div className={styles.rates}>
                  {/* Separadas SIEMPRE: el promedio escondería el modo de falla peligroso. */}
                  <span className={styles.rate}>
                    Resolución <strong>{pct(run.resolutionAccuracy)}</strong>
                    <span className={styles.sample}> · {run.resolutionTotal} casos</span>
                  </span>
                  <span className={styles.rate}>
                    Abstención <strong>{pct(run.abstentionRate)}</strong>
                    <span className={styles.sample}> · {run.abstentionTotal} casos</span>
                  </span>
                </div>
                {run.notes && <p className={styles.runNotes}>{run.notes}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
