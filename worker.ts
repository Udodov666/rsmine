/**
 * Прод-прокси к LZT Invoice API (обход CORS).
 * Деплой: npx wrangler deploy (нужен Cloudflare-аккаунт + роут /lzt-api/* на этот воркер).
 * Клиент шлёт сюда же, что и в dev-прокси: JSON с полями счёта + token в body.
 * Воркер перекладывает token в заголовок Authorization и форвардит ответ как есть.
 */
export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/lzt-api/invoice' && req.method === 'POST') {
      let body: Record<string, unknown> = {};
      try {
        body = (await req.json()) as Record<string, unknown>;
      } catch {
        return Response.json({ error: 'bad json' }, { status: 400 });
      }
      const { token, ...payload } = body as { token?: unknown } & Record<string, unknown>;
      if (typeof token !== 'string' || !token) {
        return Response.json({ error: 'missing token' }, { status: 400 });
      }
      const upstream = await fetch('https://prod-api.lzt.market/invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const text = await upstream.text();
      return new Response(text, {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('not found', { status: 404 });
  },
};
