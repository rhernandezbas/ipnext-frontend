import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { ConfirmModal } from '@/components/molecules/ConfirmModal/ConfirmModal';

export interface ConfirmOptions {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

/** A bare string is shorthand for `{ message: string }`. */
export type ConfirmInput = string | ConfirmOptions;

export type ConfirmFn = (input: ConfirmInput) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Imperative, promise-based replacement for `window.confirm`.
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ message: '¿Eliminar?', tone: 'danger' })) { ... }
 *
 * Resolves `true` on confirm, `false` on cancel / backdrop / Escape.
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return ctx;
}

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions;
}

const CLOSED: ConfirmState = { open: false, options: { message: '' } };

interface ConfirmProviderProps {
  children: React.ReactNode;
}

export function ConfirmProvider({ children }: ConfirmProviderProps) {
  const [state, setState] = useState<ConfirmState>(CLOSED);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setState(CLOSED);
  }, []);

  const confirm = useCallback<ConfirmFn>((input) => {
    // A pending dialog gets superseded — resolve the stale promise as cancelled.
    resolverRef.current?.(false);

    const options = typeof input === 'string' ? { message: input } : input;
    setState({ open: true, options });

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handleConfirm = useCallback(() => settle(true), [settle]);
  const handleCancel = useCallback(() => settle(false), [settle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmModal
        open={state.open}
        title={state.options.title ?? 'Confirmar'}
        message={state.options.message}
        confirmLabel={state.options.confirmLabel}
        cancelLabel={state.options.cancelLabel}
        tone={state.options.tone}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  );
}
