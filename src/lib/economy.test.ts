import { describe, expect, it } from 'vitest';
import { calcEconomy } from './economy';
import type { Feature } from '../data/types';

const f = (kind: Feature['kind'], code: string): Feature => ({ kind, code });
const prices = { m: 10, f: 10, pm1: 30, confetti: 10, shake: 10 };

describe('экономика фич (06 §2 — не искажать)', () => {
  it('честный: 30 = 20 донат + 10 голос → показ 20 + озвучка', () => {
    const r = calcEconomy({ incomingSum: 30, minimum: 10, features: [f('voice', 'm')], prices });
    expect(r.shown).toBe(20);
    expect(r.retained).toEqual([f('voice', 'm')]);
    expect(r.removed).toEqual([]);
  });

  it('жулик: платит 20 и сам вписал голос → показ 10 + озвучка', () => {
    const r = calcEconomy({ incomingSum: 20, minimum: 10, features: [f('voice', 'm')], prices });
    expect(r.shown).toBe(10);
    expect(r.retained).toHaveLength(1);
  });

  it('жадный: 10 + голос+эффект → фичи срезаются, чистый донат 10', () => {
    const r = calcEconomy({
      incomingSum: 10,
      minimum: 10,
      features: [f('voice', 'm'), f('effect', 'confetti')],
      prices,
    });
    expect(r.shown).toBe(10);
    expect(r.retained).toHaveLength(0);
    expect(r.removed).toHaveLength(2);
  });

  it('срезается самая дорогая первой (премиум 30)', () => {
    const r = calcEconomy({
      incomingSum: 25,
      minimum: 10,
      features: [f('voice', 'm'), f('voice', 'pm1')],
      prices,
    });
    // 25 − 40 < 10 → срезан pm1 (30) → 25 − 10 = 15 ≥ 10
    expect(r.removed.map((x) => x.code)).toEqual(['pm1']);
    expect(r.shown).toBe(15);
    expect(r.retained.map((x) => x.code)).toEqual(['m']);
  });

  it('если фичей не осталось — показать весь incoming даже меньше минималки', () => {
    const r = calcEconomy({ incomingSum: 5, minimum: 10, features: [f('voice', 'm')], prices });
    expect(r.shown).toBe(5);
    expect(r.retained).toHaveLength(0);
  });

  it('без фич: показать = incoming (даже 3 ₽)', () => {
    const r = calcEconomy({ incomingSum: 3, minimum: 10, features: [], prices });
    expect(r.shown).toBe(3);
  });

  it('tie-break при равной цене: первой срезается последняя заявленная, затем каскад', () => {
    const r = calcEconomy({
      incomingSum: 12,
      minimum: 10,
      features: [f('effect', 'confetti'), f('voice', 'm')],
      prices,
    });
    // 12 − 20 < 10 → срез последней при равной цене (m); 12 − 10 < 10 → срез confetti;
    // фич не осталось → показать весь incoming
    expect(r.removed.map((x) => x.code)).toEqual(['m', 'confetti']);
    expect(r.shown).toBe(12);
  });

  it('неизвестный код (цена 0) не влияет на показ', () => {
    const r = calcEconomy({ incomingSum: 50, minimum: 10, features: [f('voice', 'zz')], prices });
    expect(r.shown).toBe(50);
    expect(r.retained).toHaveLength(1); // фильтрация каталога — выше по стеку (ingest)
  });

  it('каскадное срезание до минималки', () => {
    const r = calcEconomy({
      incomingSum: 35,
      minimum: 10,
      features: [f('voice', 'pm1'), f('voice', 'm'), f('effect', 'shake')],
      prices,
    });
    // 35 − 50 < 10 → срез pm1(30) → 35 − 20 = 15 ≥ 10
    expect(r.removed.map((x) => x.code)).toEqual(['pm1']);
    expect(r.shown).toBe(15);
  });
});
