/**
 * SuricataConversationTab (Fase H, task H.2, spec `suricata-tickets-ui` UI-3;
 * Fase I adds the reply composer at the foot, task I.1).
 *
 *  CNV-1 empty     → explicit empty state when there are no messages yet
 *  CNV-2 lanes     → 'customer'/'agent'/'system' render as distinguishable, labeled lanes
 *  CNV-3 order     → messages render in the order the DTO already provides (oldest → newest)
 *  CNV-4 audio     → a `stored` audio attachment renders an inline, playable `<audio>` — never a bare link
 *  CNV-5 pending   → a NOT-yet-stored audio attachment is an honest placeholder, never a broken/bare link
 *  CNV-6 composer  → the reply composer renders at the foot with the recipient/ticket props wired
 *                    through (own full behavior is covered by `SuricataReplyComposer.test.tsx`)
 *  CNV-7 orphans   → an attachment with `messageId: null` belongs to no message row, so it MUST
 *                    still surface in its own section — never disappear silently (UI-3 treats
 *                    audio as first-class content; a dropped voice note is lost evidence)
 */
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SuricataConversationTab } from '@/pages/suricata/SuricataTicketDetail/SuricataConversationTab';
import type { SuricataAttachmentDto, SuricataMessageDto } from '@/pages/suricata/api/suricataClient';

vi.mock('@/pages/suricata/SuricataTicketDetail/SuricataReplyComposer', () => ({
  SuricataReplyComposer: ({
    ticketId,
    customerName,
    customerPhone,
    ticketSubject,
    ticketExternalId,
  }: {
    ticketId: string;
    customerName: string | null;
    customerPhone: string | null;
    ticketSubject: string;
    ticketExternalId: string;
  }) => (
    <div
      data-testid="reply-composer-stub"
      data-ticket-id={ticketId}
      data-customer-name={customerName ?? ''}
      data-customer-phone={customerPhone ?? ''}
      data-ticket-subject={ticketSubject}
      data-ticket-external-id={ticketExternalId}
    />
  ),
}));

const REPLY_PROPS = {
  customerName: 'María Gómez',
  customerPhone: '+549232455511',
  ticketSubject: 'Sin Servicio',
  ticketExternalId: '18742',
};

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
    render(<SuricataConversationTab ticketId="t-1" messages={[]} attachments={[]} {...REPLY_PROPS} />);
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
        {...REPLY_PROPS}
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
        {...REPLY_PROPS}
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
        {...REPLY_PROPS}
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
        {...REPLY_PROPS}
      />,
    );
    expect(screen.queryByTestId('suricata-attachment-audio')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/sincronizándose/i)).toBeInTheDocument();
  });
});

describe('CNV-6 composer', () => {
  it('renders the reply composer at the foot, wired with the recipient/ticket props', () => {
    render(<SuricataConversationTab ticketId="t-1" messages={[]} attachments={[]} {...REPLY_PROPS} />);
    const composer = screen.getByTestId('reply-composer-stub');
    expect(composer).toHaveAttribute('data-ticket-id', 't-1');
    expect(composer).toHaveAttribute('data-customer-name', 'María Gómez');
    expect(composer).toHaveAttribute('data-customer-phone', '+549232455511');
    expect(composer).toHaveAttribute('data-ticket-subject', 'Sin Servicio');
    expect(composer).toHaveAttribute('data-ticket-external-id', '18742');
  });

  it('still renders the composer when there ARE messages (not just the empty-state branch)', () => {
    render(
      <SuricataConversationTab
        ticketId="t-1"
        messages={[makeMessage({ id: 'm-1' })]}
        attachments={[]}
        {...REPLY_PROPS}
      />,
    );
    expect(screen.getByTestId('reply-composer-stub')).toBeInTheDocument();
  });
});

describe('CNV-7 orphan attachments', () => {
  it('surfaces a messageId:null audio attachment in its own section, still playable', () => {
    render(
      <SuricataConversationTab
        ticketId="t-1"
        messages={[makeMessage({ id: 'm-1' })]}
        attachments={[makeAttachment({ id: 'a-9', messageId: null, fileName: 'audio-suelto.ogg' })]}
        {...REPLY_PROPS}
      />,
    );

    const orphans = screen.getByRole('group', { name: /adjuntos sin mensaje asociado/i });
    expect(within(orphans).getByText('audio-suelto.ogg')).toBeInTheDocument();

    const audio = within(orphans).getByTestId('suricata-attachment-audio');
    expect(audio).toHaveAttribute('src', '/api/suricata/tickets/t-1/attachments/a-9/content');
  });

  it('surfaces a messageId:null non-audio attachment too', () => {
    render(
      <SuricataConversationTab
        ticketId="t-1"
        messages={[]}
        attachments={[
          makeAttachment({ id: 'a-8', messageId: null, fileName: 'captura.png', mimeType: 'image/png' }),
        ]}
        {...REPLY_PROPS}
      />,
    );

    const orphans = screen.getByRole('group', { name: /adjuntos sin mensaje asociado/i });
    expect(within(orphans).getByText('captura.png')).toBeInTheDocument();
  });

  it('never renders an orphan attachment twice, nor the section when every attachment has a message', () => {
    render(
      <SuricataConversationTab
        ticketId="t-1"
        messages={[makeMessage({ id: 'm-1' })]}
        attachments={[makeAttachment({ id: 'a-1', messageId: 'm-1', fileName: 'nota.ogg' })]}
        {...REPLY_PROPS}
      />,
    );

    expect(screen.queryByRole('group', { name: /adjuntos sin mensaje asociado/i })).not.toBeInTheDocument();
    expect(screen.getAllByText('nota.ogg')).toHaveLength(1);
  });
});
