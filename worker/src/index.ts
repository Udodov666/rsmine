/**
 * RSMine API Worker — роутер (план Step 1).
 * Сейчас: LZT-прокси (перенесён 1:1 из корневого worker.ts).
 * Step 2+: /api/auth/twitch, /api/profile/*, /api/relay/* — заглушки 501.
 */
import { handleLzt } from './routes/lzt';
import { handleAuth } from './routes/auth';
import { handleProfile } from './routes/profile';
import { handleConfig, handleGoal, handlePublic } from './routes/config';
import { handleRelay } from './routes/relay';
import { handleTts } from './routes/tts';
import { RelayRoom } from './relay/RelayRoom';

export { RelayRoom };

export interface Env {
  KV: KVNamespace;
  RELAY_ROOM: DurableObjectNamespace;
  TWITCH_CLIENT_ID: string;
  TWITCH_CLIENT_SECRET: string;
  SESSION_JWT_SECRET: string;
}

export default {
  async fetch(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname.startsWith('/lzt-api/')) {
      return handleLzt(req);
    }

    // CORS preflight для /api/* (релю: зрительские POST идут с другого домена)
    if (url.pathname.startsWith('/api/') && req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    const res = await route(req, env);

    // CORS-заголовки на КАЖДЫЙ /api/* ответ — без них браузер блокирует
    // чтение ответа («Failed to fetch») для кросс-доменных запросов.
    // ИСКЛЮЧЕНИЕ: 101 WebSocket-апгрейд релея — пересоздавать нельзя.
    if (url.pathname.startsWith('/api/') && res.status !== 101) {
      const headers = new Headers(res.headers);
      for (const [k, v] of Object.entries(corsHeaders())) headers.set(k, v);
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
    }
    return res;
  },
};

async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);

  if (url.pathname === '/api/auth/twitch') {
    return handleAuth(req, env);
  }
  // до /api/profile/* — иначе общий профиль-роут перехватит
  if (url.pathname.startsWith('/api/profile/me/config')) {
    return handleConfig(req, env);
  }
  if (url.pathname.startsWith('/api/profile/')) {
    return handleProfile(req, env);
  }
  if (url.pathname.startsWith('/api/public/')) {
    return handlePublic(req, env);
  }
  if (url.pathname.startsWith('/api/goal/')) {
    return handleGoal(req, env);
  }
  if (url.pathname.startsWith('/api/relay/')) {
    return handleRelay(req, env);
  }
  if (url.pathname.startsWith('/api/tts/')) {
    return handleTts(req, env);
  }
  return new Response('not found', { status: 404 });
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Overlay-Key',
  };
}

function stub(step: string): Response {
  return Response.json({ error: 'not implemented', step }, { status: 501 });
}
