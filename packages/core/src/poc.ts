import { timingSafeEqual, createHmac, randomUUID } from 'node:crypto';
export type Provider = 'zoom' | 'livekit';
export type Role = 'teacher' | 'student';
export type JoinRequest = { provider: Provider; room: string; name: string };
export type Principal = { role: Role; identity: string };
export type Environment = Record<string, string | undefined>;
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
function equal(a: string, b: string): boolean {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function authorize(header: string | undefined, env: Environment): Principal {
  if (env.POC_ENABLED !== 'true') throw new HttpError(403, 'POC_DISABLED');
  const teacher = env.POC_TEACHER_KEY ?? ''; const student = env.POC_STUDENT_KEY ?? '';
  if (teacher.length < 32 || student.length < 32 || teacher === student) throw new HttpError(503, 'POC_KEYS_NOT_CONFIGURED');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
  const role = equal(token, teacher) ? 'teacher' : equal(token, student) ? 'student' : null;
  if (!role) throw new HttpError(401, 'UNAUTHORIZED');
  return { role, identity: randomUUID() };
}
export function parseJoin(body: unknown, allowedRoom: string): JoinRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'INVALID_BODY');
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some(key => !['provider', 'room', 'name'].includes(key))) throw new HttpError(400, 'UNKNOWN_FIELD');
  if (input.provider !== 'zoom' && input.provider !== 'livekit') throw new HttpError(400, 'INVALID_PROVIDER');
  if (input.room !== allowedRoom || !/^[a-zA-Z0-9_-]{1,64}$/.test(allowedRoom)) throw new HttpError(403, 'ROOM_NOT_ALLOWED');
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 64 || Array.from(input.name).some(char => char.charCodeAt(0) < 32)) throw new HttpError(400, 'INVALID_NAME');
  return { provider: input.provider, room: allowedRoom, name: input.name.trim() };
}
export function required(env: Environment, key: string): string {
  const value = env[key]; if (!value) throw new HttpError(503, `${key}_NOT_CONFIGURED`); return value;
}
export function zoomToken(request: JoinRequest, principal: Principal, env: Environment, now = Math.floor(Date.now() / 1000)): string {
  const secret = required(env, 'ZOOM_VIDEO_SDK_SECRET');
  // Zoom minimum validity is 1800s; 30s clock-skew allowance, 1800s from issuance.
  const payload = { app_key: required(env, 'ZOOM_VIDEO_SDK_KEY'), tpc: request.room,
    role_type: principal.role === 'teacher' ? 1 : 0, version: 1,
    user_key: principal.identity, iat: now - 30, exp: now + 1800 };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const content = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}`;
  return `${content}.${createHmac('sha256', secret).update(content).digest('base64url')}`;
}
