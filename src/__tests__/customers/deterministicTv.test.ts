/**
 * #65 — deterministic TV register credentials (FE replica of the BE domain helper).
 * The BE is the authority (validates CUA on register); the FE replicates the pure rule
 * so the form can prefill reactively. Same contract as the BE tests.
 */
import { describe, it, expect } from 'vitest';
import { deterministicTvEmail, deterministicTvPassword } from '@/pages/customers/tabs/contracts/deterministicTv';

describe('#65 deterministicTvPassword (FE)', () => {
  it('builds ip{idGR} when >= 8 chars', () => {
    expect(deterministicTvPassword('123456')).toBe('ip123456');
  });
  it('pads trailing 0 up to min 8', () => {
    expect(deterministicTvPassword('2432')).toBe('ip243200');
    expect(deterministicTvPassword('12345')).toBe('ip123450');
  });
  it('never trims a long id', () => {
    expect(deterministicTvPassword('1234567890')).toBe('ip1234567890');
  });
});

describe('#65 deterministicTvEmail (FE)', () => {
  it('builds {lastname}{idGR}@gmail.com lowercased', () => {
    expect(deterministicTvEmail('Ronald', '2432')).toBe('ronald2432@gmail.com');
  });
  it('uses only the first word', () => {
    expect(deterministicTvEmail('De La Cruz', '10')).toBe('de10@gmail.com');
  });
  it('strips accents and ñ', () => {
    expect(deterministicTvEmail('Núñez', '7')).toBe('nunez7@gmail.com');
    expect(deterministicTvEmail('Peña', '7')).toBe('pena7@gmail.com');
  });
  it('drops non [a-z] chars', () => {
    expect(deterministicTvEmail("O'Brien", '5')).toBe('obrien5@gmail.com');
  });
  it('falls back to cliente when empty', () => {
    expect(deterministicTvEmail('', '9')).toBe('cliente9@gmail.com');
    expect(deterministicTvEmail('123', '9')).toBe('cliente9@gmail.com');
  });
});
