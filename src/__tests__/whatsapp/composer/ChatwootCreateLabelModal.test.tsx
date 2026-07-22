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
 */
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
