import type { DataProvider } from '../../data/provider';
import type { Config, Donation, IncomingEvent, PublicConfig } from '../../data/types';
import { defaultConfig, seedDonations, FREE_VOICE_CODE } from '../../data/defaults';
import { parseLd1 } from '../../lib/ld1';
import { calcEconomy } from '../../lib/economy';
import portrait from '../../public-page/assets/banner-demo-avatar.png';
import demoMedia from '../../public-page/assets/landing-demo.webp';

/** A memory-only adapter. Never reads the app store, payment credentials or external services. */
export class DemoProvider implements DataProvider {
  readonly isMock = true;
  private config: Config;
  private donations: Donation[];
  private subscribers = new Set<() => void>();
  private sequence = 0;
  private testSum = 20;
  private testCursor = 0;
  private initial: Donation[];
  constructor() {
    const now = Date.now();
    this.config = defaultConfig(now);
    Object.assign(this.config, { slug: 'landing-demo', profileName: 'Udodov', profileAvatar: portrait,
      profileBio: 'Игры, разговоры и хорошие вечера.', goalTitle: 'Новый микрофон', goalTarget: 3000,
      goalEnabled: true, goalBoundary: now - 30 * 86400000, lztToken: '', merchantId: '' });
    this.config.activePresetId = 'p3';
    this.config.presets = this.config.presets.map(p => ({ ...p, mediaUrl: demoMedia }));
    this.donations = seedDonations(now).filter(d => d.kind === 'donate');
    this.initial = structuredClone(this.donations);
  }
  getConfig() { return structuredClone(this.config); }
  saveConfig(next: Config) { this.config = { ...structuredClone(next), lztToken: '', merchantId: '', revision: this.config.revision + 1 }; this.emit(); return this.getConfig(); }
  subscribe(cb: () => void) { this.subscribers.add(cb); return () => { this.subscribers.delete(cb); }; }
  private emit() { this.subscribers.forEach(cb => cb()); }
  listDonations() { return [...this.donations].sort((a, b) => b.ts - a.ts); }
  ingest(e: IncomingEvent): Donation | null {
    if (this.donations.some(d => d.operationId === e.operationId)) return null;
    const parsed = parseLd1(e.comment, this.config.textLimit);
    const features: Donation['features'] = [];
    const prices: Record<string, number> = {};
    const voice = this.config.voices.find(v => v.enabled && v.code === parsed?.voice);
    const effect = this.config.effects.find(v => v.enabled && v.code === parsed?.effect);
    if (voice) { features.push({ kind: 'voice', code: voice.code }); prices[voice.code] = voice.price; }
    if (effect) { features.push({ kind: 'effect', code: effect.code }); prices[effect.code] = effect.price; }
    const economy = calcEconomy({ incomingSum: e.incomingSum, minimum: this.config.minimum, features, prices });
    const d: Donation = { operationId: e.operationId, ts: Date.now(), incomingSum: e.incomingSum,
      shownSum: economy.shown, features: economy.retained, removedFeatures: economy.removed,
      text: parsed?.text || e.comment, username: e.username || 'Аноним', anonymous: parsed?.anonymous ?? false,
      status: 'finished', kind: 'donate', configRevision: this.config.revision };
    this.donations.unshift(d); this.donations = this.donations.slice(0, 40); this.emit(); return d;
  }
  receive() { return this.ingest({ operationId: `landing-${++this.sequence}`, incomingSum: 250,
    username: 'viewer_41', comment: 'LD1|v=|e=|a=0|Спасибо за стрим!' }); }
  peekTestSum() { return this.testSum; }
  simulateTest(): Donation {
    const preset = this.config.presets.find(p => p.id === this.config.activePresetId);
    const tiers = [...(preset?.mediaTiers ?? [])].sort((a,b)=>a.minSum-b.minSum);
    this.testSum = preset?.mediaMode === 'tiers' && tiers.length ? tiers[this.testCursor++ % tiers.length].minSum : 20;
    this.emit();
    return { ...this.example('test'), incomingSum: this.testSum, shownSum: this.testSum };
  }
  simulateTestWith(sum: number, text: string): Donation {
    this.testSum = Math.min(1000000, Math.max(1, Math.round(sum) || 20));
    this.emit();
    return { ...this.example('test'), incomingSum: this.testSum, shownSum: this.testSum, text: text.trim() || 'Спасибо за стрим!' };
  }
  simulateReplay(d: Donation): Donation { return { ...d, operationId: `replay-${++this.sequence}`, ts: Date.now(), kind: 'replay' }; }
  private example(kind: 'test' | 'replay'): Donation { return { operationId: `preview-${++this.sequence}`, ts: Date.now(), incomingSum: 250, shownSum: 250,
    features: [], removedFeatures: [], text: 'Спасибо за стрим!', username: 'viewer_41', anonymous: false,
    status: 'finished', kind, configRevision: this.config.revision }; }
  reset() { this.donations = structuredClone(this.initial); this.emit(); }
  simulateRandomPayment() { /* Deliberately disabled on the landing. */ }
  tickStatuses() { /* Demonstration events are already confirmed in this private memory store. */ }
  touchHeartbeat() { /* No OBS connection is claimed. */ }
  heartbeatAgeSec() { return null; }
  resetGoalBoundary() { this.config.goalBoundary = Date.now(); this.emit(); }
  getPublicConfig(_slug: string): PublicConfig {
    const c = this.config;
    return { streamerName: c.profileName, slug: c.slug, avatar: portrait, bio: c.profileBio, banned: [],
      greeting: 'Рад, что вы здесь. Спасибо за поддержку!', minimum: c.minimum, textLimit: c.textLimit,
      goal: null, voices: c.voices.filter(v => v.enabled || v.code === FREE_VOICE_CODE), effects: c.effects.filter(e => e.enabled) };
  }
  async fetchPublicConfig(slug: string) { return this.getPublicConfig(slug); }
  async demoDonate(_slug: string, p: { incomingSum: number; comment: string; username?: string }) {
    this.ingest({ operationId: `form-${++this.sequence}`, ...p });
  }
}
