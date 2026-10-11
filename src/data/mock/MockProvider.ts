import { calcEconomy } from '../../lib/economy';
import { parseLd1 } from '../../lib/ld1';
import { defaultConfig, seedDonations, normalizePreset, NAMES, SAMPLES, DEMO_STREAMER, DEFAULT_GREETING, streamerAvatar, FREE_VOICE_CODE } from '../defaults';
import type { Config, Donation, IncomingEvent, OpKind, PublicConfig } from '../types';
import type { DataProvider } from '../provider';

const LS_KEY = 'ld_mock_store_v3';
const HEARTBEAT_KEY = 'ld_mock_heartbeat_v1';

interface Store {
  config: Config;
  donations: Donation[];
  heartbeat: number | null;
}

/**
 * MockDataProvider: localStorage как shared store между вкладками
 * (панель / публичная страница / оверлей в разных табах видят одни данные).
 * Никакой сети: реальные ключи и платежи не используются (01 §3E).
 * Используется как фолбэк, когда живой API (wrangler dev) недоступен.
 */
export class MockProvider implements DataProvider {
  readonly isMock: boolean = true;
  protected store: Store;
  protected storeKey = LS_KEY;
  protected subs = new Set<() => void>();
  private timer: number | undefined;
  private autoStream: number | undefined;
  /** курсор цикла по уровням для тестовых донатов (каждый тест — следующая гифка) */
  protected testTierCursor = 0;
  /** сумма последнего теста: превью сцены показывает её, чтобы совпадать с алертом */
  protected lastTestSum: number | null = null;

  constructor(
    /** live-режим (LiveProvider) отключает фейковые сиды донатов и автострим,
     *  и живёт в своём хранилище (storeKey), не видя мок-донатов */
    options?: { seed?: boolean; autoStream?: boolean; storeKey?: string },
  ) {
    const seed = options?.seed ?? true;
    const autoStream = options?.autoStream ?? true;
    this.storeKey = options?.storeKey ?? LS_KEY;
    this.store = this.load(seed);
    this.timer = window.setInterval(() => this.tickStatuses(), 2000);
    // живой стрим: каждые 18 сек прилетает рандомный донат 10–100 ₽
    if (autoStream) this.autoStream = window.setInterval(() => this.simulateStreamDonation(), 18_000);
  }

  dispose() {
    if (this.timer) window.clearInterval(this.timer);
    if (this.autoStream) window.clearInterval(this.autoStream);
    this.subs.clear();
  }

  protected load(seed = true): Store {
    try {
      // читаем СВОЙ стор (live-провайдер живёт в rsmine.live.v1 и не должен
      // терять данные при перезагрузке); legacy-импорт конфига — отдельно
      // в LiveProvider.loadCachedConfig, сюда не тащим.
      const raw = localStorage.getItem(this.storeKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Store;
        if (parsed?.config && Array.isArray(parsed.donations)) {
          // миграция: добавляем поля, появившиеся в конфиге после первого запуска
          parsed.config = { ...defaultConfig(Date.now()), ...parsed.config };
          parsed.config.presets = parsed.config.presets.map(normalizePreset);
          // миграция голосов: каталог теперь реальные голоса Cartesia (с ttsId)
          if (!parsed.config.voices?.some((v) => v.ttsId)) {
            parsed.config.voices = defaultConfig(Date.now()).voices;
          }
          // миграция голосов: у старых каталогов нет пола (группировка Ж/М) — берём из
          // дефолтного; голос FREE_VOICE_CODE всегда бесплатен и не премиум
          const defVoices = defaultConfig(Date.now()).voices;
          parsed.config.voices = (parsed.config.voices ?? []).map((v) => {
            const def = defVoices.find((d) => d.code === v.code);
            const isFree = v.code === FREE_VOICE_CODE;
            return {
              ...v,
              gender: v.gender ?? def?.gender ?? 'female',
              price: isFree ? 0 : v.price,
              premium: isFree ? false : v.premium,
            };
          });
          // миграция эффектов: старые каталоги приводятся к актуальному (без тряски и слайда)
          if (!parsed.config.effects?.some((e) => e.code === 'hearts') ||
              parsed.config.effects.some((e) => e.code === 'shake')) {
            parsed.config.effects = defaultConfig(Date.now()).effects;
          }
          // переименование демо-ссылки: нетронутый дефолт demo → udodov
          if (parsed.config.slug === 'demo') parsed.config.slug = 'udodov';
          localStorage.setItem(this.storeKey, JSON.stringify(parsed));
          return parsed;
        }
      }
    } catch {
      /* повреждённый стор — пересид */
    }
    const now = Date.now();
    const store: Store = {
      config: defaultConfig(now),
      donations: seed ? seedDonations(now) : [],
      heartbeat: null,
    };
    this.save(store);
    return store;
  }

  protected save(store: Store) {
    localStorage.setItem(this.storeKey, JSON.stringify(store));
  }

  protected persist() {
    this.save(this.store);
    this.subs.forEach((cb) => cb());
  }

  subscribe(cb: () => void): () => void {
    this.subs.add(cb);
    const onStorage = (e: StorageEvent) => {
      if (e.key === this.storeKey) {
        this.store = this.load();
        cb();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      this.subs.delete(cb);
      window.removeEventListener('storage', onStorage);
    };
  }

  getConfig(): Config {
    return JSON.parse(JSON.stringify(this.store.config)) as Config;
  }

  saveConfig(next: Config): Config {
    next.revision = this.store.config.revision + 1;
    this.store.config = next;
    this.persist();
    return this.getConfig();
  }

  listDonations(): Donation[] {
    return [...this.store.donations].sort((a, b) => b.ts - a.ts);
  }

  ingest(e: IncomingEvent): Donation | null {
    if (this.store.donations.some((d) => d.operationId === e.operationId)) return null;
    const cfg = this.store.config;
    const ts = e.ts ?? Date.now();
    const payload = parseLd1(e.comment ?? '', cfg.textLimit);
    const text = payload ? payload.text : (e.comment ?? '').replace(/[|]/g, ' ').slice(0, cfg.textLimit);

    // валидные фичи: код из включённого каталога стримера
    const prices: Record<string, number> = {};
    const features: Donation['features'] = [];
    if (payload) {
      const v = payload.voice ? cfg.voices.find((x) => x.code === payload.voice && x.enabled) : undefined;
      if (v) {
        features.push({ kind: 'voice', code: v.code });
        prices[v.code] = v.price;
      }
      const ef = payload.effect ? cfg.effects.find((x) => x.code === payload.effect && x.enabled) : undefined;
      if (ef) {
        features.push({ kind: 'effect', code: ef.code });
        prices[ef.code] = ef.price;
      }
    }

    const eco = calcEconomy({
      incomingSum: e.incomingSum,
      minimum: cfg.minimum,
      features,
      prices,
    });

    const donation: Donation = {
      operationId: e.operationId,
      ts,
      incomingSum: e.incomingSum,
      shownSum: eco.shown,
      features: eco.retained,
      removedFeatures: eco.removed,
      text,
      username: e.username?.trim() || 'viewer',
      anonymous: payload?.anonymous ?? false,
      status: 'pending',
      kind: e.kind ?? 'donate',
      configRevision: cfg.revision,
    };
    this.store.donations.push(donation);
    this.persist();
    return donation;
  }
  simulateRandomPayment(): void {
    const s = SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
    const nick = NAMES[Math.floor(Math.random() * NAMES.length)];
    this.ingest({
      operationId: `op_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      incomingSum: s.sum,
      comment: s.comment,
      username: nick,
    });
  }

  /** Живой стрим: рандомный донат 10–100 ₽ с текстом из сэмплов. */
  simulateStreamDonation(): void {
    const s = SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
    const nick = NAMES[Math.floor(Math.random() * NAMES.length)];
    this.ingest({
      operationId: `op_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      incomingSum: 10 + Math.floor(Math.random() * 91),
      comment: s.comment,
      username: nick,
    });
  }

  /** Сумма для превью теста: уровень ПОСЛЕДНЕГО сработавшего теста (совпадает с
   * алертом), а до первого теста — уровень, который сыграет следующим. */
  peekTestSum(): number {
    if (this.lastTestSum !== null) return this.lastTestSum;
    const cfg = this.store.config;
    const preset = cfg.presets.find((p) => p.id === cfg.activePresetId) ?? cfg.presets[0];
    if (preset?.mediaMode === 'tiers' && (preset.mediaTiers ?? []).length) {
      const levels = [...preset.mediaTiers].sort((a, b) => a.minSum - b.minSum);
      return levels[this.testTierCursor % levels.length].minSum;
    }
    return 100;
  }

  simulateTest(): Donation | null {
    // Сумма — следующий уровень цикла (каждый тест — следующая гифка)
    const cfg = this.store.config;
    const preset = cfg.presets.find((p) => p.id === cfg.activePresetId) ?? cfg.presets[0];
    const levels = preset?.mediaMode === 'tiers' && (preset.mediaTiers ?? []).length
      ? [...preset.mediaTiers].sort((a, b) => a.minSum - b.minSum)
      : null;
    const testSum = levels ? levels[this.testTierCursor % levels.length].minSum : 100;
    if (levels) this.testTierCursor += 1;
    return this.simulateTestWith(testSum, 'Тестовый донат — деньги не переводились');
  }

  simulateTestWith(sum: number, text: string): Donation | null {
    // голос теста: выбранный стримером (testVoiceCode), иначе первый включённый.
    // incomingSum добирается на цены фич, чтобы shownSum был ровно заданной
    // сумме (гифка выбирается по ней же); сцена показывает этот же уровень.
    const cfg = this.store.config;
    const voice = cfg.voices.find((v) => v.enabled && v.code === (cfg.testVoiceCode || undefined)) ?? cfg.voices.find((v) => v.enabled);
    const effect = cfg.effects.find((e) => e.code === 'confetti' && e.enabled);
    const safeSum = Math.min(1000000, Math.max(1, Math.round(sum) || 100));
    this.lastTestSum = safeSum;
    const incomingSum = safeSum + (voice ? voice.price : 0) + (effect ? effect.price : 0);
    const flags = [...(voice ? [`v=${voice.code}`] : []), ...(effect ? ['e=confetti'] : []), 'a=0'];
    const safeText = text.trim().slice(0, 180) || 'Тестовый донат — деньги не переводились';
    return this.ingest({
      operationId: `test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      incomingSum,
      comment: `LD1|${flags.join('|')}|${safeText}`,
      username: 'Тест',
      kind: 'test',
    });
  }

  simulateReplay(d: Donation): Donation | null {
    const comment = d.features.length
      ? `LD1|${d.features.map((f) => (f.kind === 'voice' ? `v=${f.code}` : `e=${f.code}`)).join('|')}|${d.text}`
      : d.text;
    return this.ingest({
      operationId: `replay_${d.operationId}_${Date.now()}`,
      incomingSum: d.incomingSum,
      comment,
      username: d.username,
      kind: 'replay',
    });
  }

  tickStatuses(): void {
    let changed = false;
    const now = Date.now();
    for (const d of this.store.donations) {
      if (d.status !== 'pending') continue;
      if (now - d.ts < 12000) continue;
      d.status = Math.random() < 0.12 ? 'cancelled' : 'finished';
      changed = true;
    }
    if (changed) this.persist();
  }

  touchHeartbeat(): void {
    this.store.heartbeat = Date.now();
    localStorage.setItem(HEARTBEAT_KEY, String(this.store.heartbeat));
  }

  heartbeatAgeSec(): number | null {
    const raw = this.store.heartbeat ?? Number(localStorage.getItem(HEARTBEAT_KEY) ?? '0');
    if (!raw) return null;
    return Math.round((Date.now() - raw) / 1000);
  }

  resetGoalBoundary(): void {
    this.store.config.goalBoundary = Date.now();
    this.persist();
  }

  getPublicConfig(slug: string): PublicConfig | null {
    const cfg = this.store.config;
    if (slug !== cfg.slug) return null;
    const finished = this.store.donations.filter(
      (d) => d.kind === 'donate' && d.status === 'finished' && d.ts >= cfg.goalBoundary,
    );
    const progress = finished.reduce((s, d) => s + d.shownSum, 0);
    const name = cfg.profileName.trim() || DEMO_STREAMER.username;
    return {
      streamerName: name,
      slug: cfg.slug,
      avatar: cfg.profileAvatar || DEMO_STREAMER.avatar || streamerAvatar(name),
      bio: cfg.profileBio.trim(),
      banned: cfg.bannedWords ?? [],
      greeting: DEFAULT_GREETING,
      minimum: cfg.minimum,
      textLimit: Math.min(cfg.textLimit, 180),
      goal:
        cfg.goalTitle && cfg.goalEnabled
          ? { enabled: true, title: cfg.goalTitle, target: cfg.goalTarget, progress }
          : null,
      voices: cfg.voices.filter((v) => v.enabled),
      effects: cfg.effects.filter((e) => e.enabled),
    };
  }

  async fetchPublicConfig(slug: string): Promise<PublicConfig | null> {
    return this.getPublicConfig(slug);
  }

  async demoDonate(
    slug: string,
    p: { incomingSum: number; comment: string; username?: string },
  ): Promise<void> {
    this.ingest({
      operationId: `op_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      incomingSum: p.incomingSum,
      comment: p.comment,
      username: p.username,
    });
  }
}

let singleton: MockProvider | null = null;

export function getMockProvider(options?: { seed?: boolean; autoStream?: boolean }): MockProvider {
  if (!singleton) singleton = new MockProvider(options);
  return singleton;
}
