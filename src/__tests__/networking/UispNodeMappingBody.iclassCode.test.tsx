/**
 * UispNodeMappingBody — Código IClass editable inline
 *
 * SCEN-FE-NMC-01: renders input with existing iclassNodeCode value
 * SCEN-FE-NMC-02: renders input with empty string when iclassNodeCode is null
 * SCEN-FE-NMC-03: blur with changed value → PUT body exact {iclassNodeCode: 'X'}
 * SCEN-FE-NMC-04: blur without change → does NOT call patch
 * SCEN-FE-NMC-05: clear value → PUT with {iclassNodeCode: null}
 * SCEN-FE-NMC-06: Enter key triggers save (same as blur)
 * SCEN-FE-NMC-07: saving indicator while code mutation in flight
 * SCEN-FE-NMC-08: saved indicator shown after code save success
 * SCEN-FE-NMC-09: error state shown when code save fails (error indicator on row)
 * SCEN-FE-NMC-10: whitespace-only input → PUT with {iclassNodeCode: null}
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useNetworkSites', () => ({
  useNetworkSites: vi.fn(),
  usePatchNetworkSite: vi.fn(),
}));
vi.mock('@/hooks/useUispSites', () => ({
  useUispSites: vi.fn(),
}));

import { useNetworkSites, usePatchNetworkSite } from '@/hooks/useNetworkSites';
import { useUispSites } from '@/hooks/useUispSites';
import { UispNodeMappingBody } from '@/components/networking/UispNodeMappingBody';
import type { NetworkSite } from '@/types/networkSite';

// ── Factories ────────────────────────────────────────────────────────────────

function makeSite(over: Partial<NetworkSite> = {}): NetworkSite {
  return {
    id: 's1',
    name: 'Nodo Central',
    address: 'Av. Corrientes 1234',
    city: 'Buenos Aires',
    coordinates: null,
    type: 'nodo',
    status: 'active',
    deviceCount: 0,
    clientCount: 0,
    uplink: '',
    parentSiteId: null,
    description: '',
    iclassNodeCode: null,
    uispSiteId: null,
    uisp: null,
    ...over,
  };
}

const idleUpdate = {
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue({}),
  isPending: false,
  isError: false,
  reset: vi.fn(),
};

function setupMocks(sites: NetworkSite[], patchAsync = vi.fn().mockResolvedValue({})) {
  vi.mocked(useNetworkSites).mockReturnValue({
    data: sites,
    isLoading: false,
  } as ReturnType<typeof useNetworkSites>);

  vi.mocked(useUispSites).mockReturnValue({
    data: { sites: [] },
    isLoading: false,
  } as ReturnType<typeof useUispSites>);

  vi.mocked(usePatchNetworkSite).mockReturnValue({
    ...idleUpdate,
    mutateAsync: patchAsync,
  } as never);

  return patchAsync;
}

// ── Helper: get the iclassCode input for a given site ───────────────────────

function getCodeInput(siteId = 's1') {
  return screen.getByTestId(`iclass-code-input-${siteId}`) as HTMLInputElement;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('UispNodeMappingBody — Código IClass editable inline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // SCEN-FE-NMC-01
  it('SCEN-FE-NMC-01: renders input with existing iclassNodeCode value', () => {
    setupMocks([makeSite({ id: 's1', iclassNodeCode: 'NODO-42' })]);
    render(<UispNodeMappingBody />);

    const input = getCodeInput();
    expect(input.value).toBe('NODO-42');
  });

  // SCEN-FE-NMC-02
  it('SCEN-FE-NMC-02: renders input with empty string when iclassNodeCode is null', () => {
    setupMocks([makeSite({ id: 's1', iclassNodeCode: null })]);
    render(<UispNodeMappingBody />);

    const input = getCodeInput();
    expect(input.value).toBe('');
    expect(input.placeholder).toBeTruthy();
  });

  // SCEN-FE-NMC-03
  it('SCEN-FE-NMC-03: blur with changed value → PATCH body exact {iclassNodeCode: "X"}', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    setupMocks([makeSite({ id: 's1', iclassNodeCode: 'OLD' })], mutateAsync);
    render(<UispNodeMappingBody />);

    const input = getCodeInput();
    fireEvent.change(input, { target: { value: 'NODO-99' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        id: 's1',
        data: { iclassNodeCode: 'NODO-99' },
      });
    });
  });

  // SCEN-FE-NMC-04
  it('SCEN-FE-NMC-04: blur without change → does NOT call patch', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    setupMocks([makeSite({ id: 's1', iclassNodeCode: 'NODO-01' })], mutateAsync);
    render(<UispNodeMappingBody />);

    const input = getCodeInput();
    // No change, just blur
    fireEvent.focus(input);
    fireEvent.blur(input);

    // Give async a chance if it would fire
    await new Promise(r => setTimeout(r, 50));
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  // SCEN-FE-NMC-05
  it('SCEN-FE-NMC-05: clear value → PATCH with {iclassNodeCode: null}', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    setupMocks([makeSite({ id: 's1', iclassNodeCode: 'NODO-01' })], mutateAsync);
    render(<UispNodeMappingBody />);

    const input = getCodeInput();
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        id: 's1',
        data: { iclassNodeCode: null },
      });
    });
  });

  // SCEN-FE-NMC-06
  it('SCEN-FE-NMC-06: Enter key triggers save', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    setupMocks([makeSite({ id: 's1', iclassNodeCode: 'OLD' })], mutateAsync);
    render(<UispNodeMappingBody />);

    const input = getCodeInput();
    fireEvent.change(input, { target: { value: 'NEW-CODE' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        id: 's1',
        data: { iclassNodeCode: 'NEW-CODE' },
      });
    });
  });

  // SCEN-FE-NMC-07
  it('SCEN-FE-NMC-07: saving indicator while code mutation in flight', async () => {
    let resolve!: (v: unknown) => void;
    const mutateAsync = vi.fn(() => new Promise(res => { resolve = res; }));
    setupMocks([makeSite({ id: 's1', iclassNodeCode: 'OLD' })], mutateAsync);
    render(<UispNodeMappingBody />);

    const input = getCodeInput();
    fireEvent.change(input, { target: { value: 'NEW' } });
    fireEvent.blur(input);

    await waitFor(() => expect(screen.getByLabelText(/guardando/i)).toBeInTheDocument());
    resolve({});
  });

  // SCEN-FE-NMC-08
  it('SCEN-FE-NMC-08: saved indicator shown after code save success', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    setupMocks([makeSite({ id: 's1', iclassNodeCode: 'OLD' })], mutateAsync);
    render(<UispNodeMappingBody />);

    const input = getCodeInput();
    fireEvent.change(input, { target: { value: 'NEW' } });
    fireEvent.blur(input);

    await waitFor(() => expect(screen.getByLabelText(/guardado/i)).toBeInTheDocument());
  });

  // SCEN-FE-NMC-09
  it('SCEN-FE-NMC-09: error state shown when code save fails', async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error('Server error'));
    setupMocks([makeSite({ id: 's1', iclassNodeCode: 'OLD' })], mutateAsync);
    render(<UispNodeMappingBody />);

    const input = getCodeInput();
    fireEvent.change(input, { target: { value: 'NEW' } });
    fireEvent.blur(input);

    await waitFor(() => expect(screen.getByLabelText(/error/i)).toBeInTheDocument());
  });

  // SCEN-FE-NMC-10
  it('SCEN-FE-NMC-10: whitespace-only input → PATCH with {iclassNodeCode: null}', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    setupMocks([makeSite({ id: 's1', iclassNodeCode: 'NODO-01' })], mutateAsync);
    render(<UispNodeMappingBody />);

    const input = getCodeInput();
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        id: 's1',
        data: { iclassNodeCode: null },
      });
    });
  });
});
