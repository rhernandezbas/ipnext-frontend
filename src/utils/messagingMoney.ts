import type { MessagingCreditBalance, MessagingRateCategory, MessagingRatesConfig } from '@/types/messagingRates';

/**
 * twilio-credit-guard FE (D8) — aritmética de plata en punto fijo, espejo del
 * módulo puro del BE (`src/domain/services/fixedPointMoney.ts`). Enteros de
 * 1/10000 de unidad monetaria (`Micro`) — cero `Number` flotante en el camino
 * de decisión ("saldo alcanza / no alcanza"). Un `parseFloat` acá reintroduce
 * exactamente el bug que la aritmética de punto fijo del BE saca de raíz.
 *
 * Usado por la card `MessagingRatesCard`: el helper "≈ USD X por mensaje
 * CATEGORÍA" y el estimador ("N mensajes CATEGORÍA ≈ USD Y; saldo
 * alcanza/no alcanza").
 */
export type Micro = number;
export const MONEY_SCALE = 10_000;

export class MoneyParseError extends Error {}

const MONEY_RE = /^-?\d+(\.\d+)?$/;

/**
 * '17.894' → 178940 · '0.0618' → 618 · '-3' → -30000. Redondeo half-up sobre
 * el 5to dígito decimal en adelante. Tira `MoneyParseError` ante cualquier
 * cosa que no sea un número honesto (vacío, notación científica, `NaN`,
 * separador de miles, etc.).
 */
export function parseMoney(input: string): Micro {
  const trimmed = input.trim();
  if (!MONEY_RE.test(trimmed)) {
    throw new MoneyParseError(`Invalid money string: ${JSON.stringify(input)}`);
  }

  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [intPartRaw, fracPartRaw = ''] = unsigned.split('.');

  // Paddea la fracción a 5 dígitos (4 que se guardan + 1 para decidir el
  // redondeo half-up) y trunca si el input trae más de 5.
  const fracPadded = (fracPartRaw + '00000').slice(0, 5);
  const fracFirst4 = fracPadded.slice(0, 4);
  const fifthDigit = Number(fracPadded[4]);

  let microFrac = Number(fracFirst4);
  let microInt = Number(intPartRaw) * MONEY_SCALE;
  if (fifthDigit >= 5) microFrac += 1;
  if (microFrac >= MONEY_SCALE) {
    microFrac -= MONEY_SCALE;
    microInt += MONEY_SCALE;
  }

  const unsignedResult = microInt + microFrac;
  const result = negative ? -unsignedResult : unsignedResult;

  if (!Number.isSafeInteger(result)) {
    throw new MoneyParseError(`Money value out of safe integer range: ${input}`);
  }
  return result;
}

/** Igual que `parseMoney` pero devuelve `null` en vez de tirar — para input no confiable (form a medio tipear, wire del BE). */
export function tryParseMoney(input: unknown): Micro | null {
  if (typeof input === 'number') {
    try {
      return parseMoney(String(input));
    } catch {
      return null;
    }
  }
  if (typeof input !== 'string') return null;
  try {
    return parseMoney(input);
  } catch {
    return null;
  }
}

export function addMoney(a: Micro, b: Micro): Micro {
  return a + b;
}

/** `count` DEBE ser entero >= 0. Tira `MoneyParseError` si no. */
export function multiplyMoneyByCount(m: Micro, count: number): Micro {
  if (!Number.isInteger(count) || count < 0) {
    throw new MoneyParseError(`count must be a non-negative integer, got ${count}`);
  }
  const result = m * count;
  if (!Number.isSafeInteger(result)) {
    throw new MoneyParseError('multiplyMoneyByCount result out of safe integer range');
  }
  return result;
}

export function compareMoney(a: Micro, b: Micro): -1 | 0 | 1 {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** 178940 → '17.8940' — SIEMPRE 4 decimales. */
export function formatMoney(m: Micro): string {
  const sign = m < 0 ? '-' : '';
  const abs = Math.abs(m);
  const intPart = Math.floor(abs / MONEY_SCALE);
  const fracPart = abs % MONEY_SCALE;
  return `${sign}${intPart}.${String(fracPart).padStart(4, '0')}`;
}

/**
 * tarifa + fee, formateado a 4 decimales. `null` si cualquiera de los dos
 * strings no es parseable (form a medio tipear) — nunca "0", que abriría el
 * guard en silencio.
 */
export function computeUnitCost(rate: string, providerFee: string): string | null {
  const rateMicro = tryParseMoney(rate);
  const feeMicro = tryParseMoney(providerFee);
  if (rateMicro === null || feeMicro === null) return null;
  return formatMoney(addMoney(rateMicro, feeMicro));
}

function rateForCategory(rates: MessagingRatesConfig, category: MessagingRateCategory): string {
  switch (category) {
    case 'UTILITY':
      return rates.utilityRate;
    case 'MARKETING':
      return rates.marketingRate;
    case 'AUTHENTICATION':
      return rates.authenticationRate;
  }
}

export interface EstimateSpendResult {
  /** unitCost x quantity, 4 decimales, formateado. */
  estimatedCost: string;
  /** `true`/`false` cuando hay balance confiable en la MISMA moneda; `null` cuando es `unknown` (fail-safe, nunca asume). */
  sufficient: boolean | null;
}

/**
 * Pura y total (nunca tira) — espejo cliente de `EstimateMessagingCost` del
 * BE (D4.a), acotada al estimador de la card (no calcula `categoryAssumed`:
 * acá la categoría siempre la elige el operador desde el `Select`).
 * Devuelve `null` solo cuando la ENTRADA es inválida (cantidad no
 * entera/negativa, o tarifas del form no parseables) — nunca por falta de
 * balance, que resuelve a `sufficient: null` en vez de abortar.
 */
export function estimateSpend(args: {
  quantity: number;
  category: MessagingRateCategory;
  rates: MessagingRatesConfig;
  balance: MessagingCreditBalance | null;
}): EstimateSpendResult | null {
  if (!Number.isInteger(args.quantity) || args.quantity < 0) return null;

  const unitCostStr = computeUnitCost(rateForCategory(args.rates, args.category), args.rates.providerFee);
  if (unitCostStr === null) return null;

  let estimatedCostMicro: Micro;
  try {
    estimatedCostMicro = multiplyMoneyByCount(parseMoney(unitCostStr), args.quantity);
  } catch {
    return null;
  }

  let sufficient: boolean | null = null;
  if (args.balance && args.balance.currency === args.rates.currency) {
    const balanceMicro = tryParseMoney(args.balance.available);
    if (balanceMicro !== null) {
      sufficient = compareMoney(estimatedCostMicro, balanceMicro) <= 0;
    }
  }

  return { estimatedCost: formatMoney(estimatedCostMicro), sufficient };
}
