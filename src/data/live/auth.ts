/** Хелперы Twitch-сессии (план Step 2). JWT и профиль — только в localStorage браузера стримера. */

const JWT_KEY = 'rsmine.jwt';
const TWITCH_KEY = 'rsmine.twitch';

export interface TwitchSession {
  twitchId: string;
  displayName: string;
  avatar: string;
  slug: string;
}

export function getJwt(): string | null {
  return localStorage.getItem(JWT_KEY);
}

export function getTwitch(): TwitchSession | null {
  const raw = localStorage.getItem(TWITCH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TwitchSession;
  } catch {
    return null;
  }
}

export function isAuthed(): boolean {
  return !!getJwt() && !!getTwitch();
}

export function storeSession(jwt: string, session: TwitchSession): void {
  localStorage.setItem(JWT_KEY, jwt);
  localStorage.setItem(TWITCH_KEY, JSON.stringify(session));
}

export function logout(): void {
  localStorage.removeItem(JWT_KEY);
  localStorage.removeItem(TWITCH_KEY);
}

export function authHeaders(): Record<string, string> {
  const jwt = getJwt();
  return jwt ? { Authorization: `Bearer ${jwt}` } : {};
}

/** Базовый URL API: прод (workers.dev/api.rsmine.ru) или тот же origin. */
export function apiBase(): string {
  return (import.meta.env.VITE_API_BASE as string | undefined) ?? '';
}

/** Ссылка на Twitch authorize (implicit flow, токен приходит в #fragment).
 *  null — если VITE_TWITCH_CLIENT_ID не настроен. */
export function twitchAuthorizeUrl(): string | null {
  const clientId = import.meta.env.VITE_TWITCH_CLIENT_ID as string | undefined;
  if (!clientId) return null;
  const redirect = encodeURIComponent(`${window.location.origin}/auth/callback`);
  return (
    'https://id.twitch.tv/oauth2/authorize' +
    `?client_id=${clientId}&redirect_uri=${redirect}` +
    '&response_type=token&scope=user%3Aread%3Aemail'
  );
}
