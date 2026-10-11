/** Простой троттлинг денег/биллинга: N запросов в минуту с IP (KV-счётчик с TTL).
 *  Гонка конкурентных инкрементов допустима — это ограничитель abuse, не лимит биллинга.
 *  Возвращает true, если запрос разрешён. */
export async function throttle(
  kv: KVNamespace,
  req: Request,
  scope: string,
  limit: number,
): Promise<boolean> {
  try {
    const ip = req.headers.get('cf-connecting-ip') ?? 'unknown';
    const key = `throttle:${scope}:${Math.floor(Date.now() / 60000)}:${ip}`;
    const n = Number((await kv.get(key)) ?? 0);
    if (n >= limit) return false;
    await kv.put(key, String(n + 1), { expirationTtl: 90 });
    return true;
  } catch {
    // KV чихнул — запросы не блокируем (fail-open для легитимного трафика)
    return true;
  }
}
