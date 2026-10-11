import type { Feature } from '../data/types';

export interface EconomyInput {
  /** фактическая сумма перевода стримеру (единственный доверенный источник) */
  incomingSum: number;
  /** минималка доната стримера (дефолт 10) */
  minimum: number;
  /** заявленные фичи из payload, в порядке заявления (только валидные и включённые) */
  features: Feature[];
  /** прайс по коду фичи */
  prices: Record<string, number>;
}

export interface EconomyResult {
  /** сумма, показываемая на стриме */
  shown: number;
  /** фичи, которые играем */
  retained: Feature[];
  /** фичи, срезанные экономикой (для деталей в истории) */
  removed: Feature[];
}

const priceOf = (f: Feature, prices: Record<string, number>) => prices[f.code] ?? 0;
const sum = (fs: Feature[], prices: Record<string, number>) =>
  fs.reduce((s, f) => s + priceOf(f, prices), 0);

/**
 * Экономика фич (06-APP-SPEC §2, не искажать):
 * показать = incoming_sum − Σ прайсов заявленных фич;
 * если показать < минималки — отрезать самую дорогую заявленную фичу и пересчитать;
 * если фичей не осталось — показать весь incoming_sum, даже меньше минималки.
 * При равных ценах срезается последняя заявленная (стабильный tie-break).
 */
export function calcEconomy(input: EconomyInput): EconomyResult {
  const { incomingSum, minimum, prices } = input;
  let retained = [...input.features];
  const removed: Feature[] = [];

  while (retained.length > 0 && incomingSum - sum(retained, prices) < minimum) {
    let idx = 0;
    for (let i = 1; i < retained.length; i++) {
      if (priceOf(retained[i], prices) >= priceOf(retained[idx], prices)) idx = i;
    }
    removed.push(retained[idx]);
    retained = retained.filter((_, i) => i !== idx);
  }

  const shown =
    retained.length === 0 ? incomingSum : incomingSum - sum(retained, prices);
  return { shown, retained, removed };
}
