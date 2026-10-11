/** Профили: публичный GET по slug + приватные GET/PUT «me» (план Step 3, §11). */
import { verifyJwt } from '../auth/jwt';
import { putTtsKey, deleteTtsKey } from './tts';
import type { Env } from '../index';

export interface Profile {
  slug: string;
  twitchId: string;
  displayName: string;
  avatar: string;
  createdAt: number;
  accentColor?: string;
  bio?: string;
  merchantId?: string;
}

const PROFILE_FIELDS_PUBLIC = (p: Profile) => ({
  slug: p.slug,
  displayName: p.displayName,
  avatar: p.avatar,
  accentColor: p.accentColor ?? null,
  bio: p.bio ?? null,
});

/** Достаёт профиль из KV по twitchId, досыпая дефолты для старых записей. */
export async function getProfileByTwitchId(env: Env, twitchId: string): Promise<Profile | null> {
  const raw = await env.KV.get(`profile:twitch:${twitchId}`);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Profile;
    return { accentColor: '', bio: '', merchantId: '', ...p };
  } catch {
    return null;
  }
}

export async function getProfileBySlug(env: Env, slug: string): Promise<Profile | null> {
  const raw = await env.KV.get(`profile:slug:${slug}`);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Profile;
    return { accentColor: '', bio: '', merchantId: '', ...p };
  } catch {
    return null;
  }
}

async function putProfile(env: Env, p: Profile): Promise<void> {
  await env.KV.put(`profile:twitch:${p.twitchId}`, JSON.stringify(p));
  await env.KV.put(`profile:slug:${p.slug}`, JSON.stringify(p));
}

export async function handleProfile(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean); // ['api','profile',...]

  // GET /api/profile/:slug — публичный
  if (req.method === 'GET' && parts.length === 3) {
    const slug = decodeURIComponent(parts[2]);
    if (slug === 'me') {
      return Response.json({ error: 'use /api/profile/me with auth' }, { status: 400 });
    }
    const p = await getProfileBySlug(env, slug);
    if (!p) return Response.json({ error: 'not found' }, { status: 404 });
    return Response.json(PROFILE_FIELDS_PUBLIC(p));
  }

  // /api/profile/me — требует JWT
  const session = await verifyJwtFromRequest(req, env);
  if (!session) {
    return Response.json({ error: 'no auth' }, { status: 401 });
  }
  const profile = await getProfileByTwitchId(env, session.twitchId);
  if (!profile) {
    return Response.json({ error: 'profile not found' }, { status: 404 });
  }

  if (req.method === 'GET' && parts.length === 3 && parts[2] === 'me') {
    return Response.json({
      ...profile,
      lztConfigured: !!profile.merchantId,
      appLinked: false,
      ttsKeySet: !!(await env.KV.get(`tts:slug:${profile.slug}`)),
    });
  }

  // POST /api/profile/me/app-secret — генерирует секрет связки Tauri (план Step 7),
  // в KV кладётся только SHA-256 хеш; секрет показывается один раз.
  if (req.method === 'POST' && parts.length === 4 && parts[2] === 'me' && parts[3] === 'app-secret') {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const appSecret = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(appSecret));
    const hashHex = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
    await env.KV.put(`app:slug:${profile.slug}`, hashHex);
    return Response.json({ appSecret });
  }

  // PUT /api/profile/me/tts-key {key} — ключ Cartesia стримера (Step 10).
  // Хранится в KV `tts:slug:<slug>`, назад никогда не возвращается (только флаг ttsKeySet).
  // Пустой key — удалить ключ.
  if (req.method === 'PUT' && parts.length === 4 && parts[2] === 'me' && parts[3] === 'tts-key') {
    let body: { key?: unknown } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return Response.json({ error: 'bad json' }, { status: 400 });
    }
    const key = typeof body.key === 'string' ? body.key.trim() : '';
    if (key.length > 200) {
      return Response.json({ error: 'key too long' }, { status: 400 });
    }
    if (!key) {
      await deleteTtsKey(env, profile.slug);
    } else {
      await putTtsKey(env, profile.slug, key);
    }
    return Response.json({ ok: true, ttsKeySet: !!key });
  }

  if (req.method === 'PUT' && parts.length === 3 && parts[2] === 'me') {
    let patch: Record<string, unknown> = {};
    try {
      patch = (await req.json()) as Record<string, unknown>;
    } catch {
      return Response.json({ error: 'bad json' }, { status: 400 });
    }
    // slug менять нельзя (отдельный флоу с подтверждением — позже)
    if (typeof patch.displayName === 'string') profile.displayName = patch.displayName.slice(0, 64);
    if (typeof patch.accentColor === 'string') profile.accentColor = patch.accentColor.slice(0, 16);
    if (typeof patch.bio === 'string') profile.bio = patch.bio.slice(0, 280);
    if (typeof patch.merchantId === 'string') profile.merchantId = patch.merchantId.slice(0, 64);
    await putProfile(env, profile);
    return Response.json(profile);
  }

  return Response.json({ error: 'not found' }, { status: 404 });
}

async function verifyJwtFromRequest(req: Request, env: Env) {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  return verifyJwt(token, env.SESSION_JWT_SECRET);
}
