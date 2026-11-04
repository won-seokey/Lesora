import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../../apps/api/src/app.ts';
const env = { POC_ENABLED:'true', POC_TEACHER_KEY:'t'.repeat(32), POC_STUDENT_KEY:'s'.repeat(32), ZOOM_VIDEO_SDK_KEY:'fake-key', ZOOM_VIDEO_SDK_SECRET:'fake-secret' };
test('HTTP token boundary: disabled, validation, role, origin, limits and no secret errors', async t => {
  const server = createApp(env).listen(0, '127.0.0.1');
  await once(server,'listening');
  t.after(() => new Promise<void>((resolve,reject) => server.close(e => e ? reject(e) : resolve())));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const body = { provider:'zoom',room:'lesora-poc',name:'test' };
  const post = (data: unknown = body, key = env.POC_STUDENT_KEY, origin = 'http://localhost:3000') => fetch(`${base}/poc/join-token`, {method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`,Origin:origin},body:JSON.stringify(data)});
  await t.test('health reports no persistence', async () => assert.equal((await (await fetch(`${base}/health`)).json()).persistence,false));
  await t.test('unauthorized', async () => assert.equal((await post(body,'invalid')).status,401));
  await t.test('foreign origin denied', async () => assert.equal((await post(body,env.POC_STUDENT_KEY,'https://example.org')).status,403));
  await t.test('role injection denied', async () => assert.equal((await post({...body,role:'teacher'})).status,400));
  await t.test('wrong room denied', async () => assert.equal((await post({...body,room:'else'})).status,403));
  await t.test('student signed token and no-store', async () => {
    const response = await post(); assert.equal(response.status,200); assert.equal(response.headers.get('cache-control'),'no-store');
    const result = await response.json(); const payload = JSON.parse(Buffer.from(result.token.split('.')[1],'base64url').toString());
    assert.equal(payload.role_type,0); assert.equal(payload.tpc,'lesora-poc'); assert.ok(!JSON.stringify(result).includes('fake-secret'));
  });
  await t.test('missing LiveKit configuration returns 503 without network', async () => assert.equal((await post({...body,provider:'livekit'})).status,503));
  await t.test('oversize body rejected', async () => assert.equal((await post({...body,name:'a'.repeat(5000)})).status,413));
  await t.test('rate limiting eventually rejects repeated tokens', async () => { let status=0; for(let i=0;i<31;i++) status=(await post(body,'invalid')).status; assert.equal(status,429); });
});
