/** Конфиг аккаунта (KV config:slug) + публичный снапшот для страницы донатов (план Step 4). */
import { verifyJwt } from '../auth/jwt';
import { DEFAULT_BANNED_WORDS } from '../../../src/lib/moderation';
import type { Env } from '../index';

interface PublicSnapshot {
  slug: string;
  displayName: string;
  /** алиас для страницы доната (дубль displayName — PublicConfig.streamerName) */
  streamerName: string;
  avatar: string;
  bio: string | null;
  greeting: string;
  minimum: number;
  textLimit: number;
  goal: { enabled: boolean; title: string; target: number } | null;
  voices: Array<{ code: string; name: string; price: number; premium: boolean; hint?: string }>;
  effects: Array<{ code: string; name: string; price: number; premium: boolean; hint?: string }>;
  /** свои запрещённые слова стримера (дефолтный словарь докатывает сам оверлей) */
  banned: string[];
  /** активный пресет алерта — оверлей OBS рендерит по нему (Step 9) */
  preset: Record<string, unknown> | null;
  savedAt: number;
}

/** Публичный срез пресета: только то, что нужно оверлею для рендера алерта. */
function publicPreset(cfg: Record<string, unknown>): Record<string, unknown> | null {
  const presets = (cfg.presets as Array<Record<string, unknown>> | undefined) ?? [];
  const active = presets.find((p) => p.id === cfg.activePresetId) ?? presets[0];
  if (!active) return null;
  const tiers = (active.mediaTiers as Array<Record<string, unknown>> | undefined) ?? [];
  const rawMedia = String(active.mediaUrl ?? '');
  // старый дефолт — SVG-заглушка «GIF»: в оверлее её показывать нельзя, подменяем
  // реальной гифкой из готового набора
  const mediaUrl = rawMedia.startsWith('data:image/svg+xml')
    ? 'https://nztcdn.com/files/12d9da8e-6310-42e0-bea5-85f93267d19d.webp'
    : rawMedia;
  return {
    mediaMode: String(active.mediaMode ?? 'single'),
    mediaUrl,
    mediaTiers: tiers.map((t) => ({ minSum: Number(t.minSum ?? 0), url: String(t.url ?? '') })),
    titleTemplate: String(active.titleTemplate ?? ''),
    titleColor: String(active.titleColor ?? '#ffffff'),
    textTemplate: String(active.textTemplate ?? ''),
    titleAlign: String(active.titleAlign ?? 'center'),
    fontSize: Number(active.fontSize ?? 42),
    shadow: active.shadow === true,
    radius: Number(active.radius ?? 12),
    durationSec: Number(active.durationSec ?? 6),
    appear: String(active.appear ?? 'none'),
    volume: Number(active.volume ?? 100),
    alertSound: String(active.alertSound ?? 'coin'),
  };
}

async function getSession(req: Request, env: Env) {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  return verifyJwt(token, env.SESSION_JWT_SECRET);
}

/** Полный список фильтра: встроенный словарь + свои слова стримера. */
function bannedList(cfg: Record<string, unknown>): string[] {
  const custom = Array.isArray(cfg.bannedWords)
    ? (cfg.bannedWords as unknown[]).filter((s): s is string => typeof s === 'string').slice(0, 200)
    : [];
  return [...DEFAULT_BANNED_WORDS, ...custom];
}

function snapshotFromConfig(slug: string, profile: { displayName: string; avatar: string; bio: string | null }, cfg: Record<string, unknown>): PublicSnapshot {
  const voices = (cfg.voices as Array<Record<string, unknown>> | undefined ?? [])
    .filter((v) => v.enabled === true)
    .map((v) => ({
      code: String(v.code ?? ''),
      name: String(v.name ?? ''),
      price: Number(v.price ?? 0),
      premium: v.premium === true,
      hint: typeof v.hint === 'string' ? v.hint : undefined,
    }));
  const effects = (cfg.effects as Array<Record<string, unknown>> | undefined ?? [])
    .filter((e) => e.enabled === true)
    .map((e) => ({
      code: String(e.code ?? ''),
      name: String(e.name ?? ''),
      price: Number(e.price ?? 0),
      premium: e.premium === true,
      hint: typeof e.hint === 'string' ? e.hint : undefined,
    }));
  const goalTitle = typeof cfg.goalTitle === 'string' ? cfg.goalTitle : '';
  const goalEnabled = cfg.goalEnabled === true;
  return {
    slug,
    displayName: profile.displayName,
    streamerName: profile.displayName,
    avatar: profile.avatar,
    bio: profile.bio,
    greeting: 'Спасибо большое за поддержку! Каждый донат — плюс к качеству контента ❤️',
    minimum: Number(cfg.minimum ?? 10),
    textLimit: Number(cfg.textLimit ?? 180),
    goal: goalTitle && goalEnabled ? { enabled: true, title: goalTitle, target: Number(cfg.goalTarget ?? 0) } : null,
    voices,
    effects,
    // полный список для потребителей без своего словаря (программа стримера):
    // встроенный словарь + свои слова стримера
    banned: bannedList(cfg),
    preset: publicPreset(cfg),
    savedAt: Date.now(),
  };
}

export async function handleConfig(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean); // ['api','profile','me','config']
  if (parts.length !== 4 || parts[2] !== 'me' || parts[3] !== 'config') {
    return Response.json({ error: 'not found' }, { status: 404 });
  }
  const session = await getSession(req, env);
  if (!session) return Response.json({ error: 'no auth' }, { status: 401 });
  const slug = session.slug;
  const profileRaw = await env.KV.get(`profile:twitch:${session.twitchId}`);
  if (!profileRaw) return Response.json({ error: 'profile not found' }, { status: 404 });
  const profile = JSON.parse(profileRaw) as { displayName: string; avatar: string; bio: string | null };

  if (req.method === 'GET') {
    const raw = await env.KV.get(`config:${slug}`);
    if (!raw) return Response.json({ config: null });
    return Response.json({ config: JSON.parse(raw) });
  }

  if (req.method === 'PUT') {
    let body: { config?: unknown };
    try {
      body = (await req.json()) as { config?: unknown };
    } catch {
      return Response.json({ error: 'bad json' }, { status: 400 });
    }
    if (!body.config || typeof body.config !== 'object') {
      return Response.json({ error: 'missing config' }, { status: 400 });
    }
    const cfg = body.config as Record<string, unknown>;
    await env.KV.put(`config:${slug}`, JSON.stringify(cfg));
    await env.KV.put(`public:slug:${slug}`, JSON.stringify(snapshotFromConfig(slug, profile, cfg)));
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'method not allowed' }, { status: 405 });
}

/** GET /api/goal/:slug — публичные данные виджета цели (без auth: цель видна на стриме).
 *  Прогресс — честная серверная сумма реестра от goalBoundary. */
export async function handleGoal(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean); // ['api','goal',slug]
  if (req.method !== 'GET' || parts.length !== 3) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }
  const slug = decodeURIComponent(parts[2]);
  const profileRaw = await env.KV.get(`profile:slug:${slug}`);
  if (!profileRaw) return Response.json({ error: 'not found' }, { status: 404 });
  const cfgRaw = await env.KV.get(`config:${slug}`);
  if (!cfgRaw) return Response.json({ slug, goal: null });
  let cfg: Record<string, unknown>;
  try {
    cfg = JSON.parse(cfgRaw) as Record<string, unknown>;
  } catch {
    return Response.json({ slug, goal: null });
  }
  const title = typeof cfg.goalTitle === 'string' ? cfg.goalTitle.trim() : '';
  const target = Number(cfg.goalTarget ?? 0);
  if (!title || !Number.isFinite(target) || target <= 0) {
    return Response.json({ slug, goal: null });
  }
  const boundary = Number(cfg.goalBoundary ?? 0) || 0;
  let progress = 0;
  try {
    const id = env.RELAY_ROOM.idFromName(slug);
    const stub = env.RELAY_ROOM.get(id);
    const res = await stub.fetch(
      new Request(`https://relay.internal/sum?since=${boundary}`),
    );
    const data = (await res.json()) as { total?: unknown };
    progress = Number(data.total ?? 0) || 0;
  } catch {
    /* реестр недоступен — отдадим цель с нулём */
  }
  return Response.json({
    slug,
    goal: {
      enabled: cfg.goalEnabled === true,
      title,
      target,
      progress,
      accent: typeof cfg.goalBarAccent === 'string' ? cfg.goalBarAccent : '#f7941d',
      barText: typeof cfg.goalBarText === 'string' && cfg.goalBarText
        ? cfg.goalBarText
        : '{собрано} / {цель} RUB ({процент}%)',
    },
  });
}

/** GET /api/public/:slug — публичный снапшот для страницы донатов (без auth). */
export async function handlePublic(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean); // ['api','public',slug]
  if (req.method !== 'GET' || parts.length !== 3) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }
  const slug = decodeURIComponent(parts[2]);
  const profileRaw = await env.KV.get(`profile:slug:${slug}`);
  if (!profileRaw) return Response.json({ error: 'not found' }, { status: 404 });
  const profile = JSON.parse(profileRaw) as { displayName: string; avatar: string; bio: string | null };
  const pubRaw = await env.KV.get(`public:slug:${slug}`);
  const publicConfig = pubRaw ? (JSON.parse(pubRaw) as PublicSnapshot) : null;
  if (publicConfig && !publicConfig.preset) {
    // снапшот старого формата: пресет досчитываем из живого конфига аккаунта
    const cfgRaw = await env.KV.get(`config:${slug}`);
    if (cfgRaw) {
      try {
        publicConfig.preset = publicPreset(JSON.parse(cfgRaw) as Record<string, unknown>);
      } catch { /* битый конфиг — отдадим как есть */ }
    }
  }
  // Всегда пересчитываем banned из живого конфига — DEFAULT_BANNED_WORDS + свои слова стримера.
  // Это гарантирует, что сленг/мат будет маскироваться корректно, независимо от состояния KV-снапшота.
  try {
    const cfgRaw = await env.KV.get(`config:${slug}`);
    if (cfgRaw) publicConfig.banned = bannedList(JSON.parse(cfgRaw) as Record<string, unknown>);
  } catch { /* битый конфиг — оставляем текущее значение */ }
  return Response.json({ profile, publicConfig });
}
