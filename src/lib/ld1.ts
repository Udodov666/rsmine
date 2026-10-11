/**
 * Payload комментария перевода (06-APP-SPEC §3):
 *   LD1|v=<код голоса>|e=<код эффекта>|a=<0|1>|<текст доната>
 * Комментарий — недоверенный ввод. Суммы и ника в payload нет и быть не может.
 * Всё, что не парсится как LD1|, — plain donation (текст = весь комментарий, капнутый).
 */

export interface Ld1Payload {
  voice?: string;
  effect?: string;
  anonymous: boolean;
  text: string;
}

/** Фильтр текста доната: вертикальная черта запрещена, управляющие символы убираются, кап по лимиту. */
export function sanitizeText(raw: string, limit: number): string {
  return raw
    .replace(/[|\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

/**
 * Строгий парсер: неизвестные поля игнорируются; секции вида k=v до первой
 * секции без '='; остаток — текст (объединяем через '|', но '|' в тексте
 * от донатера не должен дойти — фильтр на публичной странице).
 */
export function parseLd1(comment: string, textLimit = 100): Ld1Payload | null {
  if (!comment.startsWith('LD1|')) return null;
  const parts = comment.split('|');
  const out: Ld1Payload = { anonymous: false, text: '' };
  let i = 1;
  for (; i < parts.length; i++) {
    const m = /^([A-Za-z])=(.*)$/.exec(parts[i]);
    if (!m) break;
    const [, key, value] = m;
    if (key === 'v' && value) out.voice = value;
    else if (key === 'e' && value) out.effect = value;
    else if (key === 'a') out.anonymous = value === '1';
    // неизвестные ключи — игнор
  }
  out.text = sanitizeText(parts.slice(i).join('|'), textLimit);
  return out;
}

/** Сборка payload на публичной странице (текст уже должен пройти sanitizeText). */
export function buildLd1(p: { voice?: string; effect?: string; anonymous: boolean; text: string }): string {
  const fields: string[] = [];
  if (p.voice) fields.push(`v=${p.voice}`);
  if (p.effect) fields.push(`e=${p.effect}`);
  fields.push(`a=${p.anonymous ? '1' : '0'}`);
  const text = p.text.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? `LD1|${fields.join('|')}|${text}` : `LD1|${fields.join('|')}`;
}
