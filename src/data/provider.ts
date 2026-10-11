import type { Config, Donation, IncomingEvent, PublicConfig } from './types';

/**
 * Единый интерфейс слоя данных (07-FRONTEND-PLAN §3).
 * MockProvider — детерминированные сиды в localStorage, без network.
 * Live-адаптеры подключаются позже по контрактам 08-BACKEND-HANDOFF.md.
 */
export interface DataProvider {
  getConfig(): Config;
  /** сохраняет конфиг, revision++ */
  saveConfig(next: Config): Config;
  /** уведомление об изменениях данных (подписка на store) */
  subscribe(cb: () => void): () => void;

  listDonations(): Donation[];
  /** приём события: дедуп по operationId, парс payload, расчёт экономики */
  ingest(e: IncomingEvent): Donation | null;
  /** тестовый донат: полный цикл алерта без платежа, в статистику не входит */
  simulateTest(): Donation | null;
  /** тестовый донат с заданной суммой и текстом (модалка с дашборда) */
  simulateTestWith(sum: number, text: string): Donation | null;
  /** сумма следующего/последнего тестового доната (превью сцены в DesignTab) */
  peekTestSum(): number;
  /** повтор алерта из истории: в оверлей уходит, статистику не меняет */
  simulateReplay(d: Donation): Donation | null;
  /** демо-генерация случайного платежа (только для оверлея) */
  simulateRandomPayment(): void;

  /** перевод pending → finished | cancelled по mock-времени (демо) */
  tickStatuses(): void;

  /** heartbeat оверлея (для статуса OBS в панели) */
  touchHeartbeat(): void;
  heartbeatAgeSec(): number | null;

  resetGoalBoundary(): void;

  /** синхронный кэш публичного конфига (может быть пуст до первой загрузки) */
  getPublicConfig(slug: string): PublicConfig | null;
  /** асинхронная загрузка публичного конфига (live — HTTP, mock — сразу) */
  fetchPublicConfig(slug: string): Promise<PublicConfig | null>;
  /** демо-донат со публичной страницы (вместо native LZT перевода) */
  demoDonate(
    slug: string,
    p: { incomingSum: number; comment: string; username?: string },
  ): Promise<void>;

  /** режим данных: true = mock (localStorage), false = живой API */
  readonly isMock: boolean;
}

export function confirmTotals(donations: Donation[], sinceTs = 0): { count: number; sum: number } {
  let count = 0;
  let sum = 0;
  for (const d of donations) {
    if (d.kind !== 'donate' || d.status !== 'finished' || d.ts < sinceTs) continue;
    count += 1;
    sum += d.shownSum;
  }
  return { count, sum };
}
