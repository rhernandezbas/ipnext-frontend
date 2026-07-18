import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/hooks/useNews', () => ({
  useBroadcastNewsPost: vi.fn(),
}));

import { useBroadcastNewsPost } from '@/hooks/useNews';
import { useConfirm } from '@/context/ConfirmContext';
import { NewsBroadcastButton } from '@/pages/news/components/NewsBroadcastButton';

const mockBroadcast = useBroadcastNewsPost as unknown as ReturnType<typeof vi.fn>;

let broadcastMutate: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  broadcastMutate = vi.fn().mockResolvedValue({ sent: true, link: 'http://noc.test/admin/news?post=p1' });
  mockBroadcast.mockReturnValue({ mutateAsync: broadcastMutate, isPending: false });
  vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
});

function renderButton(lastBroadcastAt: string | null = null) {
  return render(<NewsBroadcastButton postId="p1" lastBroadcastAt={lastBroadcastAt} />);
}

describe('NewsBroadcastButton', () => {
  it('renders a "Difundir al NOC" button', () => {
    renderButton();
    expect(screen.getByRole('button', { name: /difundir al noc/i })).toBeInTheDocument();
  });

  it('confirms, POSTs the broadcast and shows a success message with the returned link', async () => {
    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByRole('button', { name: /difundir al noc/i }));

    await waitFor(() => expect(broadcastMutate).toHaveBeenCalledWith('p1'));
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(/difundido al canal/i);
    expect(status).toHaveTextContent('http://noc.test/admin/news?post=p1');
    // The safe http(s) link IS a real anchor.
    expect(status.querySelector('a')).toHaveAttribute('href', 'http://noc.test/admin/news?post=p1');
  });

  it('does NOT render a hostile (non-http) BE link as a clickable anchor — plain text instead (defense-in-depth)', async () => {
    broadcastMutate.mockResolvedValue({ sent: true, link: 'javascript:alert(1)' });
    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByRole('button', { name: /difundir al noc/i }));

    const status = await screen.findByRole('status');
    // The link text still shows (so the operator sees what came back)…
    expect(status).toHaveTextContent('javascript:alert(1)');
    // …but never as a live anchor: no <a> at all, and certainly none with a javascript: href.
    expect(status.querySelector('a')).toBeNull();
    for (const a of Array.from(status.querySelectorAll('a'))) {
      expect(a.getAttribute('href') ?? '').not.toMatch(/javascript:/i);
    }
  });

  it('does NOT broadcast if the confirmation is declined', async () => {
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(false));
    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByRole('button', { name: /difundir al noc/i }));
    expect(broadcastMutate).not.toHaveBeenCalled();
  });

  it('maps 503 NOC_BROADCAST_NOT_CONFIGURED to "Configurá la Difusión NOC primero"', async () => {
    broadcastMutate.mockRejectedValue({ response: { status: 503, data: { code: 'NOC_BROADCAST_NOT_CONFIGURED' } } });
    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByRole('button', { name: /difundir al noc/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/configurá la difusión noc primero/i);
  });

  it('maps 502 EVOLUTION_API_ERROR to an Evolution/Pi error message', async () => {
    broadcastMutate.mockRejectedValue({ response: { status: 502, data: { code: 'EVOLUTION_API_ERROR' } } });
    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByRole('button', { name: /difundir al noc/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/evolution/i);
  });

  it('maps 422 NOC_BROADCAST_LINK_BASE_MISSING to a "URL pública" error message', async () => {
    broadcastMutate.mockRejectedValue({ response: { status: 422, data: { code: 'NOC_BROADCAST_LINK_BASE_MISSING' } } });
    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByRole('button', { name: /difundir al noc/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/url pública/i);
  });

  it('shows "Difundida el {AR date}" when lastBroadcastAt is set (Argentina timezone)', () => {
    renderButton('2026-06-01T15:30:00.000Z');
    // formatDateTimeShort(...Z) → AR (UTC-3) = 01 jun 2026 - 12:30
    expect(screen.getByText(/difundida el 01 jun 2026 - 12:30/i)).toBeInTheDocument();
  });

  it('does NOT show the "Difundida el" line when lastBroadcastAt is null', () => {
    renderButton(null);
    expect(screen.queryByText(/difundida el/i)).not.toBeInTheDocument();
  });
});
