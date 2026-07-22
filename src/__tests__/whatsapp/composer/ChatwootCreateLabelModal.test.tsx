/**
 * ChatwootCreateLabelModal — campaign-chatwoot-label (design D6, tasks FE.3).
 * Mini-modal "Crear label…" del `ChatwootLabelSelector`. Shell de a11y calcado
 * de `CannedResponseFormModal`/`ConfirmModal` (portal, focus-trap, Esc/backdrop
 * cancelan, scroll-lock, restauración de foco).
 *
 *  CCL-1 open=false → no renderiza nada
 *  CCL-2 normalización visible: "Promo Julio" → preview "promo-julio"
 *  CCL-3 charset inválido (ej. "!") → submit deshabilitado + mensaje
 *  CCL-4 título vacío → submit deshabilitado (sin mensaje de charset)
 *  CCL-5 submit válido → onSubmit({title: normalizado, color}) — default `#1f93ff`
 *  CCL-6 serverError (400/503) se muestra role=alert, el modal NO se cierra solo
 *  CCL-7 Cancelar / Esc / backdrop → onCancel
 *  CCL-8 busy → botones deshabilitados, label "Creando…"
 *
 * Fix wave (review adversarial, post-apply):
 *  CCL-9  [F1 MED-A11Y] el swatch de color es un dot aria-hidden SIN texto
 *         adentro — el título va en un span de texto normal sobre fondo
 *         neutro (elimina texto-sobre-color-arbitrario, contraste 3.15:1 con
 *         el default #1f93ff via `readableTextColor`)
 *  CCL-10 [F2 LOW-A11Y] si el nodo que abrió el modal ya no está montado al
 *         cerrar (ej. el trigger de la rama emptyState se desmontó porque el
 *         catálogo pasó a tener 1 label), el foco cae a un `fallbackFocusRef`
 *         estable en vez de quedar en `document.body`
 *  CCL-11 [F3 LOW] título que normaliza a vacío (ej. solo espacios) — hint
 *         "El título no puede quedar vacío" + submit deshabilitado
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState, type RefObject } from 'react';
import { describe, it, expect, vi } from 'vitest';
import {
  ChatwootCreateLabelModal,
  normalizeChatwootLabelTitle,
  CHATWOOT_LABEL_DEFAULT_COLOR,
} from '@/pages/whatsapp/BulkMessagingPage/components/composer/ChatwootCreateLabelModal';

describe('CCL-1: open=false', () => {
  it('no renderiza nada', () => {
    render(<ChatwootCreateLabelModal open={false} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('CCL-2: normalización visible', () => {
  it('normalizeChatwootLabelTitle: lowercase + espacios→guiones', () => {
    expect(normalizeChatwootLabelTitle('Promo Julio')).toBe('promo-julio');
    expect(normalizeChatwootLabelTitle('  Cobranzas  Urgentes ')).toBe('cobranzas-urgentes');
  });

  it('tipear "Promo Julio" muestra el preview "promo-julio"', async () => {
    const user = userEvent.setup();
    render(<ChatwootCreateLabelModal open onSubmit={vi.fn()} onCancel={vi.fn()} />);
    await user.type(screen.getByLabelText(/nombre/i), 'Promo Julio');
    // "promo-julio" aparece DOS veces (preview del título final + swatch de
    // color) — se acota al preview textual por su id (`aria-describedby`).
    expect(screen.getByText((_, node) => node?.id === 'chatwoot-label-title-preview')).toHaveTextContent(
      'promo-julio',
    );
  });
});

describe('CCL-3: charset inválido', () => {
  it('un símbolo no permitido (ej. "!") deshabilita el submit y muestra el mensaje', async () => {
    const user = userEvent.setup();
    render(<ChatwootCreateLabelModal open onSubmit={vi.fn()} onCancel={vi.fn()} />);
    await user.type(screen.getByLabelText(/nombre/i), 'promo!');
    expect(screen.getByRole('button', { name: /crear/i })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/letras, números, guiones/i);
  });
});

describe('CCL-4: título vacío', () => {
  it('sin tipear nada, el submit queda deshabilitado (sin mensaje de charset)', () => {
    render(<ChatwootCreateLabelModal open onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /crear/i })).toBeDisabled();
    expect(screen.queryByText(/letras, números, guiones/i)).not.toBeInTheDocument();
  });
});

describe('CCL-5: submit válido', () => {
  it('llama a onSubmit con el título normalizado y el color default #1f93ff', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ChatwootCreateLabelModal open onSubmit={onSubmit} onCancel={vi.fn()} />);
    await user.type(screen.getByLabelText(/nombre/i), 'Promo Julio');
    expect(screen.getByRole('button', { name: /crear/i })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /crear/i }));
    expect(onSubmit).toHaveBeenCalledWith({ title: 'promo-julio', color: CHATWOOT_LABEL_DEFAULT_COLOR });
  });

  it('con un color elegido, viaja ese color (no el default)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ChatwootCreateLabelModal open onSubmit={onSubmit} onCancel={vi.fn()} />);
    await user.type(screen.getByLabelText(/nombre/i), 'Cobranzas');
    fireEvent.change(screen.getByLabelText(/color de la etiqueta/i), { target: { value: '#ff0000' } });
    await user.click(screen.getByRole('button', { name: /crear/i }));
    expect(onSubmit).toHaveBeenCalledWith({ title: 'cobranzas', color: '#ff0000' });
  });
});

describe('CCL-6: serverError', () => {
  it('muestra el error del servidor (role=alert) y el modal sigue abierto', () => {
    render(
      <ChatwootCreateLabelModal
        open
        serverError="No se pudo crear la etiqueta: ya existe o Chatwoot no está disponible."
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/ya existe o chatwoot no está disponible/i);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('CCL-7: cancelar / Esc / backdrop', () => {
  it('Cancelar llama a onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ChatwootCreateLabelModal open onSubmit={vi.fn()} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Esc llama a onCancel', () => {
    const onCancel = vi.fn();
    render(<ChatwootCreateLabelModal open onSubmit={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('click en el backdrop llama a onCancel', () => {
    const onCancel = vi.fn();
    render(<ChatwootCreateLabelModal open onSubmit={vi.fn()} onCancel={onCancel} />);
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('CCL-8: busy', () => {
  it('deshabilita ambos botones y muestra "Creando…"', async () => {
    const user = userEvent.setup();
    render(<ChatwootCreateLabelModal open busy onSubmit={vi.fn()} onCancel={vi.fn()} />);
    await user.type(screen.getByLabelText(/nombre/i), 'Promo');
    expect(screen.getByRole('button', { name: /creando/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeDisabled();
  });
});

// ─── Fix wave (review adversarial) ───────────────────────────────────────────

describe('CCL-9 (F1 fix-wave, MED-A11Y): swatch sin texto sobre el color', () => {
  it('el dot de color es aria-hidden y SIN texto; el título vive en un span de texto normal aparte', async () => {
    const user = userEvent.setup();
    render(<ChatwootCreateLabelModal open onSubmit={vi.fn()} onCancel={vi.fn()} />);
    await user.type(screen.getByLabelText(/nombre/i), 'Promo Julio');

    const dot = screen.getByTestId('chatwoot-label-swatch-dot');
    expect(dot).toHaveAttribute('aria-hidden', 'true');
    expect(dot).toHaveTextContent('');

    const label = screen.getByTestId('chatwoot-label-swatch-label');
    expect(label).toHaveTextContent('promo-julio');
    // el color NUNCA se aplica como color de TEXTO (eso era el bug de contraste) —
    // el color vive exclusivamente en el `background-color` del dot decorativo.
    expect(label.style.color).toBe('');
    expect(label.style.backgroundColor).toBe('');
  });

  it('el default #1f93ff se ve en el dot (background), nunca como color de texto', () => {
    render(<ChatwootCreateLabelModal open onSubmit={vi.fn()} onCancel={vi.fn()} />);
    const dot = screen.getByTestId('chatwoot-label-swatch-dot');
    // jsdom preserva el string tal cual (no normaliza a rgb()) — alcanza para
    // probar que el color vive en el `background-color` del dot, no en texto.
    expect(dot.style.backgroundColor).toBe(CHATWOOT_LABEL_DEFAULT_COLOR);
  });
});

describe('CCL-10 (F2 fix-wave, LOW-A11Y): fallback de restauración de foco', () => {
  /**
   * Harness: abre el modal desde un trigger que se DESMONTA de forma
   * SÍNCRONA dentro de `onSubmit` (antes de que el modal cierre).
   *
   * OJO (re-review empírica, F2-bis) — esto NO reproduce la condición de
   * carrera REAL del composer: en `CampaignComposer` real, el trigger
   * (rama `emptyState` del `ChatwootLabelSelector`) se desmonta cuando el
   * CATÁLOGO cambia (`useChatwootLabels`), un evento asíncrono con latencia
   * de red REAL que puede llegar ANTES o DESPUÉS de que el modal cierre. Este
   * harness solo prueba la MECÁNICA del fallback (`el.isConnected === false`
   * → usar `fallbackFocusRef`) de forma determinística y rápida — el
   * escenario real, con el desmonte ocurriendo con latencia (>=100ms,
   * DESPUÉS de que el modal ya cerró), lo cubre
   * `CampaignComposer.chatwootLabel.test.tsx` ("F2-bis"), que fue el que
   * detectó que el fix real vive en `useCreateChatwootLabel`
   * (`setQueryData` síncrono antes del `invalidateQueries`), no en el modal.
   */
  function Harness() {
    const [open, setOpen] = useState(false);
    const [triggerMounted, setTriggerMounted] = useState(true);
    const fallbackRef = useRef<HTMLDivElement>(null);
    return (
      <div>
        <div ref={fallbackRef} tabIndex={-1} data-testid="fallback-target">
          selector
        </div>
        {triggerMounted && (
          <button data-testid="trigger" onClick={() => setOpen(true)}>
            + Crear label…
          </button>
        )}
        <ChatwootCreateLabelModal
          open={open}
          fallbackFocusRef={fallbackRef}
          onSubmit={() => {
            // El submit real desmonta el trigger (el catálogo pasa a tener 1
            // label → la rama emptyState, dueña del botón, se desmonta).
            setTriggerMounted(false);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      </div>
    );
  }

  it('si el trigger original ya no está montado al cerrar, el foco cae al fallbackFocusRef (no a body)', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByTestId('trigger'));
    await user.type(screen.getByLabelText(/nombre/i), 'Cobranzas');
    await user.click(screen.getByRole('button', { name: /^crear$/i }));

    await waitFor(() => expect(screen.getByTestId('fallback-target')).toHaveFocus());
    expect(document.body).not.toHaveFocus();
  });

  it('si el trigger original SIGUE montado, la restauración normal (al trigger) sigue intacta', async () => {
    const user = userEvent.setup();
    const fallbackRef = { current: null } as RefObject<HTMLDivElement>;
    const onCancel = vi.fn();
    function StableHarness() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button data-testid="trigger" onClick={() => setOpen(true)}>
            abrir
          </button>
          <ChatwootCreateLabelModal
            open={open}
            fallbackFocusRef={fallbackRef}
            onSubmit={vi.fn()}
            onCancel={() => {
              onCancel();
              setOpen(false);
            }}
          />
        </div>
      );
    }
    render(<StableHarness />);
    await user.click(screen.getByTestId('trigger'));
    await user.click(screen.getByRole('button', { name: /cancelar/i }));
    await waitFor(() => expect(screen.getByTestId('trigger')).toHaveFocus());
  });
});

describe('CCL-11 (F3 fix-wave, LOW): título que normaliza a vacío', () => {
  it('tipear solo espacios muestra el hint "no puede quedar vacío" y deshabilita el submit', async () => {
    const user = userEvent.setup();
    render(<ChatwootCreateLabelModal open onSubmit={vi.fn()} onCancel={vi.fn()} />);
    await user.type(screen.getByLabelText(/nombre/i), '   ');
    expect(screen.getByRole('button', { name: /crear/i })).toBeDisabled();
    expect(screen.getByText(/el título no puede quedar vacío/i)).toBeInTheDocument();
  });

  it('sin tipear nada (campo intacto), NO muestra el hint agresivo antes de interactuar', () => {
    render(<ChatwootCreateLabelModal open onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByText(/el título no puede quedar vacío/i)).not.toBeInTheDocument();
  });
});
