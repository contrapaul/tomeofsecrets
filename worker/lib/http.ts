/** The small HTTP vocabulary the routes share. */

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export function fail(status: number, message: string): never {
  throw new HttpError(status, message);
}

export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(body), { ...init, headers });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') fail(400, 'Invalid JSON body.');
    return body as Record<string, unknown>;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    fail(400, 'Invalid JSON body.');
  }
}

export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? 'local';
}

export function cookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}

/** The size cap on a stored document; a Tome is a few KB, a run a few tens. */
export const MAX_DOC_BYTES = 512 * 1024;
