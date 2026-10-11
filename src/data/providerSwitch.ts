/**
 * Переключатель провайдера данных (план Step 4).
 * VITE_PROVIDER=live и залогиненный Twitch → LiveProvider (реальный аккаунт).
 * VITE_PROVIDER=live без логина (зритель/оверлей) → «тихий» mock без фейковых донатов.
 * Иначе (демо/лабы) — классический MockProvider с сидами.
 */
import type { DataProvider } from './provider';
import { getMockProvider } from './mock/MockProvider';
import { getLiveProvider } from './live/LiveProvider';
import { isAuthed } from './live/auth';

export function isLiveMode(): boolean {
  return import.meta.env.VITE_PROVIDER === 'live';
}

export function getProvider(): DataProvider {
  if (isLiveMode()) {
    if (isAuthed()) return getLiveProvider();
    // зритель/оверлей без сессии: тот же стор-механизм, но без фейковых донатов
    return getMockProvider({ seed: false, autoStream: false });
  }
  return getMockProvider();
}
