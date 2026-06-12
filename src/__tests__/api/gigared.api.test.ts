import { vi, describe, it, expect, beforeEach } from 'vitest';
import type {
  GigaredConfig,
  GigaredSummary,
  GigaredAccount,
  CustomerAccountResult,
  AddTvServiceResult,
  RemoveTvServiceResult,
  CancelTvResult,
} from '@/types/gigared';

// Mock axiosClient before importing the api module
vi.mock('@/api/axios-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import axiosClient from '@/api/axios-client';
import { gigaredApi } from '@/api/gigared.api';

const mockConfig: GigaredConfig = {
  configured: true,
  apiKeyLast4: '1234',
  baseUrl: 'https://partners.gigaredsa.com.ar/api/v1',
  enabled: true,
  updatedAt: '2026-06-10T12:00:00Z',
};

const mockAccount: GigaredAccount = {
  cic: '0000000001',
  gigaredId: 'g-1',
  email: 'a@b.com',
  firstName: 'Ana',
  lastName: 'García',
  registrationDate: '2026-01-01T00:00:00Z',
  services: [{ id: 's1', name: 'Gigared Play Full' }],
  internalId: 'cust-1',
  ott: null,
};

const mockSummary: GigaredSummary = {
  accounts: { registered: 5, unregistered: 2, total: 7 },
  services: [
    { id: 's1', name: 'Gigared Play Full', qtyAvailable: 3, qtyUsed: 2, qtyPurchased: 5 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('gigaredApi.getConfig', () => {
  it('GETs /gigared/config', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: mockConfig });
    const result = await gigaredApi.getConfig();
    expect(axiosClient.get).toHaveBeenCalledWith('/gigared/config');
    expect(result).toEqual(mockConfig);
  });
});

describe('gigaredApi.updateConfig', () => {
  it('PUTs /gigared/config with the partial body', async () => {
    vi.mocked(axiosClient.put).mockResolvedValue({ data: mockConfig });
    const body = { apiKey: 'newsecret', enabled: true };
    const result = await gigaredApi.updateConfig(body);
    expect(axiosClient.put).toHaveBeenCalledWith('/gigared/config', body);
    expect(result).toEqual(mockConfig);
  });
});

describe('gigaredApi.getSummary', () => {
  it('GETs /gigared/summary', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: mockSummary });
    const result = await gigaredApi.getSummary();
    expect(axiosClient.get).toHaveBeenCalledWith('/gigared/summary');
    expect(result).toEqual(mockSummary);
  });
});

describe('gigaredApi.listAccounts', () => {
  it('GETs /gigared/accounts mapping camelCase filters to snake_case query params', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: { accounts: [mockAccount] } });
    const result = await gigaredApi.listAccounts({
      email: 'a@b.com',
      status: 'registered',
      accountId: 'acc-9',
      paginationLimit: 25,
      paginationOffset: 50,
    });
    expect(axiosClient.get).toHaveBeenCalledWith('/gigared/accounts', {
      params: {
        email: 'a@b.com',
        status: 'registered',
        account_id: 'acc-9',
        pagination_limit: 25,
        pagination_offset: 50,
      },
    });
    expect(result).toEqual({ accounts: [mockAccount] });
  });

  it('omits empty filter keys', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: { accounts: [] } });
    await gigaredApi.listAccounts({ paginationLimit: 25, paginationOffset: 0 });
    expect(axiosClient.get).toHaveBeenCalledWith('/gigared/accounts', {
      params: { pagination_limit: 25, pagination_offset: 0 },
    });
  });
});

describe('gigaredApi.getCustomerAccount', () => {
  it('GETs /gigared/customers/:id/account', async () => {
    const payload: CustomerAccountResult = { linked: true, account: mockAccount };
    vi.mocked(axiosClient.get).mockResolvedValue({ data: payload });
    const result = await gigaredApi.getCustomerAccount('cust-1');
    expect(axiosClient.get).toHaveBeenCalledWith('/gigared/customers/cust-1/account');
    expect(result).toEqual(payload);
  });
});

describe('gigaredApi.linkCic', () => {
  it('POSTs /gigared/customers/:id/link with { cic }', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: { account: mockAccount } });
    const result = await gigaredApi.linkCic('cust-1', { cic: '0000000001' });
    expect(axiosClient.post).toHaveBeenCalledWith('/gigared/customers/cust-1/link', { cic: '0000000001' });
    expect(result).toEqual({ account: mockAccount });
  });
});

describe('gigaredApi.registerAccount', () => {
  it('POSTs /gigared/customers/:id/register with the register body', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: { account: mockAccount } });
    const body = { firstName: 'Ana', lastName: 'García', email: 'a@b.com', cic: '0000000001' };
    const result = await gigaredApi.registerAccount('cust-1', body);
    expect(axiosClient.post).toHaveBeenCalledWith('/gigared/customers/cust-1/register', body);
    expect(result).toEqual({ account: mockAccount });
  });
});

describe('gigaredApi.addService', () => {
  it('POSTs /gigared/customers/:id/services with { serviceId, contractId }', async () => {
    const payload: AddTvServiceResult = { gigared: 'ok', local: 'ok', contractServiceId: 'cs-1' };
    vi.mocked(axiosClient.post).mockResolvedValue({ data: payload });
    const result = await gigaredApi.addService('cust-1', { serviceId: 's1', contractId: 'ct-1' });
    expect(axiosClient.post).toHaveBeenCalledWith('/gigared/customers/cust-1/services', {
      serviceId: 's1',
      contractId: 'ct-1',
    });
    expect(result).toEqual(payload);
  });
});

describe('gigaredApi.removeService', () => {
  it('DELETEs /gigared/customers/:id/services/:serviceId with contractId query', async () => {
    const payload: RemoveTvServiceResult = { gigared: 'ok', local: 'ok' };
    vi.mocked(axiosClient.delete).mockResolvedValue({ data: payload });
    const result = await gigaredApi.removeService('cust-1', 's1', 'ct-1');
    expect(axiosClient.delete).toHaveBeenCalledWith('/gigared/customers/cust-1/services/s1', {
      params: { contractId: 'ct-1' },
    });
    expect(result).toEqual(payload);
  });
});

describe('gigaredApi.setOtt', () => {
  it('PUTs /gigared/customers/:id/ott with { enabled }', async () => {
    vi.mocked(axiosClient.put).mockResolvedValue({ data: { ok: true } });
    const result = await gigaredApi.setOtt('cust-1', { enabled: true });
    expect(axiosClient.put).toHaveBeenCalledWith('/gigared/customers/cust-1/ott', { enabled: true });
    expect(result).toEqual({ ok: true });
  });
});

// ── #47k/#64 — cancel TV (dar de baja): la API devuelve { status, data } ─────
describe('gigaredApi.cancelTv', () => {
  it('POSTs /gigared/customers/:id/cancel with { contractId } and returns { status, data }', async () => {
    const payload: CancelTvResult = {
      removed: ['s1', 's2'],
      failed: [],
      ottDisabled: true,
      local: 'synced',
      renew: { oldCic: '0000000001', newCic: '0000000002' },
      unlinked: true,
      renewAttempted: true,
    };
    vi.mocked(axiosClient.post).mockResolvedValue({ status: 200, data: payload });
    const result = await gigaredApi.cancelTv('cust-1', { contractId: 'ct-9' });
    expect(axiosClient.post).toHaveBeenCalledWith('/gigared/customers/cust-1/cancel', {
      contractId: 'ct-9',
    });
    expect(result).toEqual({ status: 200, data: payload });
  });

  it('passes a 207 partial shape through verbatim (removed + failed + flags)', async () => {
    const payload: CancelTvResult = {
      removed: ['s1'],
      failed: [{ id: 's2', detail: 'partner timeout' }],
      ottDisabled: false,
      local: 'failed',
      renew: null,
      unlinked: false,
      renewAttempted: true,
    };
    vi.mocked(axiosClient.post).mockResolvedValue({ status: 207, data: payload });
    const result = await gigaredApi.cancelTv('cust-1', { contractId: 'ct-9' });
    expect(result).toEqual({ status: 207, data: payload });
  });
});
