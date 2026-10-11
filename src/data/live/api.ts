/** API-хелперы к воркеру (план Step 3-4). JWT — из localStorage. */
import type { PublicConfig } from '../types';
import { DEFAULT_GREETING } from '../defaults';
import { apiBase, authHeaders } from './auth';

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiBase() + path, init);
  return (await res.json()) as T;
}

/** Конфиг аккаунта (KV config:slug) — требует JWT. */
export async function getConfig(): Promise<{ config: unknown } | null> {
  try {
    return await jsonFetch('/api/profile/me/config', { headers: authHeaders() });
  } catch {
    return null;
  }
}

export async function putConfig(config: unknown): Promise<{ config: unknown } | null> {
  try {
    return await jsonFetch('/api/profile/me/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ config }),
    });
  } catch {
    return null;
  }
}

/** Профиль: свой (JWT) и публичный. */
export async function getMe(): Promise<Record<string, unknown> | null> {
  try {
    return await jsonFetch('/api/profile/me', { headers: authHeaders() });
  } catch {
    return null;
  }
}

export async function updateMe(patch: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  try {
    return await jsonFetch('/api/profile/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(patch),
    });
  } catch {
    return null;
  }
}

export interface ServerDonation {
  invoice_id: number;
  sum: number;
  username: string;
  text: string;
  ts: number;
}

/** Реестр оплат стримера (SQLite релея). Требует JWT; свой slug берётся из сессии. */
export async function fetchDonations(slug: string, limit = 200): Promise<ServerDonation[]> {
  try {
    const res = await fetch(
      `${apiBase()}/api/relay/${encodeURIComponent(slug)}/donations?limit=${limit}`,
      { headers: authHeaders() },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { donations?: ServerDonation[] };
    return Array.isArray(data.donations) ? data.donations : [];
  } catch {
    return [];
  }
}

/** Внести пропущенный донат в серверный реестр (JWT, свой slug). */
export async function addManualDonation(
  slug: string,
  args: { sum: number; username: string; text: string },
): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase()}/api/relay/${encodeURIComponent(slug)}/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(args),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Ключ Cartesia стримера (Step 10): пишется на сервер, назад не читается. */
export async function putTtsKey(key: string): Promise<{ ok?: boolean; ttsKeySet?: boolean } | null> {
  try {
    return await jsonFetch('/api/profile/me/tts-key', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ key }),
    });
  } catch {
    return null;
  }
}

export async function getPublicProfile(slug: string): Promise<Record<string, unknown> | null> {
  try {
    return await jsonFetch(`/api/public/${encodeURIComponent(slug)}`);
  } catch {
    return null;
  }
}

/** Публичный конфиг стримера с сервера (для страницы донатов зрителя).
 *  Недостающие поля добираются из профиля Twitch и дефолтов:
 *  ник/ава — всегда с Twitch, био/приветствие — дефолтные, если стример не задал. */
export async function fetchPublicViaServer(slug: string): Promise<PublicConfig | null> {
  try {
    const data = (await getPublicProfile(slug)) as {
      profile?: { slug: string; displayName: string; avatar: string; bio: string | null };
      publicConfig?: (Partial<PublicConfig> & { displayName?: string }) | null;
    } | null;
    if (!data?.profile) return null;
    const pc = data.publicConfig;
    if (pc) {
      return {
        ...pc,
        streamerName: pc.streamerName || data.profile.displayName,
        slug: data.profile.slug,
        avatar: pc.avatar || data.profile.avatar,
        bio: (pc.bio ?? '').trim(),
        greeting: (pc.greeting ?? '').trim() || DEFAULT_GREETING,
        minimum: pc.minimum ?? 10,
        textLimit: pc.textLimit ?? 180,
        goal: pc.goal ?? null,
        voices: pc.voices ?? [],
        effects: pc.effects ?? [],
        banned: pc.banned ?? [],
      };
    }
    return {
      streamerName: data.profile.displayName,
      slug: data.profile.slug,
      avatar: data.profile.avatar,
      bio: (data.profile.bio ?? '').trim(),
      greeting: DEFAULT_GREETING,
      minimum: 10,
      textLimit: 180,
      goal: null,
      voices: [],
      effects: [],
      banned: [],
    };
  } catch {
    return null;
  }
}
