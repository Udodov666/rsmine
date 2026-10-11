/** POST /api/auth/twitch — обмен Twitch implicit-токена на session JWT (план Step 2, §11). */
import { signJwt } from '../auth/jwt';
import { verifyTwitchToken } from '../auth/twitch';
import type { Env } from '../index';

interface Profile {
  slug: string;
  twitchId: string;
  displayName: string;
  avatar: string;
  createdAt: number;
}

export async function handleAuth(req: Request, env: Env): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ error: 'method not allowed' }, { status: 405 });
  }
  let body: { twitchToken?: unknown };
  try {
    body = (await req.json()) as { twitchToken?: unknown };
  } catch {
    return Response.json({ error: 'bad json' }, { status: 400 });
  }
  const twitchToken = body.twitchToken;
  if (typeof twitchToken !== 'string' || !twitchToken) {
    return Response.json({ error: 'missing twitchToken' }, { status: 400 });
  }

  const user = await verifyTwitchToken(twitchToken, env);
  if (!user) {
    return Response.json({ error: 'invalid twitch token' }, { status: 401 });
  }

  // Профиль: login на Twitch уникален → берём его как slug (коллизий между юзерами нет)
  const key = `profile:twitch:${user.id}`;
  const existingRaw = await env.KV.get(key);
  let profile: Profile;
  let isNew = false;
  if (existingRaw) {
    profile = JSON.parse(existingRaw) as Profile;
  } else {
    isNew = true;
    profile = {
      slug: user.login,
      twitchId: user.id,
      displayName: user.display_name,
      avatar: user.profile_image_url,
      createdAt: Date.now(),
    };
    await env.KV.put(key, JSON.stringify(profile));
    await env.KV.put(`profile:slug:${profile.slug}`, JSON.stringify(profile));
  }

  const jwt = await signJwt(
    { twitchId: profile.twitchId, slug: profile.slug, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 },
    env.SESSION_JWT_SECRET,
  );

  return Response.json({
    jwt,
    slug: profile.slug,
    twitchId: profile.twitchId,
    displayName: profile.displayName,
    avatar: profile.avatar,
    isNew,
  });
}
