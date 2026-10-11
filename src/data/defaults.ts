import type { Config, Donation, OpKind, Preset } from './types';

const NZT = 'https://nztcdn.com/files/';

/** Дефолтная медиа — настоящая гифка из готового набора (не заглушка: нетронутый
 *  пресет виден в OBS, «GIF»-плейсхолдер там показывать нельзя). */
export const DEFAULT_MEDIA_URL = NZT + '12d9da8e-6310-42e0-bea5-85f93267d19d.webp';

/** Старая SVG-заглушка «GIF» из дефолтов до 11.10.2026 — мигрируется на реальную гифку. */
export const LEGACY_PLACEHOLDER_PREFIX = 'data:image/svg+xml';

/** Готовые наборы: клик — пресет с медиа, цветом и размещением. */
export const READY_PRESETS: Array<{ id: string; name: string; patch: Partial<Preset> }> = [
  {
    id: 'ready-bottom', name: 'Гифка снизу по центру',
    patch: { x: 460, y: 760, w: 1000, mediaMode: 'single', mediaUrl: NZT + '12d9da8e-6310-42e0-bea5-85f93267d19d.webp', titleColor: '#f7941d', titleAlign: 'center', appear: 'fade' },
  },
  {
    id: 'ready-corner', name: 'Гифка в углу',
    patch: { x: 40, y: 40, w: 520, mediaMode: 'single', mediaUrl: NZT + '9cbf63b7-e4b3-4d43-acbe-7a407e6c1fb6.webp', titleColor: '#b36bf5', titleAlign: 'left', appear: 'slide' },
  },
  {
    id: 'ready-center', name: 'Гифка по центру',
    patch: { x: 610, y: 340, w: 700, mediaMode: 'single', mediaUrl: NZT + '379ceef0-b6be-47b9-995f-ac98df2dfe3e.webp', titleColor: '#17d985', titleAlign: 'center' },
  },
  {
    id: 'ready-wide', name: 'Широкая полоса',
    patch: { x: 210, y: 880, w: 1500, mediaMode: 'single', mediaUrl: NZT + 'f3f2bb8c-529a-43c7-907c-568ad0c51107.webp', titleColor: '#f7941d', titleAlign: 'center' },
  },
  {
    id: 'ready-right', name: 'Справа с сообщением',
    patch: { x: 1180, y: 60, w: 620, mediaMode: 'single', mediaUrl: NZT + 'f6261e1b-8534-4a4d-97d1-2cc0ea5d402a.webp', titleColor: '#5E9FE8', titleAlign: 'left' },
  },
  {
    id: 'ready-tall', name: 'Крупная гифка',
    patch: { x: 560, y: 240, w: 800, mediaMode: 'single', mediaUrl: NZT + 'e3afef6a-036a-422c-8542-ecd8780d2f3e.webp', titleColor: '#e5484d', titleAlign: 'center' },
  },
  {
    id: 'ready-tiny', name: 'Компактная плашка',
    patch: { x: 60, y: 60, w: 420, mediaMode: 'single', mediaUrl: NZT + 'b99a9214-60c0-4bb6-85b0-fac8f9e79f39.webp', titleColor: '#ffffff', titleAlign: 'left' },
  },
  {
    id: 'ready-purple', name: 'Фиолетовый низ',
    patch: { x: 460, y: 820, w: 1000, mediaMode: 'single', mediaUrl: NZT + '0e00f69e-6ec2-42d7-a1d0-61992a137b0f.webp', titleColor: '#b36bf5', titleAlign: 'center', appear: 'fade' },
  },
  {
    id: 'ready-twitchy', name: 'Плашка сверху',
    patch: { x: 1160, y: 40, w: 640, mediaMode: 'single', mediaUrl: NZT + '5e7b144b-5d32-4dcd-b3e0-a41dc25d04a3.webp', titleColor: '#f7941d', titleAlign: 'right', appear: 'slide' },
  },
];

export const READY_MEDIA: string[] = READY_PRESETS.map((r) => r.patch.mediaUrl as string);
READY_MEDIA.push('https://nztcdn.com/files/b453bce2-1f2a-4b44-b8c7-26febbc0db2e.webp');

export function defaultPresets(): Preset[] {
  const base = {
    mediaMode: 'single' as const,
    mediaTiers: [],
    titleTemplate: '{имя} - {сумма} RUB!',
    titleColor: '#f7941d',
    textTemplate: '{текст}',
    titleAlign: 'center' as const,
    shadow: true,
    mediaUrl: DEFAULT_MEDIA_URL,
    alertSound: 'coin',
  };
  return [
    { ...base, id: 'p1', name: 'Снизу по центру', x: 460, y: 880, w: 1000, h: 160,
      fontSize: 40, radius: 12, durationSec: 6, appear: 'fade', volume: 70, showGoal: true },
    { ...base, id: 'p2', name: 'Плашка в углу', x: 40, y: 40, w: 520, h: 130,
      fontSize: 26, titleColor: '#b36bf5', radius: 12, durationSec: 7, appear: 'slide', volume: 70, showGoal: false },
    { ...base, id: 'p3', name: 'Центр экрана', x: 660, y: 430, w: 600, h: 220,
      fontSize: 32, radius: 16, durationSec: 8, appear: 'fade', volume: 80, showGoal: false },
  ].map((p) => p as Preset);
}

/** Достраивает пресет из старого localStorage новыми полями. */
export function normalizePreset(p: Partial<Preset> & { id: string; name?: string }): Preset {
  const base = defaultPresets()[0];
  // старый дефолт fontSize 30 (до 11.10.2026) мелок на фоне гифки — мигрируем на 40
  const legacyFontSize = p.fontSize === 30;
  const legacyMedia = typeof p.mediaUrl === 'string' && p.mediaUrl.startsWith(LEGACY_PLACEHOLDER_PREFIX);
  return {
    ...base,
    ...p,
    mediaUrl: legacyMedia ? DEFAULT_MEDIA_URL : (p.mediaUrl ?? base.mediaUrl),
    fontSize: legacyFontSize ? 40 : (p.fontSize ?? base.fontSize),
    id: p.id,
    name: p.name ?? 'Вариант',
    mediaMode: p.mediaMode === 'tiers' ? 'tiers' : 'single',
    mediaTiers: p.mediaTiers ?? [],
    titleTemplate: p.titleTemplate ?? base.titleTemplate,
    titleColor: p.titleColor ?? base.titleColor,
    textTemplate: p.textTemplate ?? base.textTemplate,
    titleAlign: p.titleAlign === 'left' || p.titleAlign === 'right' ? p.titleAlign : 'center',
    shadow: p.shadow ?? true,
    alertSound: typeof p.alertSound === 'string' ? p.alertSound : 'coin',
  };
}

/** Медиа — видео (mp4/webm) или картинка? */
export function isVideoUrl(u: string): boolean {
  return /^data:video/.test(u) || /\.(mp4|webm|mov)(\?|$)/i.test(u);
}

/** Готовая гифка из набора? Для них нижние углы медиа скругляются радиусом алерта. */
export function isReadyMedia(u: string): boolean {
  return READY_MEDIA.includes(u);
}

/** Выбор медиа под сумму: в режиме tiers — уровень с наибольшим подходящим minSum. */
export function pickMedia(p: Preset, sum: number): string {
  if (p.mediaMode === 'tiers') {
    const tiers = [...(p.mediaTiers ?? [])].sort((a, b) => b.minSum - a.minSum);
    return tiers.find((t) => sum >= t.minSum && t.url)?.url ?? '';
  }
  return p.mediaUrl ?? '';
}

export const DEMO_STREAMER = { id: 1, username: 'Udodov', slug: 'udodov', secret: 'demo-secret-123', avatar: 'https://nztcdn.com/avatar/s/1782902205/638074.webp' };

/** Описание по умолчанию, если стример не заполнил био. */
export const DEFAULT_BIO = 'Спасибо, что поддерживаешь канал! ❤';

/** Приветствие-бабл на странице доната по умолчанию. */
export const DEFAULT_GREETING = 'Спасибо большое за поддержку! Каждый донат — плюс к качеству контента ❤️';

/** Код голоса, который всегда бесплатен и выбран по умолчанию на странице доната. */
export const FREE_VOICE_CODE = 'sergei';

/** SVG-аватар стримера для страницы доната: буква имени на тёмном градиенте (data-uri). */
export function streamerAvatar(username: string): string {
  const letter = (username.trim()[0] ?? '?').toUpperCase();
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#2e2e35"/><stop offset="1" stop-color="#141416"/>` +
    `</linearGradient></defs>` +
    `<rect width="96" height="96" fill="url(#g)"/>` +
    `<text x="48" y="51" dominant-baseline="central" text-anchor="middle" ` +
    `font-family="Arial, sans-serif" font-size="38" font-weight="700" fill="#ececee">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function defaultConfig(now: number): Config {
  return {
    minimum: 10,
    acceptHeld: false,
    allowAnonymous: true,
    textLimit: 180,
    bannedWords: [],
    voices: [
      { code: 'natalia', name: 'Natalia', price: 10, premium: false, enabled: true, gender: 'female', ttsId: '7a62541e-5492-410e-95ff-3abd096fce87' },
      { code: 'daria', name: 'Daria', price: 10, premium: false, enabled: true, gender: 'female', ttsId: '25b7aaa6-1670-42dc-b791-419322400803' },
      { code: 'tatiana', name: 'Tatiana', price: 10, premium: false, enabled: true, gender: 'female', ttsId: '064b17af-d36b-4bfb-b003-be07dba1b649' },
      { code: 'olga', name: 'Olga', price: 30, premium: true, enabled: true, gender: 'female', ttsId: '9ed9f7e7-3ef6-4773-9dd3-ffcb479ca1f0' },
      { code: 'irina', name: 'Irina', price: 30, premium: true, enabled: false, gender: 'female', ttsId: '642014de-c0e3-4133-adc0-36b5309c23e6' },
      { code: 'natalya', name: 'Natalya', price: 20, premium: false, enabled: false, gender: 'female', ttsId: '779673f3-895f-4935-b6b5-b031dc78b319' },
      { code: 'sergei', name: 'Sergei', price: 0, premium: false, enabled: true, gender: 'male', ttsId: '1e4176b1-3db9-44d6-a601-4fe68b041942' },
      { code: 'alexei', name: 'Alexei', price: 30, premium: true, enabled: true, gender: 'male', ttsId: '069ff31a-5524-4945-a403-f746ee617507' },
      { code: 'dmitri', name: 'Dmitri', price: 20, premium: false, enabled: false, gender: 'male', ttsId: '888b7df4-e165-4852-bfec-0ab2b96aaa46' },
    ],
    testVoiceCode: 'natalia',
    effects: [
      { code: 'confetti', name: 'Конфетти', price: 10, enabled: true },
      { code: 'hearts', name: 'Сердечки', price: 15, enabled: true },
      { code: 'flash', name: 'Вспышка', price: 15, enabled: false },
    ],
    presets: defaultPresets(),
    activePresetId: 'p1',
    slug: DEMO_STREAMER.slug,
    lztToken: '',
    merchantId: '',
    profileName: '',
    profileAvatar: '',
    profileBio: '',
    goalTitle: '',
    goalTarget: 50000,
    goalEnabled: false,
    goalBoundary: now - 3 * 24 * 60 * 60 * 1000,
    goalBarText: '{собрано} / {цель} RUB ({процент}%)',
    goalBarAccent: '#f7941d',
    revision: 1,
  };
}

export function seedDonations(now: number): Donation[] {
  const min = 60 * 1000;
  const hour = 60 * min;
  const mk = (
    id: string, ts: number, incoming: number, shown: number,
    username: string, text: string, status: Donation['status'],
    features: Donation['features'], removed: Donation['removedFeatures'] = [],
    kind: OpKind = 'donate',
    anonymous = false,
  ): Donation => ({
    operationId: id, ts, incomingSum: incoming, shownSum: shown,
    features, removedFeatures: removed, text, username, anonymous,
    status, kind, configRevision: 1,
  });
  return [
    mk('op_seed_16', now - 4 * min, 500, 470, 'Zelscan', 'Лучшему стримеру LZT! Держи на новый микрофон', 'pending', [{ kind: 'voice', code: 'pm1' }]),
    mk('op_seed_15', now - 9 * min, 30, 20, 'fanat_tt', 'го катку', 'pending', [{ kind: 'voice', code: 'm' }]),
    mk('op_seed_14', now - 23 * min, 77, 77, 'nastya_vv', 'просто так, продолжай в том же духе', 'finished', []),
    mk('op_seed_13', now - 41 * min, 111, 100, 'Максим', 'Кинь конфетти!', 'finished', [{ kind: 'effect', code: 'confetti' }], [], 'donate', true),
    mk('op_seed_12', now - 2 * hour, 100, 90, 'viewer_41', 'Лучший стрим!', 'finished', [{ kind: 'voice', code: 'm' }]),
    mk('op_seed_11', now - 3 * hour, 30, 30, 'kirill_98', 'держи на кофе', 'finished', []),
    mk('op_seed_10', now - 5 * hour, 20, 10, 'DarkWolf', 'анонимный привет', 'finished', [{ kind: 'voice', code: 'f' }], [], 'donate', true),
    mk('op_seed_9', now - 7 * hour, 50, 50, 'sedoi_777', 'го катку', 'finished', []),
    mk('op_seed_8', now - 26 * hour, 15, 15, 'Артём', 'первый донат, не суди строго', 'finished', []),
    mk('op_seed_7', now - 29 * hour, 1000, 970, 'Zelscan', 'за 1000 подписчиков! красавчики', 'finished', [{ kind: 'voice', code: 'pm1' }]),
    mk('op_seed_6', now - 31 * hour, 10, 10, 'oleg', 'го го', 'cancelled', []),
    mk('op_seed_5', now - 50 * hour, 40, 40, 'marmelad', 'привет из Запорожья', 'finished', []),
    mk('op_seed_4', now - 53 * hour, 60, 50, 'sveta', 'такс, а что за трек играет?', 'finished', [{ kind: 'effect', code: 'confetti' }]),
    mk('op_seed_3', now - 3 * 24 * hour, 250, 220, 'Тимур', 'на стикеры', 'finished', [{ kind: 'effect', code: 'confetti' }]),
    mk('op_seed_2', now - 4 * 24 * hour, 21, 21, 'Loli_Pop', 'вжух', 'finished', []),
    mk('op_seed_1', now - 5 * 24 * hour, 10, 10, 'viewer_18', 'жадный тест — фичи срезаны', 'finished', [], [], 'test'),
  ];
}

export const NAMES = ['Zelscan', 'kirill_98', 'Максим', 'nastya_vv', 'DarkWolf', 'fanat_tt', 'Артём', 'sedoi_777'];
export const SAMPLES: Array<{ sum: number; comment: string }> = [
  { sum: 30, comment: 'LD1|v=natalia|a=0|Классный стрим, продолжай!' },
  { sum: 20, comment: 'LD1|v=daria|e=confetti|a=0|Ура, конфетти!' },
  { sum: 100, comment: 'LD1|v=olga|a=1|Анонимный жирный донат' },
  { sum: 55, comment: 'LD1|v=sergei|e=hearts|a=0|Сердечки! Вжух!' },
  { sum: 15, comment: 'просто перевод без payload' },
  { sum: 250, comment: 'LD1|v=tatiana|a=0|на оборудование для стрима' },
  { sum: 50, comment: 'LD1|v=zz|a=0|неизвестный голос будет отрезан' },
];
