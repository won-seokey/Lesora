import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { authorize, parseJoin, required, zoomToken, HttpError } from '../../../packages/core/src/poc.ts';
import type { Environment } from '../../../packages/core/src/poc.ts';
export function createApp(env: Environment = process.env) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('X-Content-Type-Options', 'nosniff'); next(); });
  app.get('/health', (_req, res) => res.json({ status: 'ok', phase: 0, persistence: false }));
  app.get('/poc/status', (_req, res) => res.json({ enabled: env.POC_ENABLED === 'true', recording: 'not-implemented' }));
  // Bounded single-process rate limiter; no proxy trust or caller-supplied IP headers.
  const attempts = new Map<string, { count: number; until: number }>();
  app.use('/poc/join-token', (req, _res, next) => {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
    const key = req.socket.remoteAddress ?? 'unknown';
    const entry = attempts.get(key) ?? { count: 0, until: now + 60_000 };
    if (++entry.count > 30 || (!attempts.has(key) && attempts.size >= 1000)) return next(new HttpError(429, 'RATE_LIMITED'));
    attempts.set(key, entry); next();
  });
  app.post('/poc/join-token', express.json({ limit: '4kb' }), async (req, res) => {
    if (req.get('origin') && req.get('origin') !== (env.APP_ORIGIN ?? 'http://localhost:3000')) throw new HttpError(403, 'ORIGIN_DENIED');
    const principal = authorize(req.get('authorization'), env);
    const input = parseJoin(req.body, env.POC_ROOM ?? 'lesora-poc');
    if (input.provider === 'zoom') {
      res.json({ provider: 'zoom', token: zoomToken(input, principal, env), room: input.room, name: input.name });
      return;
    }
    const url = required(env, 'LIVEKIT_URL');
    if (!url.startsWith('wss://')) throw new HttpError(503, 'LIVEKIT_URL_REQUIRES_WSS');
    const { AccessToken } = await import('livekit-server-sdk');
    const token = new AccessToken(required(env, 'LIVEKIT_API_KEY'), required(env, 'LIVEKIT_API_SECRET'),
      { identity: principal.identity, name: input.name, ttl: '10m' });
    token.addGrant({ room: input.room, roomJoin: true, canPublish: true, canSubscribe: true,
      canPublishData: true, roomAdmin: false, roomRecord: false });
    res.json({ provider: 'livekit', token: await token.toJwt(), url, room: input.room, name: input.name });
  });
  app.use((_req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
  const errors: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof HttpError) { res.status(error.status).json({ error: error.message }); return; }
    if (error instanceof SyntaxError) { res.status(400).json({ error: 'INVALID_JSON' }); return; }
    if (typeof error === 'object' && error !== null && 'status' in error && error.status === 413) {
      res.status(413).json({ error: 'BODY_TOO_LARGE' }); return;
    }
    // Never serialize SDK errors: they can contain credentials or signed URLs.
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  };
  app.use(errors);
  return app;
}
