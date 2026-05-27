import { useCallback, useRef, useState } from 'react';
import type { IClassSendError } from '@/components/molecules/IClassSendResultModal/IClassSendResultModal';

/** Error codes the backend returns from PATCH /scheduling/:id/stage when the
 *  task is sent to the "Enviar a IClass" stage. */
const ICLASS_ERROR_CODES = new Set([
  'MISSING_REQUIRED_FIELDS',
  'ICLASS_NODE_NOT_FOUND',
  'ICLASS_UNAVAILABLE',
  'ICLASS_REJECTED',
]);

/**
 * Reads an axios-shaped error and returns the IClass error payload if the code
 * is one of the IClass send errors; otherwise null. Non-IClass errors (network,
 * validation, etc.) are NOT our concern and fall through to the caller.
 */
export function parseIClassError(err: unknown): IClassSendError | null {
  if (!err || typeof err !== 'object' || !('response' in err)) return null;
  const data = (err as { response?: { data?: { code?: string; missingFields?: string[]; message?: string; reason?: string } } })
    .response?.data;
  const code = data?.code;
  if (!code || !ICLASS_ERROR_CODES.has(code)) return null;
  return { code, missingFields: data?.missingFields, message: data?.message, reason: data?.reason };
}

export interface IClassSendFeedback {
  /** Current IClass error to show in the modal, or null when closed. */
  error: IClassSendError | null;
  /** Current success toast message, or null. */
  toast: string | null;
  /**
   * Inspect a mutation error. If it is an IClass error, opens the modal and
   * returns true (caller should treat the move as failed/rolled-back).
   * Returns false for non-IClass errors so the caller can handle them normally.
   */
  handleError: (err: unknown) => boolean;
  /** Show the success toast with the OS code (no-op when code is null). */
  handleSuccess: (iclassOrderCode: string | null | undefined) => void;
  /** Close the error modal. */
  closeModal: () => void;
}

/**
 * Shared feedback state for moving a task to the IClass stage. Used by both the
 * Kanban drag-drop view and the table StageSelect so the error parsing, modal
 * state, and success toast logic live in exactly one place.
 */
export function useIClassSendFeedback(): IClassSendFeedback {
  const [error, setError] = useState<IClassSendError | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleError = useCallback((err: unknown): boolean => {
    const iclassError = parseIClassError(err);
    if (iclassError) {
      setError(iclassError);
      return true;
    }
    return false;
  }, []);

  const handleSuccess = useCallback((iclassOrderCode: string | null | undefined) => {
    if (!iclassOrderCode) return;
    setToast(`Tarea registrada en IClass — Orden ${iclassOrderCode}`);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const closeModal = useCallback(() => setError(null), []);

  return { error, toast, handleError, handleSuccess, closeModal };
}
