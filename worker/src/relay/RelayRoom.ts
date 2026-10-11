/**
 * RelayRoom (план Step 5): Durable Object на каждый slug.
 * Держит WebSocket стримерской программы (Tauri, hibernation API),
 * форвардит запросы инвойсов от зрителей и ждёт ответ с тем же requestId,
 * рассылает алерты подписчикам SSE (оверлей OBS).
 */
import type { Env } from '../index';
import { putTtsKey, deleteTtsKey } from '../routes/tts';

interface PendingInvoice {
  resolve: (res: Response) => void;
}

const INVOICE_TIMEOUT_MS = 15_000;

async function sha256Hex(input: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class RelayRoom {
  private state: DurableObjectState;
  private env: Env;
  /** запросы, ждущие ответа от Tauri */
  private pending = new Map<string, PendingInvoice>();
  /** версия программы стримера (из ping; видно в статусе панели) */
  private progVersion = '';
  /** SSE-подписчики (оверлей OBS) */
  private sseClients = new Set<{ enqueue(data: string): void; close(): void }>();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/ws') return this.handleWs(req);
    if (url.pathname === '/invoice') return this.handleInvoice(req);
    if (url.pathname === '/events') return this.handleEvents(req);
    if (url.pathname === '/history') return this.handleHistory(url);
    if (url.pathname === '/sum') return this.handleSum(url);
    if (url.pathname === '/insert') return this.handleInsert(req);
    if (url.pathname === '/status') {
      // счётчик реестра — диагностика: видно, доезжают ли оплаты до БД
      let donations: number | null = null;
      try {
        const row = this.donationsDb()
          .exec('SELECT COUNT(*) AS cnt FROM donations')
          .toArray()[0] as { cnt: number } | undefined;
        donations = Number(row?.cnt ?? 0);
      } catch (e) {
        console.log(`[relay] registry unreadable: ${e instanceof Error ? e.message : e}`);
      }
      return Response.json({
        online: this.state.getWebSockets().length > 0,
        version: this.progVersion || null,
        donations,
      });
    }
    if (url.pathname === '/broadcast') {
      // тестовый алерт панели: та же форма события, что и от программы
      let body: { sum?: unknown; username?: unknown; text?: unknown } = {};
      try { body = (await req.json()) as typeof body; } catch { /* пусто */ }
      const sum = Number(body.sum);
      if (!Number.isFinite(sum) || sum <= 0) {
        return Response.json({ error: 'bad sum' }, { status: 400 });
      }
      this.broadcastSse(JSON.stringify({
        type: 'donation',
        sum,
        username: String(body.username ?? 'Тест'),
        text: String(body.text ?? ''),
        ts: Date.now(),
      }));
      return Response.json({ ok: true });
    }
    return new Response('not found', { status: 404 });
  }

  /** GET /ws?slug=&secret= — апгрейд Tauri-программы. */
  private async handleWs(req: Request): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket upgrade', { status: 426 });
    }
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug') ?? '';
    const secret = url.searchParams.get('secret') ?? '';
    if (!slug || !secret) return new Response('missing credentials', { status: 401 });
    const storedHash = await this.env.KV.get(`app:slug:${slug}`);
    if (!storedHash || storedHash !== (await sha256Hex(secret))) {
      return new Response('invalid secret', { status: 401 });
    }
    const pair = new WebSocketPair();
    // hibernation API: соединение переживает eviction, тег = slug
    this.state.acceptWebSocket(pair[1], [slug]);
    this.broadcastSse(JSON.stringify({ type: 'streamer_online' }));
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  /** POST /invoice {sum, comment, urlSuccess} — от зрителя. Ждёт ответ Tauri ≤15 сек. */
  private async handleInvoice(req: Request): Promise<Response> {
    let body: { sum?: unknown; comment?: unknown; urlSuccess?: unknown };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return Response.json({ error: 'bad json' }, { status: 400 });
    }
    const sum = Number(body.sum);
    const comment = typeof body.comment === 'string' ? body.comment : '';
    const urlSuccess = typeof body.urlSuccess === 'string' ? body.urlSuccess : '';
    if (!Number.isFinite(sum) || sum <= 0) {
      return Response.json({ error: 'bad sum' }, { status: 400 });
    }

    const sockets = this.state.getWebSockets();
    if (sockets.length === 0) {
      return Response.json({ error: 'streamer offline' }, { status: 503 });
    }

    const requestId = `req_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const promise = new Promise<Response>((resolve) => {
      this.pending.set(requestId, { resolve });
      setTimeout(() => {
        if (this.pending.delete(requestId)) {
          resolve(Response.json({ error: 'streamer not responding' }, { status: 504 }));
        }
      }, INVOICE_TIMEOUT_MS);
    });

    sockets[0].send(JSON.stringify({
      type: 'create_invoice',
      requestId,
      sum,
      comment,
      urlSuccess,
    }));

    return promise;
  }

  /** GET /events?slug=&secret= — SSE-поток алертов для оверлея (ключ обязателен). */
  private async handleEvents(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug') ?? '';
    const secret = url.searchParams.get('secret') ?? '';
    if (!slug || !secret) {
      return Response.json({ error: 'overlay key required' }, { status: 401 });
    }
    const storedHash = await this.env.KV.get(`app:slug:${slug}`);
    if (!storedHash || storedHash !== (await sha256Hex(secret))) {
      return Response.json({ error: 'invalid overlay key' }, { status: 401 });
    }
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start: (controller) => {
        const client = {
          enqueue: (data: string) => {
            try {
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            } catch {
              this.sseClients.delete(client);
            }
          },
          close: () => {
            try {
              controller.close();
            } catch {
              /* уже закрыт */
            }
            this.sseClients.delete(client);
          },
        };
        this.sseClients.add(client);
        client.enqueue('{"type":"connected"}');
      },
      cancel: () => {
        /* закрытые клиенты вычищаются в enqueue/close */
      },
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  /** Сообщения от Tauri (hibernation API). */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(message) as Record<string, unknown>;
    } catch {
      return;
    }
    const type = msg.type;
    // только тип — без содержимого (там бывают секреты/ключи)
    console.log(`[relay] ws <- ${String(type)}`);

    // журнал для вкладки «Сообщения» в программе (соединение уже проверено секретом)
    if (type === 'get_history') {
      const limit = Math.min(200, Math.max(1, Number(msg.limit) || 50));
      try {
        const rows = this.donationsDb().exec(
          'SELECT invoice_id, sum, username, text, ts FROM donations ORDER BY ts DESC LIMIT ?',
          limit,
        ).toArray();
        ws.send(JSON.stringify({ type: 'history', donations: rows }));
      } catch {
        ws.send(JSON.stringify({ type: 'history', donations: [] }));
      }
      return;
    }

    if (type === 'ping') {
      if (typeof msg.version === 'string' && msg.version) this.progVersion = msg.version.slice(0, 16);
      ws.send(JSON.stringify({ type: 'pong', ts: msg.ts }));
      // keepalive SSE: комментарий не создаёт событий, но держит поток живым
      this.broadcastSse(': ping');
      return;
    }

    if (type === 'invoice_ok' || type === 'invoice_error') {
      const requestId = String(msg.requestId ?? '');
      const pending = this.pending.get(requestId);
      if (!pending) return;
      this.pending.delete(requestId);
      if (type === 'invoice_ok') {
        pending.resolve(Response.json({
          payUrl: String(msg.payUrl ?? ''),
          invoiceId: Number(msg.invoiceId ?? 0),
        }));
      } else {
        pending.resolve(Response.json(
          { error: String(msg.error ?? 'invoice error') },
          { status: 502 },
        ));
      }
      return;
    }

    if (type === 'donation_alert') {
      // алерт для оверлея: программа после успешной оплаты (или вручную).
      // Старая форма без invoiceId — только трансляция, в реестр не пишем
      // (дедуп невозможен; новая программа шлёт donation_paid).
      this.broadcastSse(JSON.stringify({
        type: 'donation',
        sum: msg.sum,
        username: msg.username,
        text: msg.text,
        ts: Date.now(),
      }));
      return;
    }

    if (type === 'donation_paid') {
      // оплата зафиксирована программой: пишем в SQLite-реестр (дедуп
      // по invoiceId) и транслируем алерт в оверлей тем же событием.
      const sum = Number(msg.sum);
      const invoiceId = Number(msg.invoiceId);
      const username = typeof msg.username === 'string' && msg.username ? msg.username : 'зритель';
      const text = typeof msg.text === 'string' ? msg.text : '';
      const ts = Date.now();
      if (Number.isFinite(sum) && sum > 0) {
        if (Number.isFinite(invoiceId) && invoiceId > 0) {
          try {
            const cur = this.donationsDb().exec(
              'INSERT OR IGNORE INTO donations(invoice_id, sum, username, text, ts) VALUES(?, ?, ?, ?, ?)',
              invoiceId, sum, username.slice(0, 64), text.slice(0, 500), ts,
            );
            console.log(`[relay] donation_paid invoice=${invoiceId} sum=${sum} written=${cur.rowsWritten}`);
          } catch (e) {
            console.log(`[relay] donation_paid invoice=${invoiceId} DB FAIL: ${e instanceof Error ? e.message : e}`);
          }
        } else {
          console.log('[relay] donation_paid without invoiceId — broadcast only, no registry write');
        }
        this.broadcastSse(JSON.stringify({ type: 'donation', sum, username, text, ts }));
      }
      return;
    }

    // ключ Cartesia от программы стримера (Step 10): кладём в KV tts:slug:<slug>.
    // Пустой key — удалить сохранённый.
    if (type === 'tts_key') {
      const [slug] = this.state.getTags(ws);
      if (!slug) return;
      const key = typeof msg.key === 'string' ? msg.key.trim().slice(0, 200) : '';
      if (key) await putTtsKey(this.env, slug, key);
      else await deleteTtsKey(this.env, slug);
      ws.send(JSON.stringify({ type: 'tts_key_ok', set: !!key }));
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    // соединение закрыто: все висящие инвойсы — ошибка «оффлайн»
    this.broadcastSse(JSON.stringify({ type: 'streamer_offline' }));
    for (const [requestId, pending] of this.pending) {
      this.pending.delete(requestId);
      pending.resolve(Response.json({ error: 'streamer offline' }, { status: 503 }));
    }
  }

  /** SQLite-реестр оплат (Durable Object живёт один на slug — гонок записи нет). */
  private donationsDb(): SqlStorage {
    const db = this.state.storage.sql;
    db.exec(
      'CREATE TABLE IF NOT EXISTS donations(' +
        'invoice_id INTEGER PRIMARY KEY, sum REAL NOT NULL, ' +
        'username TEXT NOT NULL DEFAULT \'зритель\', text TEXT NOT NULL DEFAULT \'\', ' +
        'ts INTEGER NOT NULL)',
    );
    db.exec('CREATE INDEX IF NOT EXISTS idx_don_ts ON donations(ts DESC)');
    return db;
  }

  /** GET /history?limit=&before= — последние оплаты (новейшие первые). */
  private async handleHistory(url: URL): Promise<Response> {
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? '100') || 100));
    const before = Number(url.searchParams.get('before') ?? '0') || 0;
    try {
      const db = this.donationsDb();
      const cursor = before > 0
        ? db.exec(
          'SELECT invoice_id, sum, username, text, ts FROM donations WHERE ts < ? ORDER BY ts DESC LIMIT ?',
          before, limit,
        )
        : db.exec(
          'SELECT invoice_id, sum, username, text, ts FROM donations ORDER BY ts DESC LIMIT ?',
          limit,
        );
      return Response.json({ donations: cursor.toArray() });
    } catch (e) {
      console.log(`[relay] history FAIL: ${e instanceof Error ? e.message : e}`);
      return Response.json({ donations: [] });
    }
  }

  /** GET /sum?since= — прогресс цели: сумма и число оплат от метки. */
  private async handleSum(url: URL): Promise<Response> {
    const since = Number(url.searchParams.get('since') ?? '0') || 0;
    try {
      const db = this.donationsDb();
      const row = db
        .exec(
          'SELECT COALESCE(SUM(sum), 0) AS total, COUNT(*) AS cnt FROM donations WHERE ts >= ?',
          since,
        )
        .toArray()[0] as { total: number; cnt: number } | undefined;
      return Response.json({ total: Number(row?.total ?? 0), count: Number(row?.cnt ?? 0) });
    } catch (e) {
      console.log(`[relay] sum FAIL: ${e instanceof Error ? e.message : e}`);
      return Response.json({ total: 0, count: 0 });
    }
  }

  /** POST /insert {sum, username, text} — ручное внесение пропущенного
   *  доната из панели (JWT проверен на роуте). invoice_id отрицательный от
   *  метки времени — с реальными счетами LZT не пересекается. */
  private async handleInsert(req: Request): Promise<Response> {
    let body: { sum?: unknown; username?: unknown; text?: unknown };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return Response.json({ error: 'bad json' }, { status: 400 });
    }
    const sum = Number(body.sum);
    if (!Number.isFinite(sum) || sum <= 0 || sum > 10000000) {
      return Response.json({ error: 'bad sum' }, { status: 400 });
    }
    const username = typeof body.username === 'string' && body.username.trim()
      ? body.username.trim().slice(0, 64)
      : 'зритель';
    const text = typeof body.text === 'string' ? body.text.slice(0, 500) : '';
    const ts = Date.now();
    const invoiceId = -ts;
    try {
      this.donationsDb().exec(
        'INSERT OR IGNORE INTO donations(invoice_id, sum, username, text, ts) VALUES(?, ?, ?, ?, ?)',
        invoiceId, sum, username, text, ts,
      );
    } catch {
      return Response.json({ error: 'db error' }, { status: 500 });
    }
    return Response.json({ donation: { invoice_id: invoiceId, sum, username, text, ts } });
  }

  private broadcastSse(data: string): void {
    for (const client of [...this.sseClients]) {
      client.enqueue(data);
    }
  }
}
