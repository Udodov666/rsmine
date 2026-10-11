export type OpStatus = 'pending' | 'finished' | 'cancelled';
export type OpKind = 'donate' | 'test' | 'replay';

/** Заявленная фича из payload (только коды из белого списка конфига). */
export interface Feature {
  kind: 'voice' | 'effect';
  code: string;
}

export interface Donation {
  operationId: string;
  ts: number;
  /** фактическая сумма перевода — единственный доверенный источник */
  incomingSum: number;
  /** сумма, показанная на стриме (результат экономики) */
  shownSum: number;
  /** заявленные и оставшиеся после экономики фичи (играем) */
  features: Feature[];
  /** срезанные экономикой (для деталей истории) */
  removedFeatures: Feature[];
  text: string;
  username: string;
  anonymous: boolean;
  status: OpStatus;
  kind: OpKind;
  configRevision: number;
}

export interface VoiceItem {
  code: string;
  name: string;
  price: number;
  premium: boolean;
  enabled: boolean;
  /** id голоса в Cartesia (sonic-3.6); без него голос играется дефолтным */
  ttsId?: string;
  /** пол — для группировки каталога */
  gender?: 'male' | 'female';
}

export interface EffectItem {
  code: string;
  name: string;
  price: number;
  enabled: boolean;
}

export type AppearEffect = 'none' | 'fade' | 'slide';

/** Медиа-уровень: донаты от minSum ₽ показывают это изображение/гиф/видео. */
export interface MediaTier {
  minSum: number;
  url: string;
}

/** Пресет окна доната. Анатомия как у реальных сервисов:
 *  медиа сверху → жирный цветной заголовок → белое описание. */
export interface Preset {
  id: string;
  name: string;
  /** позиция в px внутри сцены 1920×1080 */
  x: number;
  y: number;
  w: number;
  h: number;
  /** медиа: одно для всех донатов или зависит от суммы */
  mediaMode: 'single' | 'tiers';
  mediaUrl: string;
  mediaTiers: MediaTier[];
  /** жирный заголовок, например «{имя} - {сумма} RUB!» */
  titleTemplate: string;
  titleColor: string;
  /** белое описание под заголовком, обычно «{текст}» */
  textTemplate: string;
  /** выравнивание заголовка и сообщения (по центру — дефолт) */
  titleAlign: 'left' | 'center' | 'right';
  fontSize: number;
  /** мягкая тень у текста алерта */
  shadow: boolean;
  radius: number;
  durationSec: number;
  appear: AppearEffect;
  volume: number;
  /** звук в начале алерта (код из ALERT_SOUNDS); '' — без звука */
  alertSound: string;
  showGoal: boolean;
}

export interface Config {
  minimum: number;
  /** принимать донаты, которые ещё на холде (не подтверждены LZT) */
  acceptHeld: boolean;
  /** зритель может скрыть свой ник */
  allowAnonymous: boolean;
  textLimit: number;
  /** свои запрещённые слова стримера (плюс встроенный словарь; в алерте → ****) */
  bannedWords: string[];
  voices: VoiceItem[];
  effects: EffectItem[];
  presets: Preset[];
  activePresetId: string;
  /** голос тестового доната (code из voices); пусто — первый включённый */
  testVoiceCode: string;
  slug: string;
  /** LZT API-токен со scope payment (демо: хранится локально) */
  lztToken: string;
  /** ID мерчанта LZT для счетов (пусто — не задан) */
  merchantId: string;
  /** Профиль стримера для публичной страницы: пусто — берётся из авторизации */
  profileName: string;
  /** Своя аватарка (dataURL); пусто — сгенерированная из ника */
  profileAvatar: string;
  /** Короткое описание под ником на странице доната */
  profileBio: string;
  /** цель сбора (виджет «Активные цели» как в DA) */
  goalTitle: string;
  goalTarget: number;
  goalEnabled: boolean;
  /** tracking boundary цели (ts) */
  goalBoundary: number;
  /** полоса цели на стриме: текст с подстановками и акцентная метка;
      заголовок полосы = название цели (отдельного поля больше нет) */
  goalBarText: string;
  goalBarAccent: string;
  revision: number;
}

export interface PublicConfig {
  streamerName: string;
  slug: string;
  /** SVG-аватар стримера (data-uri), генерируется из имени */
  avatar: string;
  /** Описание стримера под ником */
  bio: string;
  /** Приветствие на странице доната */
  greeting: string;
  minimum: number;
  textLimit: number;
  goal: { enabled: boolean; title: string; target: number; progress: number } | null;
  voices: VoiceItem[];
  effects: EffectItem[];
  /** свои запрещённые слова стримера (оверлей маскирует ими мат) */
  banned: string[];
  /** Публичный срез активного пресета (приходит с сервера — рендерит оверлей OBS) */
  preset?: Record<string, unknown> | null;
}

export interface IncomingEvent {
  operationId: string;
  ts?: number;
  incomingSum: number;
  comment: string;
  username?: string;
  kind?: OpKind;
}
