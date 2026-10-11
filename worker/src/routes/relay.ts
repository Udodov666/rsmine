/** Роуты relay (план Step 5): WS для Tauri, инвойсы от зрителей, SSE для оверлея. */
import type { Env } from '../index';
import { RelayRoom } from '../relay/RelayRoom';
import { verifyJwt } from '../auth/jwt';
import { throttle } from '../lib/throttle';

export async function handleRelay(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean); // ['api','relay',slug,action]
  if (parts.length < 3) return Response.json({ error: 'not found' }, { status: 404 });
  const slug = decodeURIComponent(parts[2]);
  // slug — twitch-логин: без мусора в имени DO (иначе перебором плодят инстансы)
  if (!/^[a-z0-9-_]{1,30}$/i.test(slug)) {
    return Response.json({ error: 'bad slug' }, { status: 400 });
  }
  const action = parts[3] ?? '';

  const id = env.RELAY_ROOM.idFromName(slug);
  const stub = env.RELAY_ROOM.get(id);

  // WS-апгрейд для Tauri: пробрасываем запрос как есть (со спец. заголовками)
  if (action === 'ws') {
    return stub.fetch(new Request(`https://relay.internal/ws?${url.searchParams}`, req));
  }

  // POST /invoice {sum, comment, urlSuccess} — от зрителя.
  // Троттлинг: создание счетов — деньги, без лимита любой перебором спамит LZT.
  if (action === 'invoice' && req.method === 'POST') {
    if (!(await throttle(env.KV, req, 'invoice', 10))) {
      return Response.json({ error: 'too many requests' }, { status: 429 });
    }
    return stub.fetch(new Request('https://relay.internal/invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(await req.json().catch(() => ({}))),
    }));
  }

  // GET /events?secret= — SSE для оверлея OBS (ключ оверлея обязателен)
  if (action === 'events') {
    return stub.fetch(new Request(
      `https://relay.internal/events?slug=${encodeURIComponent(slug)}&secret=${encodeURIComponent(url.searchParams.get('secret') ?? '')}`,
    ));
  }

  // GET /status — онлайн ли программа стримера (визард «Подключение»)
  if (action === 'status') {
    return stub.fetch(new Request('https://relay.internal/status'));
  }

  // GET /donations?limit&before — реестр оплат из SQLite (JWT, только свой slug)
  if (action === 'donations' && req.method === 'GET') {
    const auth = req.headers.get('Authorization') ?? '';
    const session = auth.startsWith('Bearer ')
      ? await verifyJwt(auth.slice(7), env.SESSION_JWT_SECRET)
      : null;
    if (!session || session.slug !== slug) {
      return Response.json({ error: 'no auth' }, { status: 401 });
    }
    const limit = url.searchParams.get('limit') ?? '100';
    const before = url.searchParams.get('before') ?? '0';
    return stub.fetch(new Request(
      `https://relay.internal/history?limit=${encodeURIComponent(limit)}&before=${encodeURIComponent(before)}`,
    ));
  }

  // POST /manual {sum, username, text} — внести пропущенный донат в реестр (JWT, только свой slug)
  if (action === 'manual' && req.method === 'POST') {
    const auth = req.headers.get('Authorization') ?? '';
    const session = auth.startsWith('Bearer ')
      ? await verifyJwt(auth.slice(7), env.SESSION_JWT_SECRET)
      : null;
    if (!session || session.slug !== slug) {
      return Response.json({ error: 'no auth' }, { status: 401 });
    }
    return stub.fetch(new Request('https://relay.internal/insert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(await req.json().catch(() => ({}))),
    }));
  }

  // POST /broadcast {sum, username, text} — тестовый алерт панели в оверлей (JWT, только свой slug)
  if (action === 'broadcast' && req.method === 'POST') {
    const auth = req.headers.get('Authorization') ?? '';
    const session = auth.startsWith('Bearer ')
      ? await verifyJwt(auth.slice(7), env.SESSION_JWT_SECRET)
      : null;
    if (!session || session.slug !== slug) {
      return Response.json({ error: 'no auth' }, { status: 401 });
    }
    return stub.fetch(new Request('https://relay.internal/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(await req.json().catch(() => ({}))),
    }));
  }

  return Response.json({ error: 'not found' }, { status: 404 });
}
