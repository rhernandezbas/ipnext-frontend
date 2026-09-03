import { describe, it, expect } from 'vitest';
import {
  parseMoney,
  tryParseMoney,
  addMoney,
  multiplyMoneyByCount,
  compareMoney,
  formatMoney,
  MoneyParseError,
  computeUnitCost,
  estimateSpend,
} from '@/utils/messagingMoney';
import type { MessagingRatesConfig, MessagingCreditBalance } from '@/types/messagingRates';

describe('parseMoney', () => {
  it('parsea un string de 4 decimales a micro-unidades (1/10000)', () => {
    expect(parseMoney('17.8940')).toBe(178940);
    expect(parseMoney('0.0618')).toBe(618);
  });

  it('parsea un string de 3 decimales (balance real de Twilio) padeando a 4', () => {
    expect(parseMoney('17.894')).toBe(178940);
  });

  it('parsea un entero sin parte decimal', () => {
    expect(parseMoney('5')).toBe(50000);
  });

  it('redondea half-up en el 5to dígito', () => {
    expect(parseMoney('0.00005')).toBe(1);
    expect(parseMoney('0.00004')).toBe(0);
  });

  it('soporta negativos', () => {
    expect(parseMoney('-3')).toBe(-30000);
  });

  it('rechaza strings no numéricos', () => {
    expect(() => parseMoney('')).toThrow(MoneyParseError);
    expect(() => parseMoney('1e3')).toThrow(MoneyParseError);
    expect(() => parseMoney('NaN')).toThrow(MoneyParseError);
    expect(() => parseMoney('1,5')).toThrow(MoneyParseError);
    expect(() => parseMoney('abc')).toThrow(MoneyParseError);
  });
});

describe('tryParseMoney', () => {
  it('devuelve null en vez de tirar ante un input inválido', () => {
    expect(tryParseMoney('abc')).toBeNull();
    expect(tryParseMoney(null)).toBeNull();
    expect(tryParseMoney(undefined)).toBeNull();
  });

  it('parsea un string válido', () => {
    expect(tryParseMoney('0.0120')).toBe(120);
  });
});

describe('addMoney / multiplyMoneyByCount / compareMoney', () => {
  it('suma dos montos en micro-unidades', () => {
    expect(addMoney(120, 50)).toBe(170);
  });

  it('multiplyMoneyByCount: 0.0618 x 500 = 30.9000 EXACTO', () => {
    const rate = parseMoney('0.0618');
    const result = multiplyMoneyByCount(rate, 500);
    expect(formatMoney(result)).toBe('30.9000');
  });

  it('multiplyMoneyByCount tira si count no es un entero >= 0', () => {
    expect(() => multiplyMoneyByCount(100, 1.5)).toThrow(MoneyParseError);
    expect(() => multiplyMoneyByCount(100, -1)).toThrow(MoneyParseError);
  });

  it('compareMoney', () => {
    expect(compareMoney(100, 200)).toBe(-1);
    expect(compareMoney(200, 100)).toBe(1);
    expect(compareMoney(100, 100)).toBe(0);
  });
});

describe('formatMoney', () => {
  it('siempre devuelve 4 decimales', () => {
    expect(formatMoney(50000)).toBe('5.0000');
    expect(formatMoney(1)).toBe('0.0001');
  });

  it('round-trip format(parse(x)) === x para strings de 4 decimales', () => {
    for (const x of ['17.8940', '0.0120', '0.0618', '0.0220', '0.0050', '0.0000', '123.4567']) {
      expect(formatMoney(parseMoney(x))).toBe(x);
    }
  });
});

describe('computeUnitCost', () => {
  it('suma tarifa + fee y formatea a 4 decimales', () => {
    expect(computeUnitCost('0.0120', '0.0050')).toBe('0.0170');
  });

  it('devuelve null si la tarifa o el fee no son parseables (form a medio tipear)', () => {
    expect(computeUnitCost('', '0.0050')).toBeNull();
    expect(computeUnitCost('0.0120', 'abc')).toBeNull();
  });
});

const rates: MessagingRatesConfig = {
  currency: 'USD',
  utilityRate: '0.0120',
  marketingRate: '0.0618',
  authenticationRate: '0.0220',
  providerFee: '0.0050',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const balance: MessagingCreditBalance = {
  available: '17.8940',
  currency: 'USD',
  fetchedAt: '2026-09-01T00:00:00.000Z',
  cached: false,
};

describe('estimateSpend', () => {
  it('100 mensajes UTILITY ≈ USD 1.7000, saldo alcanza', () => {
    const r = estimateSpend({ quantity: 100, category: 'UTILITY', rates, balance });
    expect(r).not.toBeNull();
    expect(r?.estimatedCost).toBe('1.7000');
    expect(r?.sufficient).toBe(true);
  });

  it('saldo no alcanza cuando el costo estimado supera el balance', () => {
    const r = estimateSpend({ quantity: 300, category: 'MARKETING', rates, balance });
    // 300 * (0.0618 + 0.0050) = 300 * 0.0668 = 20.0400 > 17.8940
    expect(r?.estimatedCost).toBe('20.0400');
    expect(r?.sufficient).toBe(false);
  });

  it('sufficient es null cuando no hay balance (unknown)', () => {
    const r = estimateSpend({ quantity: 100, category: 'UTILITY', rates, balance: null });
    expect(r?.estimatedCost).toBe('1.7000');
    expect(r?.sufficient).toBeNull();
  });

  it('sufficient es null cuando la moneda del balance no coincide con la de las tarifas', () => {
    const r = estimateSpend({
      quantity: 100,
      category: 'UTILITY',
      rates,
      balance: { ...balance, currency: 'ARS' },
    });
    expect(r?.sufficient).toBeNull();
  });

  it('devuelve null si la cantidad no es un entero >= 0', () => {
    expect(estimateSpend({ quantity: -1, category: 'UTILITY', rates, balance })).toBeNull();
    expect(estimateSpend({ quantity: 1.5, category: 'UTILITY', rates, balance })).toBeNull();
  });

  it('borde: estimatedCost === available ⇒ sufficient true', () => {
    const r = estimateSpend({
      quantity: 1,
      category: 'UTILITY',
      rates: { ...rates, utilityRate: '17.8890', providerFee: '0.0050' },
      balance,
    });
    expect(r?.estimatedCost).toBe('17.8940');
    expect(r?.sufficient).toBe(true);
  });
});
