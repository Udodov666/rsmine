/**
 * Фильтр слов для алертов: донат проходит, но запрещённое заменяется ****.
 * - Мат (твич-запрещёнка + склонения) маскируется ВЕЗДЕ: алерт, озвучка, панель.
 * - Ссылки маскируются ТОЛЬКО в алерте; в панели стример видит их как есть.
 * Оригинал текста в Donation.text не трогаем — маскируем при рендере.
 * Совпадение по целым словам (границы букв), регистр и leet- уточнения
 * (п1дор, нeгр, latin-mix) ловятся нормализацией 1:1 — индексы совпадают.
 */

/** Базовый словарь: только твич-запрещёнка (расизм/гомофобия/нацизм) + склонения.
 *  Обычный мат (блять/сука/хуй) — НЕ трогаем по решению владельца. */
export const DEFAULT_BANNED_WORDS: string[] = [
  // гомофобия
  'пидор', 'пидора', 'пидораса', 'пидорасу', 'пидорасом', 'пидорас', 'пидорасы',
  'пидр', 'пидар', 'пидарас', 'пидараса',
  // расизм (рус)
  'негр', 'негра', 'негру', 'негром', 'негры', 'негров',
  'хач', 'хача', 'хачу', 'хачом', 'хачи', 'хачик', 'хачика',
  'чурка', 'чурки', 'чурку', 'чуркой',
  'черномазый', 'черножопый', 'черножопые',
  'узкоглазый', 'узкоглазые',
  'хохол', 'хохла', 'хохлу', 'хохлом', 'хохлы', 'хохлов',
  'москаль', 'москаля', 'москали', 'кацап', 'кацапа', 'кацапы',
  'жид', 'жида', 'жиду', 'жидом', 'жиды', 'жидов',
  'пиндос', 'пиндоса', 'пиндосы',
  'чучмек', 'чучмека',
  // нацизм
  'гитлер', 'гитлера', 'гитлером',
  // расизм/гомофобия (latin + транслит)
  'nigga', 'nigger', 'niggers', 'ниггер', 'ниггера', 'ниггеры',
  'faggot', 'faggots', 'fag',
];

/** leet/latin-mix → кириллица (строго 1 символ → 1 символ, длины совпадают). */
const LEET: Record<string, string> = {
  a: 'а', e: 'е', o: 'о', p: 'р', c: 'с', x: 'х', m: 'м', t: 'т',
  k: 'к', h: 'н', y: 'у', b: 'в', d: 'д', u: 'и', n: 'п',
  '0': 'о', '1': 'и', '3': 'з', '4': 'ч', '6': 'б', '8': 'в',
};

function normalizeChar(ch: string): string {
  const low = ch.toLowerCase();
  return LEET[low] ?? low;
}

/** Нормализация слова/текста для сравнения (регистр + leet). */
export function normalizeWord(s: string): string {
  let out = '';
  for (const ch of s.toLowerCase()) out += LEET[ch] ?? ch;
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const MASK = '****';

/** Замаскировать запрещённые слова (целые слова, iu, leet-устойчиво). */
export function maskBannedWords(text: string, extra: string[] = []): string {
  if (!text) return text;
  const words = [...DEFAULT_BANNED_WORDS];
  for (const w of Array.isArray(extra) ? extra : []) {
    const n = normalizeWord(w.trim());
    if (n) words.push(n);
  }
  if (words.length === 0) return text;
  // нормализованная копия той же длины — индексы совпадений переносим в оригинал.
  // Два прохода: нормализованные паттерны по норме (п1дор, нeгр) и сырые
  // паттерны по оригиналу (nigga, faggot) — отрезки объединяем.
  let norm = '';
  for (const ch of text) norm += normalizeChar(ch);
  const normWords = words.map(normalizeWord);
  let reNorm: RegExp;
  let reRaw: RegExp;
  try {
    const alt = (list: string[]) => `(?<!\\p{L})(?:${list.map(escapeRegExp).join('|')})(?!\\p{L})`;
    reNorm = new RegExp(alt(normWords), 'giu');
    reRaw = new RegExp(alt(words), 'giu');
  } catch {
    return text; // старый движок без lookbehind — лучше показать как есть
  }
  const spans: Array<[number, number]> = [];
  norm.replace(reNorm, (m, offset) => {
    spans.push([offset as number, (offset as number) + (m as string).length]);
    return m as string;
  });
  text.replace(reRaw, (m, offset) => {
    spans.push([offset as number, (offset as number) + (m as string).length]);
    return m as string;
  });
  if (spans.length === 0) return text;
  spans.sort((a, b) => a[0] - b[0]);
  let out = '';
  let last = 0;
  for (const [s, e] of spans) {
    if (s < last) continue; // пересечение — уже закрыто
    out += text.slice(last, s) + MASK;
    last = Math.max(last, e);
  }
  return out + text.slice(last);
}

const LINK_RE = /(https?:\/\/[^\s]+|www\.[^\s]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:ru|com|net|org|io|gg|me|tv|su|by|kz|ua|info|biz|xyz|top|link|click|shop|site|online|store|fun|live|cc|ly|gl|tf)\b[^\s]*)/gi;

/** Замаскировать ссылки (www, http(s), bare-домены). */
export function maskLinks(text: string): string {
  if (!text) return text;
  return text.replace(LINK_RE, MASK);
}

/** Текст для алерта/озвучки: мат + ссылки скрыты, донат проходит. */
export function maskAlertText(text: string, extra: string[] = []): string {
  return maskLinks(maskBannedWords(text, extra));
}
