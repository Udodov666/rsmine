/**
 * Оплата LZT: создание счёта через Market Invoice API.
 * Доки: lzt-market.readme.io (Create Invoice, required scope: invoice).
 * POST https://prod-api.lzt.market/invoice, Authorization: Bearer <token>.
 * Ответ: { invoice: { url: 'https://lzt.market/invoice/<id>/', ... } } — туда редиректим донатера.
 */
export interface LztInvoice {
  payUrl: string;
  invoiceId: number;
}

export async function createLztInvoice(args: {
  token: string;
  sum: number;
  comment: string;
  merchantId: string;
  urlSuccess: string;
}): Promise<LztInvoice> {
  // Same-origin: в dev vite проксирует на prod-api, в проде — воркер.
  // Токен дублируется в body для воркера (он перекладывает его в заголовок).
  const payment_id = `lztd_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const res = await fetch('/lzt-api/invoice', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.token}`,
    },
    body: JSON.stringify({
      token: args.token,
      currency: 'rub',
      amount: args.sum,
      payment_id,
      comment: args.comment || 'Донат стримеру',
      url_success: args.urlSuccess,
      merchant_id: args.merchantId,
      lifetime: 3600,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LZT invoice: HTTP ${res.status}${text ? ` — ${text.slice(0, 160)}` : ''}`);
  }
  const data = (await res.json()) as { invoice?: { url?: string; invoice_id?: number } };
  if (!data.invoice?.url) throw new Error('LZT invoice: нет ссылки на оплату');
  return { payUrl: data.invoice.url, invoiceId: data.invoice.invoice_id ?? 0 };
}
