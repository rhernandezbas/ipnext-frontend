/**
 * SuricataConversationTab (Fase H, task H.2, spec `suricata-tickets-ui` UI-3).
 *
 *  CNV-1 empty    → explicit empty state when there are no messages yet
 *  CNV-2 lanes    → 'customer'/'agent'/'system' render as distinguishable, labeled lanes
 *  CNV-3 order    → messages render in the order the DTO already provides (oldest → newest)
 *  CNV-4 audio    → a `stored` audio attachment renders an inline, playable `<audio>` — never a bare link
 *  CNV-5 pending  → a NOT-yet-stored audio attachment is an honest placeholder, never a broken/bare link
 */
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SuricataConversationTab } from '@/pages/suricata/SuricataTicketDetail/SuricataConversationTab';
import type { SuricataAttachmentDto, SuricataMessageDto } from '@/pages/suricata/api/suricataClient';

function makeMessage(overrides: Partial<SuricataMessageDto> = {}): SuricataMessageDto {
  return {
    id: 'm-1',
    author: 'María Gómez',
    authorKind: 'customer',
    body: 'No tengo internet desde esta mañana',
    sentAt: '2026-09-12T14:03:00.000Z',
    ...overrides,
  };
}

function makeAttachment(overrides: Partial<SuricataAttachmentDto> = {}): SuricataAttachmentDto {
  return {
    id: 'a-1',
    messageId: 'm-1',
    fileName: 'nota.ogg',
    mimeType: 'audio/ogg',
    sizeBytes: 4200,
    status: 'stored',
    ...overrides,
  };
}

describe('CNV-1 empty', () => {
  it('shows an explicit empty state with zero messages', () => {
    render(<SuricataConversationTab ticketId="t-1" messages={[]} attachments={[]} />);
    expect(screen.getByText(/sin mensajes/i)).toBeInTheDocument();
  });
});

describe('CNV-2 lanes', () => {
  it('labels a customer message distinctly from an agent message', () => {
    render(
      <SuricataConversationTab
        ticketId="t-1"
        messages={[
          makeMessage({ id: 'm-1', authorKind: 'customer', author: 'María Gómez' }),
          makeMessage({ id: 'm-2', authorKind: 'agent', author: 'Ronald', body: 'Ya lo reviso' }),
        ]}
        attachments={[]}
      />,
    );
    const list = screen.getByRole('list', { name: /conversación/i });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAccessibleName(expect.stringMatching(/cliente/i));
    expect(rows[1]).toHaveAccessibleName(expect.stringMatching(/agente/i));
  });
});

describe('CNV-3 order', () => {
  it('renders messages in the order given (oldest first, per the DTO contract)', () => {
    render(
      <SuricataConversationTab
        ticketId="t-1"
        messages={[
          makeMessage({ id: 'm-1', body: 'Primero' }),
          makeMessage({ id: 'm-2', body: 'Segundo' }),
        ]}
        attachments={[]}
      />,
    );
    const list = screen.getByRole('list', { name: /conversación/i });
    const rows = within(list).getAllByRole('listitem');
    expect(within(rows[0]).getByText('Primero')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Segundo')).toBeInTheDocument();
  });
});

describe('CNV-4 audio', () => {
  it('renders a stored audio attachment as an inline playable <audio>, never a bare link', () => {
    render(
      <SuricataConversationTab
        ticketId="t-1"
        messages={[makeMessage({ id: 'm-1' })]}
        attachments={[makeAttachment({ messageId: 'm-1', status: 'stored' })]}
      />,
    );
    const audio = screen.getByTestId('suricata-attachment-audio');
    expect(audio.tagName).toBe('AUDIO');
    expect(audio).toHaveAttribute('controls');
    expect(audio).toHaveAttribute('src', '/api/suricata/tickets/t-1/attachments/a-1/content');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('CNV-5 pending', () => {
  it('shows an honest placeholder for an audio attachment that is not stored yet', () => {
    render(
      <SuricataConversationTab
        ticketId="t-1"
        messages={[makeMessage({ id: 'm-1' })]}
        attachments={[makeAttachment({ messageId: 'm-1', status: 'pending' })]}
      />,
    );
    expect(screen.queryByTestId('suricata-attachment-audio')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/sincronizándose/i)).toBeInTheDocument();
  });
});
