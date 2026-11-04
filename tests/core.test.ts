import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { authorize, parseJoin, zoomToken } from '../packages/core/src/poc.ts';
import { transitionRecording, usageTotal } from '../packages/core/src/recording.ts';
const env = { POC_ENABLED: 'true', POC_TEACHER_KEY: 't'.repeat(32), POC_STUDENT_KEY: 's'.repeat(32), ZOOM_VIDEO_SDK_KEY: 'test-key', ZOOM_VIDEO_SDK_SECRET: 'test-secret' };
test('external access is disabled by default', () => assert.throws(() => authorize(undefined, {}), /POC_DISABLED/));
test('reject missing, invalid, same, and weak operator keys', () => {
  assert.throws(() => authorize(undefined, env), /UNAUTHORIZED/);
  assert.throws(() => authorize('Bearer invalid', env), /UNAUTHORIZED/);
  assert.throws(() => authorize('Bearer '+env.POC_TEACHER_KEY, { ...env, POC_STUDENT_KEY: env.POC_TEACHER_KEY }), /NOT_CONFIGURED/);
  assert.throws(() => authorize('Bearer short', { ...env, POC_TEACHER_KEY: 'short' }), /NOT_CONFIGURED/);
});
test('role is assigned server-side with unique participant identities', () => {
  const a = authorize('Bearer '+env.POC_STUDENT_KEY, env); const b = authorize('Bearer '+env.POC_STUDENT_KEY, env);
  assert.equal(a.role, 'student'); assert.notEqual(a.identity, b.identity);
  assert.equal(authorize('Bearer '+env.POC_TEACHER_KEY, env).role, 'teacher');
});
test('reject room access and injected privileges', () => {
  for (const body of [null, [], { provider:'other',room:'demo',name:'n' }, { provider:'zoom',room:'else',name:'n' }, { provider:'zoom',room:'demo',name:'n',role:'teacher' }, { provider:'zoom',room:'demo',name:' ' }]) {
    assert.throws(() => parseJoin(body, 'demo'));
  }
  assert.equal(parseJoin({provider:'zoom',room:'demo',name:' 학생 '}, 'demo').name, '학생');
});
test('Zoom signed claims constrain topic, privilege, expiry and identity', () => {
  for (const role of ['student','teacher'] as const) {
    const token = zoomToken({ provider:'zoom',room:'demo',name:'n' }, {role,identity:'test-id'}, env, 1000);
    const [header, payload, signature] = token.split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    assert.equal(signature, createHmac('sha256', env.ZOOM_VIDEO_SDK_SECRET).update(`${header}.${payload}`).digest('base64url'));
    assert.equal(claims.tpc,'demo'); assert.equal(claims.role_type, role === 'teacher' ? 1 : 0);
    assert.equal(claims.iat,970); assert.equal(claims.exp,2800); assert.equal(claims.version,1); assert.equal(claims.user_key,'test-id');
    assert.ok(!token.includes(env.ZOOM_VIDEO_SDK_SECRET));
  }
});
test('missing provider credentials fail closed', () => assert.throws(() => zoomToken({provider:'zoom',room:'demo',name:'n'}, {role:'student',identity:'id'}, {}), /NOT_CONFIGURED/));
test('recording acceptance cannot masquerade as ready', () => {
  assert.equal(transitionRecording('SCHEDULED','RECORDING_REQUESTED'),'RECORDING_REQUESTED');
  assert.throws(() => transitionRecording('RECORDING_REQUESTED','READY'));
  assert.throws(() => transitionRecording('UPLOADING','READY'), /integrity/);
  assert.equal(transitionRecording('UPLOADING','READY',true),'READY');
});
test('duplicate state is idempotent, late states cannot regress ready', () => {
  assert.equal(transitionRecording('READY','READY'),'READY');
  assert.throws(() => transitionRecording('READY','RECORDING'));
  assert.equal(transitionRecording('STOPPING','FAILED'),'FAILED');
  assert.throws(() => transitionRecording('FAILED','RECORDING_REQUESTED'));
});
test('plan sample usage accounts for all participants and recording outputs', () => {
  assert.deepEqual(usageTotal([{lessons:20,minutes:60,participants:2,outputs:1},{lessons:12,minutes:90,participants:6,outputs:1}]), {participantMinutes:8880,recordingMinutes:2280});
  assert.throws(() => usageTotal([{lessons:1,minutes:-1,participants:2,outputs:1}]));
});
