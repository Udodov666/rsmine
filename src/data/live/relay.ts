/** Релей инвойсов (план Step 5): зритель → воркер → Tauri стримера → LZT. */

export interface InvoiceResult {
  payUrl?: string;
  invoiceId?: number;
  error?: string;
}

export async function requestInvoice(
  slug: string,
  args: { sum: number; comment: string; urlSuccess: string },
): Promise<InvoiceResult> {
  const base = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';
  try {
    const res = await fetch(`${base}/api/relay/${encodeURIComponent(slug)}/invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    return (await res.json()) as InvoiceResult;
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'network error' };
  }
}
