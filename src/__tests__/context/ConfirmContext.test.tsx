// This file tests the REAL ConfirmContext implementation, so opt out of the
// global useConfirm mock declared in src/test/setup.ts.
import { vi, describe, it, expect } from 'vitest';
vi.unmock('@/context/ConfirmContext');

import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ConfirmProvider, useConfirm } from '@/context/ConfirmContext';
import type { ConfirmInput } from '@/context/ConfirmContext';

// ── Harness ───────────────────────────────────────────────────────────────────

function Harness({ input }: { input: ConfirmInput }) {
  const confirm = useConfirm();
  const [result, setResult] = useState<string>('idle');
  return (
    <>
      <button onClick={async () => setResult(String(await confirm(input)))}>ask</button>
      <span data-testid="result">{result}</span>
    </>
  );
}

function renderHarness(input: ConfirmInput) {
  return render(
    <ConfirmProvider>
      <Harness input={input} />
    </ConfirmProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useConfirm', () => {
  it('throws when used outside a ConfirmProvider', () => {
    function Orphan() {
      useConfirm();
      return null;
    }
    // Silence the expected React error boundary noise
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Orphan />)).toThrow(/ConfirmProvider/);
    spy.mockRestore();
  });

  it('shows the dialog with the given message when confirm is called', async () => {
    const user = userEvent.setup();
    renderHarness('¿Eliminar esto?');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ask' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('¿Eliminar esto?')).toBeInTheDocument();
  });

  it('resolves to true and closes when the confirm button is clicked', async () => {
    const user = userEvent.setup();
    renderHarness('¿Seguro?');

    await user.click(screen.getByRole('button', { name: 'ask' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('true'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('resolves to false and closes when the cancel button is clicked', async () => {
    const user = userEvent.setup();
    renderHarness('¿Seguro?');

    await user.click(screen.getByRole('button', { name: 'ask' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('false'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('resolves to false when Escape is pressed', async () => {
    const user = userEvent.setup();
    renderHarness('¿Seguro?');

    await user.click(screen.getByRole('button', { name: 'ask' }));
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('false'));
  });

  it('accepts an options object with custom labels and danger tone', async () => {
    const user = userEvent.setup();
    renderHarness({
      message: '¿Borrar el cliente?',
      title: 'Eliminar cliente',
      confirmLabel: 'Eliminar',
      cancelLabel: 'No, volver',
      tone: 'danger',
    });

    await user.click(screen.getByRole('button', { name: 'ask' }));

    expect(screen.getByText('Eliminar cliente')).toBeInTheDocument();
    expect(screen.getByText('¿Borrar el cliente?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No, volver' })).toBeInTheDocument();
  });
});
