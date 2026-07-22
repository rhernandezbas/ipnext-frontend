/**
 * ChatwootLabelSelector — campaign-chatwoot-label (design D6, tasks FE.2).
 * Molde EXACTO de `TemplateSelector.test.tsx`: presentacional puro, recibe el
 * catálogo YA fetcheado + loading/error (fetch/gate viven en `CampaignComposer`).
 *
 *  CWL-1 loading → mensaje de carga, sin combobox
 *  CWL-2 error → mensaje role=alert; con `onRetry`, botón "Reintentar" que lo llama
 *  CWL-3 vacío (sin labels, sin loading/error) → aviso "no hay etiquetas"
 *  CWL-4 lista → combobox con label asociado, opción "Sin etiqueta (opcional)" primera
 *  CWL-5 elegir una etiqueta dispara onSelect(title); volver a "Sin etiqueta" dispara onSelect(null)
 *  CWL-6 el CTA "Crear label…" llama a onCreateClick (empty Y success)
 *  CWL-7 permisos: el CTA "Crear label…" solo aparece con `messaging.manage`
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ChatwootLabelSelector } from '@/pages/whatsapp/BulkMessagingPage/components/composer/ChatwootLabelSelector';
import type { ChatwootLabelDto } from '@/types/messagingBulk';

vi.mock('@/hooks/useMyPermissions');

import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';

const COBRANZAS: ChatwootLabelDto = { title: 'cobranzas', color: '#e63946' };
const PROMO: ChatwootLabelDto = { title: 'promo-julio', color: '#1f93ff' };

function mockPerms(granted: boolean) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions: granted ? ['messaging.manage'] : [],
    isLoading: false,
    isError: false,
    can: () => granted,
  } as UseMyPermissionsResult);
}

describe('CWL-1: loading', () => {
  it('muestra mensaje de carga y NO renderiza el combobox', () => {
    mockPerms(true);
    render(
      <ChatwootLabelSelector
        labels={[]}
        isLoading
        isError={false}
        selected={null}
        onSelect={vi.fn()}
        onCreateClick={vi.fn()}
      />,
    );
    expect(screen.getByText(/cargando etiquetas de chatwoot/i)).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});

describe('CWL-2: error', () => {
  it('muestra un mensaje role=alert y NO renderiza el combobox', () => {
    mockPerms(true);
    render(
      <ChatwootLabelSelector
        labels={[]}
        isLoading={false}
        isError
        selected={null}
        onSelect={vi.fn()}
        onCreateClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudieron cargar/i);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('con onRetry, el botón "Reintentar" lo invoca', async () => {
    mockPerms(true);
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <ChatwootLabelSelector
        labels={[]}
        isLoading={false}
        isError
        selected={null}
        onSelect={vi.fn()}
        onCreateClick={vi.fn()}
        onRetry={onRetry}
      />,
    );
    await user.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('sin onRetry, no hay botón "Reintentar"', () => {
    mockPerms(true);
    render(
      <ChatwootLabelSelector
        labels={[]}
        isLoading={false}
        isError
        selected={null}
        onSelect={vi.fn()}
        onCreateClick={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /reintentar/i })).not.toBeInTheDocument();
  });
});

describe('CWL-3: catálogo vacío', () => {
  it('sin labels (ni loading ni error) muestra un aviso', () => {
    mockPerms(true);
    render(
      <ChatwootLabelSelector
        labels={[]}
        isLoading={false}
        isError={false}
        selected={null}
        onSelect={vi.fn()}
        onCreateClick={vi.fn()}
      />,
    );
    expect(screen.getByText(/no hay etiquetas de chatwoot/i)).toBeInTheDocument();
  });
});

describe('CWL-4: lista con etiquetas', () => {
  it('renderiza un combobox con label asociado', () => {
    mockPerms(true);
    render(
      <ChatwootLabelSelector
        labels={[COBRANZAS]}
        isLoading={false}
        isError={false}
        selected={null}
        onSelect={vi.fn()}
        onCreateClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('combobox', { name: /etiqueta de chatwoot/i })).toBeInTheDocument();
  });

  it('la primera opción es "Sin etiqueta (opcional)"', async () => {
    mockPerms(true);
    const user = userEvent.setup();
    render(
      <ChatwootLabelSelector
        labels={[COBRANZAS]}
        isLoading={false}
        isError={false}
        selected={null}
        onSelect={vi.fn()}
        onCreateClick={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('combobox', { name: /etiqueta de chatwoot/i }));
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent(/sin etiqueta \(opcional\)/i);
  });
});

describe('CWL-5: seleccionar una etiqueta', () => {
  it('elegir una etiqueta llama a onSelect con su title', async () => {
    mockPerms(true);
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ChatwootLabelSelector
        labels={[COBRANZAS, PROMO]}
        isLoading={false}
        isError={false}
        selected={null}
        onSelect={onSelect}
        onCreateClick={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('combobox', { name: /etiqueta de chatwoot/i }));
    await user.click(screen.getByRole('option', { name: 'promo-julio' }));
    expect(onSelect).toHaveBeenCalledWith('promo-julio');
  });

  it('volver a "Sin etiqueta" llama a onSelect(null)', async () => {
    mockPerms(true);
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ChatwootLabelSelector
        labels={[COBRANZAS]}
        isLoading={false}
        isError={false}
        selected="cobranzas"
        onSelect={onSelect}
        onCreateClick={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('combobox', { name: /etiqueta de chatwoot/i }));
    await user.click(screen.getByRole('option', { name: /sin etiqueta \(opcional\)/i }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});

describe('CWL-6: CTA "Crear label…"', () => {
  it('en el catálogo vacío, clickear el CTA llama a onCreateClick', async () => {
    mockPerms(true);
    const user = userEvent.setup();
    const onCreateClick = vi.fn();
    render(
      <ChatwootLabelSelector
        labels={[]}
        isLoading={false}
        isError={false}
        selected={null}
        onSelect={vi.fn()}
        onCreateClick={onCreateClick}
      />,
    );
    await user.click(screen.getByRole('button', { name: /crear label/i }));
    expect(onCreateClick).toHaveBeenCalledTimes(1);
  });

  it('con catálogo no-vacío, el CTA también está disponible', async () => {
    mockPerms(true);
    const user = userEvent.setup();
    const onCreateClick = vi.fn();
    render(
      <ChatwootLabelSelector
        labels={[COBRANZAS]}
        isLoading={false}
        isError={false}
        selected={null}
        onSelect={vi.fn()}
        onCreateClick={onCreateClick}
      />,
    );
    await user.click(screen.getByRole('button', { name: /crear label/i }));
    expect(onCreateClick).toHaveBeenCalledTimes(1);
  });
});

describe('CWL-7: gate de permiso messaging.manage', () => {
  it('sin messaging.manage, el CTA "Crear label…" NO se muestra (catálogo vacío)', () => {
    mockPerms(false);
    render(
      <ChatwootLabelSelector
        labels={[]}
        isLoading={false}
        isError={false}
        selected={null}
        onSelect={vi.fn()}
        onCreateClick={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /crear label/i })).not.toBeInTheDocument();
  });

  it('sin messaging.manage, el CTA tampoco se muestra con catálogo no-vacío (el Select sigue disponible)', () => {
    mockPerms(false);
    render(
      <ChatwootLabelSelector
        labels={[COBRANZAS]}
        isLoading={false}
        isError={false}
        selected={null}
        onSelect={vi.fn()}
        onCreateClick={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /crear label/i })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /etiqueta de chatwoot/i })).toBeInTheDocument();
  });
});
