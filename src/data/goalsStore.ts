/**
 * Архив целей сбора — демо-стор в памяти сессии.
 * Завершённая цель уходит сюда: «completed» — собрана вся сумма,
 * «closed» — закрыта вручную до достижения. Удаление — навсегда.
 */

export type GoalStatus = 'completed' | 'closed';

export interface PastGoal {
  id: string;
  title: string;
  target: number;
  collected: number;
  startedTs: number;
  endedTs: number;
  status: GoalStatus;
}

const day = 86_400_000;
const now = Date.now();

let goals: PastGoal[] = [
  { id: 'g1', title: 'Новый микрофон', target: 15_000, collected: 15_000, startedTs: now - 40 * day, endedTs: now - 18 * day, status: 'completed' },
  { id: 'g2', title: 'Улучшение ПК для стрима', target: 60_000, collected: 41_500, startedTs: now - 90 * day, endedTs: now - 55 * day, status: 'completed' },
  { id: 'g3', title: 'Камера 4K', target: 25_000, collected: 9_200, startedTs: now - 30 * day, endedTs: now - 12 * day, status: 'closed' },
];

const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }

export const goalsStore = {
  getAll(): PastGoal[] {
    return goals;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
  /** Убрать цель из архива (навсегда). */
  remove(id: string) {
    goals = goals.filter((g) => g.id !== id);
    emit();
  },
  /** Пометить закрытую цель выполненной. */
  markCompleted(id: string) {
    goals = goals.map((g) => (g.id === id && g.status !== 'completed' ? { ...g, status: 'completed' } : g));
    emit();
  },
  /** Отправить активную цель в архив (при завершении или досрочном закрытии). */
  archive(entry: { title: string; target: number; collected: number; startedTs: number }) {
    const status: GoalStatus = entry.collected >= entry.target ? 'completed' : 'closed';
    goals = [
      { id: `g${Date.now()}`, endedTs: Date.now(), status, ...entry },
      ...goals,
    ];
    emit();
  },
};
