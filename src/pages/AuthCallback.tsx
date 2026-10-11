/** Страница приёма Twitch implicit-редиректа: /auth/callback#access_token=...
 *  Обменивает токен на session JWT через воркер и уводит в панель (план Step 2). */
import { useEffect, useState } from 'react';
import { apiBase, storeSession } from '../data/live/auth';

export default function AuthCallback() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const go = (hash: string) => {
      window.location.replace(window.location.origin + '/#' + hash);
    };
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const twitchToken = params.get('access_token');
    if (!twitchToken) {
      go('/landing-figma');
      return;
    }
    let cancelled = false;
    fetch(apiBase() + '/api/auth/twitch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ twitchToken }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`сервер ответил ${r.status}`);
        return r.json() as Promise<Record<string, unknown>>;
      })
      .then((data) => {
        if (cancelled) return;
        if (data.error || typeof data.jwt !== 'string') {
          setError(String(data.error ?? 'oauth error'));
          return;
        }
        storeSession(data.jwt, {
          twitchId: String(data.twitchId ?? ''),
          displayName: String(data.displayName ?? ''),
          avatar: String(data.avatar ?? ''),
          slug: String(data.slug ?? ''),
        });
        go('/app/dashboard2');
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'network error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)' }}>
      {error ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Не удалось войти</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>{error}</div>
          <a href="/#/landing-figma" style={{ color: '#13ad7a', fontSize: 13 }}>← на главную</a>
        </div>
      ) : (
        <div style={{ fontSize: 15, color: 'var(--text2)' }}>Входим через Twitch…</div>
      )}
    </div>
  );
}
