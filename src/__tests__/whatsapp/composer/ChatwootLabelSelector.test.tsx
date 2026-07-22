/**
 * ChatwootLabelSelector — campaign-chatwoot-label (design D6, tasks FE.2).
 * Molde EXACTO de `TemplateSelector.test.tsx`: presentacional puro, recibe el
 * catálogo YA fetcheado + loading/error (fetch/gate viven en `CampaignComposer`).
 *
 * chatwoot-label-config-fe — el CTA "Crear label…" (y su gate `messaging.manage`,
 * y el `forwardRef`/`fallbackFocusRef` que lo acompañaba) SALIERON de acá: la
 * creación del catálogo se mudó a Configuración → WhatsApp (`ChatwootLabelsCard`,
 * ver `ChatwootLabelsCard.test.tsx`). Este archivo ya NO mockea
 * `useMyPermissions` — el componente dejó de depender de permisos.
 *
 *  CWL-1 loading → mensaje de carga, sin combobox
 *  CWL-2 error → mensaje role=alert; con `onRetry`, botón "Reintentar" que lo llama
 *  CWL-3 vacío (sin labels, sin loading/error) → hint "se crean en Configuración →
 *        WhatsApp", SIN ningún botón de creación
 *  CWL-4 lista → combobox con label asociado, opción "Sin etiqueta (opcional)" primera
 *  CWL-5 elegir una etiqueta dispara onSelect(title); volver a "Sin etiqueta" dispara onSelect(null)
 *
 * Fix wave (review adversarial, post-apply) que SIGUE vigente:
 *  CWL-8 [F4 LOW] refetch post-create falla → si hay `selected`, la rama
 *        error lo muestra + botón "Quitar" (el payload nunca diverge invisible)
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ChatwootLabelSelector } from '@/pages/whatsapp/BulkMessagingPage/components/composer/ChatwootLabelSelector';
import type { ChatwootLabelDto } from '@/types/messagingBulk';

const COBRANZAS: ChatwootLabelDto = { title: 'cobranzas', color: '#e63946' };
const PROMO: ChatwootLabelDto = { title: 'promo-julio', color: '#1f93ff' };

describe('CWL-1: loading', () => {
  it('muestra mensaje de carga y NO renderiza el combobox', () => {
    render(<ChatwootLabelSelector labels={[]} isLoading isError={false} selected={null} onSelect={vi.fn()} />);
    expect(screen.getByText(/cargando etiquetas de chatwoot/i)).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});

describe('CWL-2: error', () => {
  it('muestra un mensaje role=alert y NO renderiza el combobox', () => {
    render(<ChatwootLabelSelector labels={[]} isLoading={false} isError selected={null} onSelect={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudieron cargar/i);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('con onRetry, el botón "Reintentar" lo invoca', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <ChatwootLabelSelector
        labels={[]}
        isLoading={false}
        isError
        selected={null}
        onSelect={vi.fn()}
        onRetry={onRetry}
      />,
    );
    await user.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('sin onRetry, no hay botón "Reintentar"', () => {
    render(<ChatwootLabelSelector labels={[]} isLoading={false} isError selected={null} onSelect={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /reintentar/i })).not.toBeInTheDocument();
  });
});

describe('CWL-3: catálogo vacío', () => {
  it('sin labels (ni loading ni error) muestra un hint que apunta a Configuración → WhatsApp, sin botón', () => {
    render(<ChatwootLabelSelector labels={[]} isLoading={false} isError={false} selected={null} onSelect={vi.fn()} />);
    expect(screen.getByText(/no hay etiquetas de chatwoot/i)).toBeInTheDocument();
    expect(screen.getByText(/se crean en configuraci[oó]n → whatsapp/i)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('CWL-4: lista con etiquetas', () => {
  it('renderiza un combobox con label asociado', () => {
    render(
      <ChatwootLabelSelector labels={[COBRANZAS]} isLoading={false} isError={false} selected={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByRole('combobox', { name: /etiqueta de chatwoot/i })).toBeInTheDocument();
  });

  it('la primera opción es "Sin etiqueta (opcional)"', async () => {
    const user = userEvent.setup();
    render(
      <ChatwootLabelSelector labels={[COBRANZAS]} isLoading={false} isError={false} selected={null} onSelect={vi.fn()} />,
    );
    await user.click(screen.getByRole('combobox', { name: /etiqueta de chatwoot/i }));
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent(/sin etiqueta \(opcional\)/i);
  });

  it('no ofrece ningún botón de creación (se mudó a Configuración → WhatsApp)', () => {
    render(
      <ChatwootLabelSelector labels={[COBRANZAS]} isLoading={false} isError={false} selected={null} onSelect={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: /crear/i })).not.toBeInTheDocument();
  });
});

describe('CWL-5: seleccionar una etiqueta', () => {
  it('elegir una etiqueta llama a onSelect con su title', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ChatwootLabelSelector labels={[COBRANZAS, PROMO]} isLoading={false} isError={false} selected={null} onSelect={onSelect} />,
    );
    await user.click(screen.getByRole('combobox', { name: /etiqueta de chatwoot/i }));
    await user.click(screen.getByRole('option', { name: 'promo-julio' }));
    expect(onSelect).toHaveBeenCalledWith('promo-julio');
  });

  it('volver a "Sin etiqueta" llama a onSelect(null)', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ChatwootLabelSelector labels={[COBRANZAS]} isLoading={false} isError={false} selected="cobranzas" onSelect={onSelect} />,
    );
    await user.click(screen.getByRole('combobox', { name: /etiqueta de chatwoot/i }));
    await user.click(screen.getByRole('option', { name: /sin etiqueta \(opcional\)/i }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});

// ─── Fix wave (review adversarial) ───────────────────────────────────────────

describe('CWL-8 (F4 fix-wave, LOW): label elegido visible en la rama error', () => {
  it('con `selected`, la rama error muestra el label elegido + botón "Quitar"', () => {
    render(<ChatwootLabelSelector labels={[]} isLoading={false} isError selected="promo-julio" onSelect={vi.fn()} />);
    expect(screen.getByText('promo-julio')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /quitar/i })).toBeInTheDocument();
  });

  it('sin `selected` (null), la rama error NO muestra nada de eso', () => {
    render(<ChatwootLabelSelector labels={[]} isLoading={false} isError selected={null} onSelect={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /quitar/i })).not.toBeInTheDocument();
  });

  it('"Quitar" llama a onSelect(null) — el payload nunca queda con un label invisible', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ChatwootLabelSelector labels={[]} isLoading={false} isError selected="promo-julio" onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: /quitar/i }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
