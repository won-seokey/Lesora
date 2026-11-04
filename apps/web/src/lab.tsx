'use client';
import { useEffect, useRef, useState } from 'react';
import type { Credentials, Hooks, LabEvent, Provider, RtcSession, Snapshot } from './rtc/types';
const empty: Snapshot = { participants: 0, connected: false, microphone: false, camera: false, sharing: false };
export default function Lab() {
  const [provider, setProvider] = useState<Provider>('livekit');
  const [name, setName] = useState('테스터');
  const [room, setRoom] = useState('lesora-poc');
  const [key, setKey] = useState('');
  const [profile, setProfile] = useState('normal / 1:1');
  const [status, setStatus] = useState('입장 전');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(false);
  const [priority, setPriority] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot>(empty);
  const [events, setEvents] = useState<LabEvent[]>([]);
  const media = useRef<HTMLDivElement>(null);
  const share = useRef<HTMLDivElement>(null);
  const session = useRef<RtcSession | null>(null);
  const epoch = useRef(0);
  const operation = useRef(false);
  const log = (type: string, detail = '') => setEvents(old => [...old.slice(-499), { at: new Date().toISOString(), type, detail }]);
  useEffect(() => () => { epoch.current++; const current = session.current; session.current = null; void current?.leave().catch(() => {}); }, []);
  async function run(task: () => Promise<void>) {
    if (operation.current) return;
    operation.current = true; setBusy(true); setError('');
    try { await task(); } catch { setError('작업에 실패했습니다. 설정·장치 권한·연결을 확인하고 다시 시도하세요.'); log('operation-failed'); }
    finally { operation.current = false; setBusy(false); }
  }
  async function join() {
    const currentEpoch = epoch.current;
    const start = performance.now();
    setStatus('연결 중');
    const response = await fetch('/api/poc/join-token', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ provider, room, name }) });
    if (!response.ok) { setStatus(`입장 거절 (${response.status})`); throw new Error('Token denied'); }
    const credentials = await response.json() as Credentials;
    if (currentEpoch !== epoch.current || !media.current || !share.current) return;
    const hooks: Hooks = { media: media.current, share: share.current, event: log, snapshot: setSnapshot };
    const instance = provider === 'livekit'
      ? (await import('./rtc/livekit')).createLiveKit(hooks)
      : (await import('./rtc/zoom')).createZoom(hooks);
    session.current = instance;
    try {
      await instance.join(credentials);
      if (currentEpoch !== epoch.current) { await instance.leave(); return; }
      setActive(true); setStatus('입장 완료 · 마이크/카메라 꺼짐');
      log('join-complete', `provider=${provider}; elapsedMs=${Math.round(performance.now() - start)}`);
    } catch (error) {
      await instance.leave().catch(() => log('cleanup-failed')); session.current = null;
      setStatus('입장 실패'); throw error;
    }
  }
  async function leave() {
    try { await session.current?.leave(); }
    finally { session.current = null; setActive(false); setPriority(false); setSnapshot(empty); setStatus('퇴장'); log('leave'); }
  }
  async function devices() {
    if (!window.isSecureContext || !navigator.mediaDevices) throw new Error('Secure context required');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    try { log('device-check', `audioTracks=${stream.getAudioTracks().length}; videoTracks=${stream.getVideoTracks().length}; secureContext=${window.isSecureContext}`); }
    finally { stream.getTracks().forEach(track => track.stop()); }
  }
  function download() {
    const report = { schemaVersion: 1, provider, profile, capturedAt: new Date().toISOString(), userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency, crossOriginIsolated: window.crossOriginIsolated,
      sdkVersions: { livekit: '2.23.0', zoom: '2.6.0' },
      limitations: ['CPU/RAM/packet loss/audio gaps require external measurement', 'No recording or persisted chat', 'Manual audio priority; no automatic quality policy'], events };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `lesora-${provider}-${Date.now()}.json`; anchor.click(); URL.revokeObjectURL(url);
  }
  return <main>
    <div className="text-sm font-semibold tracking-widest text-blue-800">LESORA / PHASE 0</div>
    <h1>함께 배우는 수업, 끊김 없이.</h1>
    <p className="note">RTC 비교 검증실 · Zoom Video SDK와 LiveKit Cloud를 같은 조건에서 확인합니다. 공급자 선정 전입니다.</p>
    <section>
      <h2>시험 설정</h2>
      <p className="note">기본 설정은 외부 연결이 차단되어 있습니다. 계정·사용량 승인을 받은 운영자만 PoC를 활성화하세요. 자동 녹화는 아직 구현되지 않았습니다.</p>
      <div className="fields mt-4">
        <label>RTC 공급자<select disabled={busy || active} value={provider} onChange={e => { setProvider(e.target.value as Provider); setEvents([]); }}><option value="livekit">LiveKit Cloud</option><option value="zoom">Zoom Video SDK</option></select></label>
        <label>수업방<input disabled={busy || active} value={room} onChange={e => setRoom(e.target.value)} maxLength={64} /></label>
        <label>표시 이름<input disabled={busy || active} value={name} onChange={e => setName(e.target.value)} maxLength={64} /></label>
        <label>테스터 접근키<input disabled={busy || active} type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} /></label>
        <label>시험 프로파일 / PC 메모<input value={profile} onChange={e => setProfile(e.target.value)} placeholder="1Mbps, 150ms, loss 3% / RAM 4GB" /></label>
      </div>
      <div className="controls">
        <button disabled={busy || active} onClick={() => void run(devices)}>장치 권한 점검</button>
        <button disabled={busy || active || !key || !name.trim()} onClick={() => void run(join)}>수업 입장</button>
        <button disabled={busy || !active} onClick={() => void run(leave)}>나가기</button>
        <button disabled={busy || active} onClick={() => { setEvents([]); log('trial-start', profile); }}>새 시험 기록</button>
      </div>
      <p role="status" aria-live="polite">{busy ? '처리 중…' : status} · 연결 {snapshot.connected ? '됨' : '안 됨'} · 참가자 {snapshot.participants}명</p>
      {error && <p role="alert">{error}</p>}
    </section>
    <section>
      <h2>실시간 강의실</h2>
      <div className="controls">
        <button disabled={busy || !snapshot.connected} onClick={() => void run(async () => { await session.current?.resumeAudio(); })}>오디오 재생 허용</button>
        <button disabled={busy || !snapshot.connected} onClick={() => void run(async () => { await session.current?.microphone(!snapshot.microphone); })}>마이크 {snapshot.microphone ? '끄기' : '켜기'}</button>
        <button disabled={busy || !snapshot.connected || priority} onClick={() => void run(async () => { await session.current?.camera(!snapshot.camera); })}>카메라 {snapshot.camera ? '끄기' : '켜기'}</button>
        <button disabled={busy || !snapshot.connected} onClick={() => void run(async () => { await session.current?.share(!snapshot.sharing); })}>화면공유 {snapshot.sharing ? '종료' : '시작'}</button>
        <button disabled={busy || !snapshot.connected} onClick={() => void run(async () => { await session.current?.audioPriority(!priority); setPriority(!priority); })}>{priority ? '영상 수신 복원' : '음성 우선 모드'}</button>
      </div>
      <p className="note">카메라는 최대 2개 표시합니다. 음성 우선 모드는 송신 카메라와 원격 카메라 표시를 중단하고 음성·화면공유를 유지합니다. 해제 후 내 카메라는 직접 켜세요. 실제 음성 연속성과 디코딩 감소는 실측 대상입니다.</p>
      <div className="media" ref={media} aria-label="참가자 미디어" />
      <div className="share" ref={share} aria-label="화면공유" />
    </section>
    <section>
      <h2>검증 기록</h2>
      <p className="note">최근 500개 이벤트를 메모리에 보관합니다. CPU·RAM·음성 누락·녹화 결과는 별도 측정표에 기록하세요. 새로고침하면 기록은 사라집니다.</p>
      <div className="controls"><button onClick={download}>JSON 내보내기</button><button onClick={() => log('manual-observation', profile)}>관찰 시점 표시</button></div>
      <pre>{events.length ? events.map(e => `${e.at} ${e.type} ${e.detail}`).join('\n') : '아직 기록된 이벤트가 없습니다.'}</pre>
    </section>
  </main>;
}
