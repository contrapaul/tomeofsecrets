import { HttpError, json } from './lib/http';
import { d1Store } from './lib/store';
import { handleApi } from './routes';

/**
 * The Worker in front of the static game: `/api/*` is accounts (D1); every
 * other path is served from the assets (wrangler's `run_worker_first` sends
 * only `/api/*` here). Nothing here is needed to play signed out.
 */

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      return await handleApi(request, { store: d1Store(env.DB), env, waitUntil: (w) => ctx.waitUntil(w.catch((e) => console.error('background task failed', e))) });
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, { status: e.status });
      console.error('api error', e);
      return json({ error: 'Something went wrong on the server.' }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
