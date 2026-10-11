import { describe, expect, it } from 'vitest';
import { buildLd1, parseLd1, sanitizeText } from './ld1';

describe('парсер LD1 (06 §3)', () => {
  it('валидный payload', () => {
    const p = parseLd1('LD1|v=f|a=0|Привет, удачного стрима!');
    expect(p).not.toBeNull();
    expect(p!.voice).toBe('f');
    expect(p!.effect).toBeUndefined();
    expect(p!.anonymous).toBe(false);
    expect(p!.text).toBe('Привет, удачного стрима!');
  });

  it('не-LD1 комментарий → null (plain donation)', () => {
    expect(parseLd1('просто текст доната')).toBeNull();
    expect(parseLd1('')).toBeNull();
  });

  it('a=1 → анонимно', () => {
    const p = parseLd1('LD1|a=1|скрытка');
    expect(p!.anonymous).toBe(true);
  });

  it('неизвестные поля игнорируются', () => {
    const p = parseLd1('LD1|x=9|v=m|y=zz|текст');
    expect(p!.voice).toBe('m');
    expect(p!.text).toBe('текст');
  });

  it('текст капится по лимиту', () => {
    const p = parseLd1('LD1|a=0|' + 'а'.repeat(150), 100);
    expect(p!.text.length).toBe(100);
  });

  it('buildLd1: без фич, с фичами, анонимно', () => {
    expect(buildLd1({ anonymous: false, text: 'привет' })).toBe('LD1|a=0|привет');
    expect(buildLd1({ voice: 'm', effect: 'confetti', anonymous: true, text: 'го' })).toBe(
      'LD1|v=m|e=confetti|a=1|го',
    );
  });

  it('buildLd1 режет «|» из текста', () => {
    expect(buildLd1({ anonymous: false, text: 'текст | с чертой' })).toBe('LD1|a=0|текст с чертой');
  });

  it('sanitizeText: | и управляющие символы убираются', () => {
    expect(sanitizeText('a|b\u0007c', 10)).toBe('a b c');
  });

  it('roundtrip: build → parse', () => {
    const built = buildLd1({ voice: 'pm1', anonymous: true, text: 'Кругосветка!' });
    const parsed = parseLd1(built, 100);
    expect(parsed!.voice).toBe('pm1');
    expect(parsed!.anonymous).toBe(true);
    expect(parsed!.text).toBe('Кругосветка!');
  });
});
