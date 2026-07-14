/**
 * SegmentPreviewPanel — columna derecha del composer (F2 apply chunk 2,
 * SEG-1..SEG-4). Presentacional puro: 4+ ramas (sin criterio/loading/error/
 * resultado), patrón F1.
 *
 *  SPP-1 sin criterio → nota + botón "Ver preview" deshabilitado
 *  SPP-2 con criterio + isPending → estado de carga (aria-busy)
 *  SPP-3 con criterio + isError → mensaje role=alert
 *  SPP-4 con criterio, sin data todavía (esperando el debounce) → nota neutra
 *  SPP-5 con data (count>0) → muestra count + sample
 *  SPP-6 con data.skipped>0 → desglose visible con labels claros
 *  SPP-7 con data.count===0 → mensaje de "0 destinatarios" (role=alert), NO breakdown fantasma
 *  SPP-8 botón "Ver preview" llama a onRefresh
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SegmentPreviewPanel } from '@/pages/whatsapp/BulkMessagingPage/components/composer/SegmentPreviewPanel';
import type { PreviewSegmentOutput } from '@/types/messagingBulk';

const PREVIEW: PreviewSegmentOutput = {
  count: 42,
  sample: [
    { clientId: 'cli-1', name: 'Juan Perez', phoneE164: '+5491100000000' },
    { clientId: 'cli-2', name: 'Maria Gomez', phoneE164: '+5491100000001' },
  ],
  skipped: { optedOut: 1, duplicatePhone: 2, invalidPhone: 3 },
};

const ZERO_PREVIEW: PreviewSegmentOutput = {
  count: 0,
  sample: [],
  skipped: { optedOut: 0, duplicatePhone: 0, invalidPhone: 0 },
};

describe('SPP-1: sin criterio', () => {
  it('muestra una nota y el botón "Ver preview" está deshabilitado', () => {
    render(<SegmentPreviewPanel hasCriteria={false} isPending={false} isError={false} data={undefined} onRefresh={vi.fn()} />);
    expect(screen.getByText(/elegí al menos un criterio/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ver preview/i })).toBeDisabled();
  });
});

describe('SPP-2: cargando', () => {
  it('con criterio + isPending muestra el estado de carga', () => {
    render(<SegmentPreviewPanel hasCriteria isPending isError={false} data={undefined} onRefresh={vi.fn()} />);
    expect(screen.getByRole('button', { name: /ver preview/i })).toBeDisabled();
    expect(screen.getByText(/calculando destinatarios/i)).toBeInTheDocument();
  });
});

describe('SPP-3: error', () => {
  it('con criterio + isError muestra un mensaje role=alert', () => {
    render(<SegmentPreviewPanel hasCriteria isPending={false} isError data={undefined} onRefresh={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo calcular/i);
  });
});

describe('SPP-4: sin data todavía', () => {
  it('con criterio, sin loading/error/data, muestra una nota neutra', () => {
    render(<SegmentPreviewPanel hasCriteria isPending={false} isError={false} data={undefined} onRefresh={vi.fn()} />);
    expect(screen.getByText(/ver preview.*para calcular/i)).toBeInTheDocument();
  });
});

describe('SPP-5: con resultado', () => {
  it('muestra el count y la muestra de nombres', () => {
    render(<SegmentPreviewPanel hasCriteria isPending={false} isError={false} data={PREVIEW} onRefresh={vi.fn()} />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Juan Perez')).toBeInTheDocument();
    expect(screen.getByText('Maria Gomez')).toBeInTheDocument();
  });
});

describe('SPP-6: desglose de skipped', () => {
  it('muestra optedOut/duplicatePhone/invalidPhone con labels claros', () => {
    render(<SegmentPreviewPanel hasCriteria isPending={false} isError={false} data={PREVIEW} onRefresh={vi.fn()} />);
    expect(screen.getByText(/no recibir mensajes/i)).toHaveTextContent('1');
    expect(screen.getByText(/duplicado/i)).toHaveTextContent('2');
    expect(screen.getByText(/inválido/i)).toHaveTextContent('3');
  });
});

describe('SPP-7: count===0', () => {
  it('muestra un mensaje de "0 destinatarios" (role=alert)', () => {
    render(<SegmentPreviewPanel hasCriteria isPending={false} isError={false} data={ZERO_PREVIEW} onRefresh={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/0 destinatarios/i);
  });
});

describe('SPP-8: botón "Ver preview"', () => {
  it('clickearlo llama a onRefresh', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    render(<SegmentPreviewPanel hasCriteria isPending={false} isError={false} data={PREVIEW} onRefresh={onRefresh} />);

    await user.click(screen.getByRole('button', { name: /ver preview/i }));

    expect(onRefresh).toHaveBeenCalled();
  });
});

describe('SPP-9: el conteo positivo se anuncia (FIX-7a)', () => {
  it('el "N destinatarios recibirán" es una live region (aria-live=polite)', () => {
    render(<SegmentPreviewPanel hasCriteria isPending={false} isError={false} data={PREVIEW} onRefresh={vi.fn()} />);
    const count = screen.getByText(/recibirán el mensaje/i);
    expect(count).toHaveAttribute('aria-live', 'polite');
  });
});
