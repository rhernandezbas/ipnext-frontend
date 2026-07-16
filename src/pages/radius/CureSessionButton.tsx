import { useState } from 'react';
import { useConfirm } from '@/context/ConfirmContext';
import { useCureSession } from '@/hooks/useRadiusSessionCures';
import {
  isCureSkippedAlive,
  isCureSkippedAmbiguous,
  isOrchestratorUnreachable,
  cureErrorReason,
} from '@/utils/mapCureSessionError';
import type { CureSessionResult } from '@/types/radiusSessionCure';
import styles from './CureSessionButton.module.css';

interface CureSessionButtonProps {
  username: string;
}

type FeedbackTone = 'success' | 'info' | 'error';
interface Feedback {
  tone: FeedbackTone;
  message: string;
}

const GENERIC_ERROR = 'No se pudo curar la sesión.';

/**
 * Deriva el feedback visible de un 200 según el `outcome` agregado (D8) — el POST
 * responde 200 para cured/already_cured/skipped_no_session/skipped_no_signal/
 * flagged_flapping/failed-sin-orchestrator-caído (los ÚNICOS 409/502 los maneja
 * el caller ANTES de llegar acá).
 */
function feedbackForOutcome(result: CureSessionResult): Feedback {
  switch (result.outcome) {
    case 'cured':
      return { tone: 'success', message: 'Sesión curada: se envió el CoA y se cerró contablemente.' };
    case 'already_cured':
      return { tone: 'info', message: 'La sesión ya estaba curada (el sistema se adelantó).' };
    case 'skipped_no_session':
      return { tone: 'info', message: 'No hay una sesión abierta para este usuario — puede que ya se haya cerrado sola.' };
    case 'skipped_no_signal':
      return { tone: 'info', message: 'Sin señal suficiente para evaluar la cura (el orchestrator no informó última actividad).' };
    case 'flagged_flapping':
      return {
        tone: 'error',
        message: 'Este usuario acumula curas repetidas (posible credencial compartida o sesión clonada) — no se curó; es un caso de soporte.',
      };
    case 'failed':
      return {
        tone: 'error',
        message: result.reason ? `No se pudo curar la sesión (${result.reason}).` : GENERIC_ERROR,
      };
    default:
      // Outcome nuevo del BE sin release FE — texto plano, nunca crashea (D-W2.5.5).
      return { tone: 'info', message: `Resultado: ${result.outcome}.` };
  }
}

/**
 * Botón "Curar sesión colgada" (radius-session-autocure FE-1, REQ-FE-CURE-2) — escape
 * hatch de las filas `session_stuck` de "Errores de auth". Doble confirmación, NUNCA
 * automática:
 *   1. confirm 1 explica el efecto (CoA Disconnect + cierre contable) → POST SIN force.
 *   2. Si el BE responde 409 (CURE_SKIPPED_ALIVE / CURE_SKIPPED_AMBIGUOUS) — los gates
 *      fail-closed detectaron la sesión posiblemente viva/ambigua — se muestra el
 *      motivo REAL del BE y se pide un SEGUNDO confirm explícito con copy de riesgo
 *      antes de reenviar con `force: true`. Un 502 (orchestrator caído) NO es un gate:
 *      no se ofrece forzar (forzar no arregla que el orchestrator esté caído).
 * El refresco del tab "Sesiones curadas" lo maneja `useCureSession` (invalidate
 * onSettled) — cualquier intento, exitoso o rechazado por el gate, deja fila (D8).
 */
export function CureSessionButton({ username }: CureSessionButtonProps) {
  const confirm = useConfirm();
  const cureSession = useCureSession();
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function runCure(force: boolean) {
    try {
      const result = await cureSession.mutateAsync({ username, force: force || undefined });
      setFeedback(feedbackForOutcome(result));
    } catch (err) {
      if (!force && isCureSkippedAlive(err)) {
        await offerForce(err, 'La sesión parece estar viva.');
        return;
      }
      if (!force && isCureSkippedAmbiguous(err)) {
        await offerForce(err, 'Hay sesiones activas en varios NAS a la vez (estado ambiguo).');
        return;
      }
      if (isOrchestratorUnreachable(err)) {
        setFeedback({
          tone: 'error',
          message: 'No se pudo contactar el RADIUS (orchestrator caído). Reintentá más tarde.',
        });
        return;
      }
      setFeedback({ tone: 'error', message: cureErrorReason(err, GENERIC_ERROR) });
    }
  }

  /** El ÚNICO camino a `force: true` — segunda confirmación explícita, jamás automática. */
  async function offerForce(err: unknown, hint: string) {
    const reason = cureErrorReason(err, hint);
    const ok = await confirm({
      title: 'Forzar la cura',
      message: `El sistema rechazó la cura automática: "${reason}". Forzar la desconecta igual — ¿continuar?`,
      tone: 'danger',
      confirmLabel: 'Forzar cura',
    });
    if (ok) {
      await runCure(true);
    } else {
      setFeedback({ tone: 'info', message: 'Cura cancelada — la sesión sigue como estaba.' });
    }
  }

  async function handleClick() {
    setFeedback(null);
    const ok = await confirm({
      title: 'Curar sesión colgada',
      message: `Esto va a intentar desconectar (CoA) y cerrar contablemente la sesión colgada de ${username}. ¿Continuar?`,
      confirmLabel: 'Curar sesión',
    });
    if (!ok) return;
    await runCure(false);
  }

  const toneClass =
    feedback?.tone === 'error' ? styles.feedbackError
      : feedback?.tone === 'success' ? styles.feedbackSuccess
        : styles.feedbackInfo;

  return (
    <div className={styles.cureCell}>
      <button
        type="button"
        className={styles.cureBtn}
        onClick={handleClick}
        disabled={cureSession.isPending}
      >
        {cureSession.isPending ? 'Curando…' : 'Curar sesión colgada'}
      </button>
      {feedback && (
        <div
          className={toneClass}
          role={feedback.tone === 'error' ? 'alert' : 'status'}
          aria-live={feedback.tone === 'error' ? 'assertive' : 'polite'}
        >
          {feedback.message}
        </div>
      )}
    </div>
  );
}
