/**
 * TTS-прокси (Step 10): ключ Cartesia стримера живёт в KV `tts:slug:<slug>`,
 * браузер (оверлей/превью/демо) его никогда не видит — шлёт текст на наш
 * воркер, воркер подставляет ключ и стримит WAV обратно.
 * Ключ записывается двумя путями: PUT /api/profile/me/tts-key (JWT, панель)
 * и WS-сообщение tts_key от программы стримера (RelayRoom).
 */
import type { Env } from '../index';
import { verifyJwt } from '../auth/jwt';
import { throttle } from '../lib/throttle';

const CARTESIA_VERSION = '2024-06-10';
const CARTESIA_TTS_URL = 'https://api.cartesia.ai/tts/bytes';

export async function getTtsKey(env: Env, slug: string): Promise<string | null> {
  const raw = await env.KV.get(`tts:slug:${slug}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { key?: string };
    return parsed.key ?? null;
  } catch {
    return null;
  }
}

export async function putTtsKey(env: Env, slug: string, key: string): Promise<void> {
  await env.KV.put(`tts:slug:${slug}`, JSON.stringify({ key, updatedAt: Date.now() }));
}

export async function deleteTtsKey(env: Env, slug: string): Promise<void> {
  await env.KV.delete(`tts:slug:${slug}`);
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Доступ к TTS стримера: JWT панели (свой slug) или ключ оверлея из ссылки. */
async function authorized(req: Request, env: Env, slug: string): Promise<boolean> {
  const key = req.headers.get('X-Overlay-Key') ?? '';
  if (key) {
    const storedHash = await env.KV.get(`app:slug:${slug}`);
    return !!storedHash && storedHash === (await sha256Hex(key));
  }
  const auth = req.headers.get('Authorization') ?? '';
  if (auth.startsWith('Bearer ')) {
    try {
      const session = await verifyJwt(auth.slice(7), env.SESSION_JWT_SECRET);
      return !!session && session.slug === slug;
    } catch {
      return false;
    }
  }
  return false;
}

/** POST /api/tts/:slug {transcript, voiceId, emotion?, speed?} → audio/wav. */
export async function handleTts(req: Request, env: Env): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ error: 'method not allowed' }, { status: 405 });
  }
  const parts = new URL(req.url).pathname.split('/').filter(Boolean); // ['api','tts',slug]
  if (parts.length !== 3) return Response.json({ error: 'not found' }, { status: 404 });
  const slug = decodeURIComponent(parts[2]);

  if (!(await authorized(req, env, slug))) {
    console.log(`[tts] denied slug=${slug}`);
    return Response.json({ error: 'no auth' }, { status: 401 });
  }

  // Троттлинг: чужой с утёкшим ключом оверлея иначе жёг бы баланс Cartesia.
  if (!(await throttle(env.KV, req, 'tts', 30))) {
    return Response.json({ error: 'too many requests' }, { status: 429 });
  }

  const apiKey = await getTtsKey(env, slug);
  if (!apiKey) {
    console.log(`[tts] no key slug=${slug}`);
    return Response.json({ error: 'tts_key_not_set' }, { status: 409 });
  }

  let body: { transcript?: unknown; voiceId?: unknown; emotion?: unknown; speed?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: 'bad json' }, { status: 400 });
  }
  const transcript = typeof body.transcript === 'string' ? body.transcript.slice(0, 1000) : '';
  const voiceId = typeof body.voiceId === 'string' ? body.voiceId : '';
  if (!transcript.trim() || !voiceId) {
    return Response.json({ error: 'transcript and voiceId required' }, { status: 400 });
  }

  const extra: Record<string, unknown> = {};
  if (typeof body.emotion === 'string' && body.emotion) extra.emotion = body.emotion;
  if (typeof body.speed === 'number' && body.speed > 0) extra.speed = body.speed;

  let res: Response;
  try {
    res = await fetch(CARTESIA_TTS_URL, {
      method: 'POST',
      headers: {
        'Cartesia-Version': CARTESIA_VERSION,
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_id: 'sonic-3.6',
        transcript,
        voice: { mode: 'id', id: voiceId },
        language: 'ru',
        output_format: { container: 'wav', encoding: 'pcm_s16le', sample_rate: 24000 },
        ...extra,
      }),
    });
  } catch {
    return Response.json({ error: 'cartesia unreachable' }, { status: 502 });
  }

  if (!res.ok) {
    // ошибку Cartesia отдаём как есть (текст), статус сохраняем — клиент решает про ретрай/фолбэк
    console.log(`[tts] cartesia ${res.status} slug=${slug} voice=${voiceId}`);
    return new Response(res.body, { status: res.status, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response(res.body, {
    status: 200,
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'audio/wav',
      'Cache-Control': 'no-store',
    },
  });
}
