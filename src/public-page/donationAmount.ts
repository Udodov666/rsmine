const amountFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

/** Exact display for this form, including kopecks; other dashboard formats stay unchanged. */
export function donationMoney(value: number): string {
  return `${amountFormatter.format(value)} ₽`;
}

/** Accept pasted grouping spaces and a decimal comma. Never clamp while typing. */
export function parseAmount(raw: string): number | null {
  const normalized = raw.replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value <= Number.MAX_SAFE_INTEGER / 100 ? value : null;
}

export const MAX_DONATION = 100_000;

export function getAmountError(raw: string, minimum: number): string | null {
  if (!raw.trim()) return 'Введите сумму доната.';
  const value = parseAmount(raw);
  if (value === null) return 'Введите сумму числом, например 250 или 250,50.';
  if (value < minimum) return `Минимальная сумма — ${donationMoney(minimum)}.`;
  if (value > MAX_DONATION) return 'Слишком большая сумма.';
  return null;
}

/** Four choices that remain usable when the streamer changes their minimum. */
export function getAmountPresets(minimum: number): number[] {
  const common = [100, 200, 500, 1000];
  if (minimum <= common[0]) return common;
  return [...new Set([minimum, ...common, minimum * 2, minimum * 5, minimum * 10])]
    .filter((v) => v >= minimum && Number.isFinite(v))
    .sort((a, b) => a - b)
    .slice(0, 4);
}
