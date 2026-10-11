/**
 * LiveProvider (план Step 4): панель на реальном аккаунте.
 * — Конфиг (настройки/пресеты/голоса/эффекты/цель) хранится на сервере
 *   (KV аккаунта, /api/profile/me/config), локальный кеш в localStorage.
 * — Донаты: до Step 5-6 (LZT через Tauri-relay) локальная механика без фейка:
 *   история пустая, статистика нулевая, тестовые алерты работают.
 * Наследует локальную механику MockProvider (алерты, тесты, heartbeat).
 */
import { defaultConfig, normalizePreset, FREE_VOICE_CODE } from '../defaults';
import type { Config, Donation, Feature, IncomingEvent, PublicConfig } from '../types';
import { MockProvider } from '../mock/MockProvider';
import { parseLd1, sanitizeText } from '../../lib/ld1';
import { calcEconomy } from '../../lib/economy';
import { getJwt, getTwitch, storeSession } from './auth';
import { fetchDonations, fetchPublicViaServer, getConfig as fetchServerConfig, getMe, putConfig as putServerConfig } from './api';

class LiveProvider extends MockProvider {
  readonly isMock = false;
  /** slug аккаунта (из Twitch-сессии) */
  readonly slug: string;

  constructor() {
    // без фейковых сидов и автострима — донаты только настоящие.
    // Свой чистый стор: мок-донаты из ld_mock_store_v3 сюда не попадают.
    super({ seed: false, autoStream: false, storeKey: 'rsmine.live.v1' });
    const session = getTwitch();
    this.slug = session?.slug ?? 'streamer';

    // начальный конфиг: из live-стора → из старой настройки владельца → дефолты
    const cached = this.loadCachedConfig();
    this.adoptServerShape(cached ?? defaultConfig(Date.now()), false);

    // серверный конфиг: свежее локального (revision) — применяем
    void this.syncFromServer();
    // самолечение протухшей сессии: в localStorage могли остаться пустые
    // ник/аватар от старого логина — добираем с сервера, пустые поля
    // профиля заполняем. Свои значения никогда не трогаем.
    void this.healSessionFromServer();
    // реестр оплат с сервера — в локальную ленту (история/статистика общие
    // для всех браузеров; localStorage остаётся офлайн-кешем)
    void this.syncDonationsFromServer();
    this.donTimer = window.setInterval(() => this.syncDonationsFromServer(), 30_000);
  }

  private donTimer: number | undefined;

  /** Принудительно подтянуть реестр с сервера (после ручного внесения). */
  async refreshDonations(): Promise<void> {
    await this.syncDonationsFromServer();
  }

  /** Слияние серверного реестра в локальный стор (идемпотентно по operationId). */
  private async syncDonationsFromServer(): Promise<void> {
    try {
      // залечить старые строки: пересчитать shown без денег за фичи
      // (раньше серверные донаты ложились целиком в shownSum и раздували топ)
      const cfg0 = this.store.config;
      let healed = false;
      for (const d of this.store.donations) {
        if (!d.operationId.startsWith('lzt_') || d.kind !== 'donate') continue;
        const allF = [...d.features, ...d.removedFeatures];
        const prices: Record<string, number> = {};
        for (const f of allF) {
          const cat = f.kind === 'voice'
            ? cfg0.voices.find((v) => v.code === f.code)
            : cfg0.effects.find((e) => e.code === f.code);
          prices[f.code] = cat?.price ?? 0;
        }
        const eco = calcEconomy({ incomingSum: d.incomingSum, minimum: cfg0.minimum, features: allF, prices });
        if (eco.shown !== d.shownSum || eco.retained.length !== d.features.length || eco.removed.length !== d.removedFeatures.length) {
          d.shownSum = eco.shown;
          d.features = eco.retained;
          d.removedFeatures = eco.removed;
          healed = true;
        }
      }
      if (healed) this.persist();
      const rows = await fetchDonations(this.slug);
      if (rows.length === 0) return;
      const seen = new Set(this.store.donations.map((d) => d.operationId));
      let changed = false;
      for (const r of rows) {
        const id = `lzt_${r.invoice_id}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const sum = Number(r.sum);
        if (!Number.isFinite(sum) || sum <= 0) continue;
        // комментарий — LD1-payload (голос/эффект/аноним) или простой текст.
        // Экономика как в ingest: показано = пришло − цены фич, поэтому
        // деньги за озвучку/эффекты не раздувают топ и цель.
        const cfg = this.store.config;
        const ld1 = parseLd1(String(r.text ?? ''), 180);
        const features: Feature[] = [];
        const prices: Record<string, number> = {};
        if (ld1?.voice) {
          const v = cfg.voices.find((x) => x.code === ld1.voice && x.enabled);
          if (v) { features.push({ kind: 'voice', code: v.code }); prices[v.code] = v.price; }
        }
        if (ld1?.effect) {
          const e = cfg.effects.find((x) => x.code === ld1.effect && x.enabled);
          if (e) { features.push({ kind: 'effect', code: e.code }); prices[e.code] = e.price; }
        }
        const eco = calcEconomy({ incomingSum: sum, minimum: cfg.minimum, features, prices });
        this.store.donations.push({
          operationId: id,
          ts: Number(r.ts) || Date.now(),
          incomingSum: sum,
          shownSum: eco.shown,
          features: eco.retained,
          removedFeatures: eco.removed,
          text: ld1 ? ld1.text : sanitizeText(String(r.text ?? ''), 180),
          username: String(r.username || 'зритель'),
          anonymous: !!ld1?.anonymous,
          status: 'finished',
          kind: 'donate',
          configRevision: this.store.config.revision ?? 0,
        });
        changed = true;
      }
      if (changed) {
        // шапка от бесконечного роста: последние 1000 по времени
        this.store.donations.sort((a, b) => b.ts - a.ts);
        this.store.donations = this.store.donations.slice(0, 1000);
        this.persist();
      }
    } catch {
      /* офлайн — остаёмся на локальном кеше */
    }
  }

  private async healSessionFromServer(): Promise<void> {
    try {
      const me = await getMe();
      if (!me || typeof me !== 'object') return;
      const displayName = typeof me.displayName === 'string' ? me.displayName : '';
      const avatar = typeof me.avatar === 'string' ? me.avatar : '';
      if (!displayName && !avatar) return;
      const jwt = getJwt();
      const cur = getTwitch();
      if (!jwt || !cur) return;
      const next = {
        ...cur,
        displayName: cur.displayName || displayName,
        avatar: cur.avatar || avatar,
      };
      if (next.displayName !== cur.displayName || next.avatar !== cur.avatar) {
        storeSession(jwt, next);
      }
      // adoptServerShape заполняет только пустые поля + уведомляет подписчиков
      this.adoptServerShape(this.store.config, true);
    } catch {
      /* офлайн — остаёмся на локальном */
    }
  }

  /** Конфиг в форме аккаунта: slug = twitch-login, серверные данные поверх дефолтов. */
  private adoptServerShape(cfg: Config, notify: boolean): void {
    const next: Config = { ...cfg, slug: this.slug };
    // профиль из Twitch-сессии: ник/аватар настоящие
    const session = getTwitch();
    if (session) {
      // твич-значения — только как дефолт для пустых полей, свой ник/аватар не затираем
      if (!next.profileName.trim() && session.displayName) next.profileName = session.displayName;
      if (!next.profileAvatar && session.avatar) next.profileAvatar = session.avatar;
    }
    this.applyConfig(next, notify);
  }

  private applyConfig(cfg: Config, notify: boolean): void {
    const normalized: Config = { ...cfg, presets: (cfg.presets ?? []).map(normalizePreset) };
    this.store.config = normalized;
    this.save(this.store);
    if (notify) this.subs.forEach((cb) => cb());
  }

  private loadCachedConfig(): Config | null {
    try {
      // live-стор уже загружен конструктором — конфиг в нём
      if (this.store.config?.presets?.length) return this.store.config;
      // перенос старой НАСТРОЙКИ из mock-хранилища (пресеты/голоса; донаты — нет)
      const legacyRaw = localStorage.getItem('ld_mock_store_v3');
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw) as { config?: Config };
        if (legacy.config?.presets?.length) return legacy.config;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async syncFromServer(): Promise<void> {
    try {
      const server = await fetchServerConfig();
      if (!server?.config) {
        // первый запуск аккаунта: сеем локальный (унаследованный) конфиг на сервер
        const local = this.loadCachedConfig();
        if (local) void putServerConfig(this.store.config);
        return;
      }
      const serverCfg = this.migrate(server.config as Config);
      const local = this.loadCachedConfig();
      // многоустройство: побеждает большая ревизия; при равенстве сервер (истина)
      if (!local || (serverCfg.revision ?? 0) >= (local.revision ?? 0)) {
        this.adoptServerShape(serverCfg, true);
      }
    } catch {
      /* офлайн — работаем на локальном кеше */
    }
  }

  private migrate(cfg: Config): Config {
    const out: Config = { ...defaultConfig(Date.now()), ...cfg };
    out.presets = (out.presets ?? []).map(normalizePreset);
    const defVoices = defaultConfig(Date.now()).voices;
    out.voices = (out.voices ?? defVoices).map((v) => {
      const def = defVoices.find((d) => d.code === v.code);
      const isFree = v.code === FREE_VOICE_CODE;
      return {
        ...v,
        gender: v.gender ?? def?.gender ?? 'female',
        price: isFree ? 0 : v.price,
        premium: isFree ? false : v.premium,
      };
    });
    if (!out.effects?.some((e) => e.code === 'hearts') || out.effects.some((e) => e.code === 'shake')) {
      out.effects = defaultConfig(Date.now()).effects;
    }
    return out;
  }

  getConfig(): Config {
    const cfg = super.getConfig();
    return { ...cfg, slug: this.slug };
  }

  saveConfig(next: Config): Config {
    next.slug = this.slug;
    const saved = super.saveConfig(next);
    // серверный конфиг (KV аккаунта) — fire-and-forget, ревизия разрулит конфликты.
    // Шлём именно сохранённый (свежий) конфиг, а не старый из стора.
    void putServerConfig(saved).catch(() => {
      /* офлайн: локальная ревизия выше, syncFromServer догонит */
    });
    return saved;
  }

  /** В live нет фейковых отмен — pending завершается через минуту (LZT-статусы придут с Step 5-6). */
  tickStatuses(): void {
    let changed = false;
    const now = Date.now();
    for (const d of this.store.donations) {
      if (d.status !== 'pending') continue;
      if (now - d.ts < 60_000) continue;
      d.status = 'finished';
      changed = true;
    }
    if (changed) this.persist();
  }

  async fetchPublicConfig(slug: string): Promise<PublicConfig | null> {
    // свой slug — из локального конфига (мгновенно)
    if (slug === this.slug) return this.getPublicConfig(slug);
    // чужой (публичная страница другого стримера) — серверный публичный снапшот
    return fetchPublicViaServer(slug);
  }

  /** Тестовый донат в live — реальный инвойс появится в Step 5 (relay). */
  simulateTest(): Donation | null {
    return super.simulateTest();
  }

  ingest(e: IncomingEvent): Donation | null {
    return super.ingest(e);
  }
}

let singleton: LiveProvider | null = null;

export function getLiveProvider(): LiveProvider {
  if (!singleton) singleton = new LiveProvider();
  return singleton;
}
