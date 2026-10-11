import { useEffect, useState } from 'react';

/**
 * Минимальный hash-роутер (без зависимостей).
 * Маршруты: #/app[/<view>] — панель, #/d/<slug> — публичная страница,
 * #/overlay/<secret> — оверлей OBS (07-FRONTEND-PLAN §1).
 */
export function currentPath(): string {
  const h = window.location.hash.replace(/^#/, '');
  if (h === '' || h === '/') return '/';
  return h;
}

export function navigate(path: string) {
  window.location.hash = path;
}

export function usePath(): string {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onHash = () => setPath(currentPath());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return path;
}
