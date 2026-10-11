const moneyFmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

/** «1 240 ₽», табличные цифры задаёт CSS (.num). */
export function money(n: number): string {
  return `${moneyFmt.format(Math.round(n))} ₽`;
}

export function clock(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function dateTime(ts: number): string {
  const d = new Date(ts);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function startOfMonth(): number {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 > 20)) return few;
  return many;
}

/** Копирование в буфер с фолбэком; возвращает успех. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}

/** true, если событие случилось в поле ввода — глобальные шорткаты там не работают (03 §7). */
export function isTypingTarget(e: KeyboardEvent): boolean {
  const t = e.target;
  return (
    t instanceof HTMLInputElement ||
    t instanceof HTMLTextAreaElement ||
    (t instanceof HTMLElement && t.isContentEditable)
  );
}

/** Детерминированный оттенок аватара по нику (как в мессенджерах). */
export function avatarHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 360;
}

/** Курированный набор градиентов для аватарок (как в мессенджерах): кому какой — по хешу ника. */
const AVATAR_GRADIENTS: Array<readonly [string, string]> = [
  ['#6ee7b7', '#10b981'], // изумруд
  ['#c4b5fd', '#8b5cf6'], // фиолет
  ['#7dd3fc', '#0284c7'], // небо
  ['#fcd34d', '#d97706'], // янтарь
  ['#a5b4fc', '#4338ca'], // индиго
  ['#cbd5e1', '#64748b'], // графит
  ['#67e8f9', '#0e7490'], // циан
  ['#fdba74', '#c2410c'], // оранж
];

/** Фон-заглушка аватара: градиент из набора + глянец + белые инициалы. */
export function avatarStyle(name: string): { background: string; color: string } {
  const [from, to] = AVATAR_GRADIENTS[avatarHue(name) % AVATAR_GRADIENTS.length];
  return {
    background:
      `linear-gradient(180deg, rgba(255, 255, 255, .2), rgba(255, 255, 255, 0) 55%), ` +
      `linear-gradient(135deg, ${from}, ${to})`,
    color: '#fff',
  };
}
