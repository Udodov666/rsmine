import { describe, expect, it } from 'vitest';
import { donationMoney, getAmountError, getAmountPresets, parseAmount } from './donationAmount';

describe('donation amount input', () => {
  it('accepts integers, decimal commas and grouping spaces', () => {
    expect(parseAmount('250')).toBe(250);
    expect(parseAmount('1 250,50')).toBe(1250.5);
    expect(parseAmount('1\u00a0250.50')).toBe(1250.5);
  });
  it('rejects empty, signed, exponential and malformed values', () => {
    for (const raw of ['', ' ', '-100', '+100', '1e3', 'Infinity', 'abc', '12,3,4', '10.123', '10.']) {
      expect(parseAmount(raw)).toBeNull();
    }
  });
  it('rejects unsafe values', () => {
    expect(parseAmount('999999999999999999999')).toBeNull();
  });
  it('validates the minimum without changing the typed value', () => {
    expect(getAmountError('9', 10)).toBe('Минимальная сумма — 10 ₽.');
    expect(getAmountError('10', 10)).toBeNull();
    expect(getAmountError('10,50', 10)).toBeNull();
    expect(getAmountError('', 10)).toBe('Введите сумму доната.');
  });
  it('rejects sums above the hard cap without naming it', () => {
    expect(getAmountError('100000', 10)).toBeNull();
    expect(getAmountError('100000,01', 10)).toBe('Слишком большая сумма.');
    expect(getAmountError('250000', 10)).toBe('Слишком большая сумма.');
  });
  it('shows kopecks without rounding to whole rubles', () => {
    expect(donationMoney(250.5).replace(/\s/g, ' ')).toBe('250,5 ₽');
  });
  it('provides four distinct amounts above any supported minimum', () => {
    expect(getAmountPresets(10)).toEqual([100, 200, 500, 1000]);
    expect(getAmountPresets(150)).toEqual([150, 200, 300, 500]);
    expect(getAmountPresets(2000)).toEqual([2000, 4000, 10000, 20000]);
  });
});
