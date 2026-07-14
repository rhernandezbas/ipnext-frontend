/**
 * CampaignStatusPill (F2 apply chunk 3, HIST-1) — pill LOCAL para
 * `CampaignStatusDto`. Presentacional puro (sin hooks) — molde
 * `SegmentPreviewPanel.test.tsx`.
 *
 *  CSP-1 cada estado muestra su TEXTO (no solo color, WCAG 1.4.1)
 *  CSP-2 cada estado aplica la clase de color correspondiente
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CampaignStatusPill } from '@/pages/whatsapp/BulkMessagingPage/components/history/CampaignStatusPill';
import type { CampaignStatusDto } from '@/types/messagingBulk';

const CASES: { status: CampaignStatusDto; label: string }[] = [
  { status: 'pending', label: 'Pendiente' },
  { status: 'running', label: 'Enviando' },
  { status: 'paused', label: 'Pausada' },
  { status: 'done', label: 'Completada' },
  { status: 'failed', label: 'Fallida' },
];

describe('CSP-1: texto del estado', () => {
  it.each(CASES)('$status muestra el texto "$label"', ({ status, label }) => {
    render(<CampaignStatusPill status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

describe('CSP-2: clase de color por estado', () => {
  it.each(CASES)('$status aplica la clase "$status"', ({ status, label }) => {
    render(<CampaignStatusPill status={status} />);
    expect(screen.getByText(label)).toHaveClass(status);
  });
});
