/** Верификация Twitch implicit-токена через Helix (план Step 2), с кешем на 5 минут. */

export interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
}

export async function verifyTwitchToken(token: string, env: { TWITCH_CLIENT_ID: string }): Promise<TwitchUser | null> {
  const cache = (caches as unknown as { default: Cache }).default;
  const tokenHash = await sha256Hex(token);
  const cacheKey = new Request(`https://cache.rsmine.internal/twitchuser:${tokenHash}`);
  const cached = await cache.match(cacheKey);
  if (cached) {
    try {
      const user = (await cached.json()) as TwitchUser;
      if (user && user.id) return user;
    } catch {
      /* битый кеш — идём в Twitch */
    }
  }

  const res = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Client-Id': env.TWITCH_CLIENT_ID,
    },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: TwitchUser[] };
  const user = json.data?.[0];
  if (!user || !user.id) return null;

  await cache.put(cacheKey, new Response(JSON.stringify(user), {
    headers: { 'Cache-Control': 'max-age=300' },
  }));
  return user;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
