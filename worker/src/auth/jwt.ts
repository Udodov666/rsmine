/** Session JWT (HS256, Web Crypto — план Step 2). Payload: {twitchId, slug, iat, exp}. */

const enc = new TextEncoder();

function b64urlFromBytes(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlJson(obj: unknown): string {
  return b64urlFromBytes(enc.encode(JSON.stringify(obj)));
}

function b64urlDecodeJson<T>(part: string): T {
  const pad = part.length % 4 === 0 ? '' : '='.repeat(4 - (part.length % 4));
  const s = atob(part.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return JSON.parse(s) as T;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

export async function signJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const body = b64urlJson(payload);
  const data = `${header}.${body}`;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return `${data}.${b64urlFromBytes(sig)}`;
}

export interface SessionPayload {
  twitchId: string;
  slug: string;
  iat: number;
  exp: number;
}

export async function verifyJwt(token: string, secret: string): Promise<SessionPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const key = await hmacKey(secret);
  const expected = await crypto.subtle.sign('HMAC', key, enc.encode(`${header}.${body}`));
  const expectedStr = b64urlFromBytes(expected);
  // сравнение посимвольно, чтобы не светить таймингом
  if (sig.length !== expectedStr.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expectedStr.charCodeAt(i);
  if (diff !== 0) return null;
  let payload: SessionPayload;
  try {
    payload = b64urlDecodeJson<SessionPayload>(body);
  } catch {
    return null;
  }
  if (!payload.twitchId || !payload.slug) return null;
  if (typeof payload.exp === 'number' && payload.exp < Date.now() / 1000) return null;
  return payload;
}
