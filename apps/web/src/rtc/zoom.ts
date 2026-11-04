import ZoomVideo from '@zoom/videosdk';
import type { Credentials, Hooks, RtcSession } from './types';
// Zoom-specific rendering stays here; it is not forced into the LiveKit track model.
export function createZoom(hooks: Hooks): RtcSession {
  const client = ZoomVideo.createClient();
  let stream: ReturnType<typeof client.getMediaStream>;
  let connected = false;
  let microphone = false;
  let audioStarted = false;
  let camera = false;
  let sharing = false;
  let priority = false;
  let closed = false;
  let renderQueue = Promise.resolve();
  const rendered = new Set<number>();
  const player = document.createElement('video-player-container');
  hooks.media.append(player);
  const sendVideo = document.createElement('video'); sendVideo.muted = true; sendVideo.playsInline = true;
  const sendCanvas = document.createElement('canvas'); sendCanvas.width = 1920; sendCanvas.height = 1080;
  const receiveCanvas = document.createElement('canvas'); receiveCanvas.width = 1920; receiveCanvas.height = 1080;
  // SDK operations may resolve to ExecutedFailure rather than reject.
  function checked(value: unknown) {
    if (value && typeof value === 'object' && 'type' in value && value.type === 'INVALID_OPERATION') throw new Error('Zoom operation rejected');
    if (value && typeof value === 'object' && 'errorCode' in value) throw new Error('Zoom operation failed');
  }
  function snapshot() { hooks.snapshot({ connected, participants: connected ? client.getAllUser().length : 0, microphone, camera, sharing }); }
  async function render() {
    if (!connected || closed || !stream) return;
    const users = priority ? [] : client.getAllUser().filter(u => u.bVideoOn).slice(0, 2);
    const wanted = new Set(users.map(u => u.userId));
    for (const id of rendered) if (!wanted.has(id)) {
      const old = await stream.detachVideo(id);
      if (Array.isArray(old)) old.forEach(el => el.remove());
      else if (old instanceof HTMLElement) old.remove();
      rendered.delete(id);
    }
    for (const user of users) if (!rendered.has(user.userId)) {
      const node = await stream.attachVideo(user.userId, 2); // VideoQuality.Video_360P
      if (node instanceof HTMLElement) { node.title = user.displayName; player.append(node); rendered.add(user.userId); }
      else checked(node);
    }
    snapshot();
  }
  function refresh() {
    renderQueue = renderQueue.then(render).catch(() => hooks.event('video-render-error', '영상 렌더링 실패; 음성 상태 별도 확인'));
  }
  const onUsers = () => { refresh(); snapshot(); };
  const onConnection = (payload: { state: string }) => {
    connected = payload.state === 'Connected';
    hooks.event('connection-state', payload.state); snapshot(); if (connected) refresh();
  };
  const onShare = (payload: { state: string; userId: number }) => {
    void (async () => {
      if (payload.state === 'Active') {
        hooks.share.append(receiveCanvas); checked(await stream.startShareView(receiveCanvas, payload.userId));
      } else { checked(await stream.stopShareView()); receiveCanvas.remove(); }
    })().catch(() => hooks.event('screen-view-error'));
  };
  const onLocalShare = () => { sharing = false; sendVideo.remove(); sendCanvas.remove(); snapshot(); };
  client.on('connection-change', onConnection);
  client.on('user-added', onUsers); client.on('user-removed', onUsers); client.on('user-updated', onUsers);
  client.on('peer-video-state-change', onUsers);
  client.on('active-share-change', onShare);
  client.on('passively-stop-share', onLocalShare);
  return {
    async join(credentials: Credentials) {
      if (credentials.provider !== 'zoom') throw new Error('Provider mismatch');
      checked(await client.init('en-US', 'Global', { patchJsMedia: true, enforceMultipleVideos: true }));
      checked(await client.join(credentials.room, credentials.token, credentials.name));
      stream = client.getMediaStream(); connected = true;
      try { checked(await stream.startAudio({ mute: true })); audioStarted = true; }
      catch { hooks.event('playback-blocked', '오디오 재생 허용 버튼을 눌러 주세요'); }
      hooks.event('zoom-capability', `crossOriginIsolated=${window.crossOriginIsolated}; SharedArrayBuffer=${typeof SharedArrayBuffer !== 'undefined'}`);
      refresh(); snapshot();
      const activeShare = stream.getActiveShareUserId();
      if (activeShare) onShare({ state: 'Active', userId: activeShare });
    },
    async resumeAudio() {
      if (!audioStarted) { checked(await stream.startAudio({ mute: true })); audioStarted = true; }
    },
    async microphone(enabled) {
      if (!audioStarted) { checked(await stream.startAudio({ mute: !enabled })); audioStarted = true; }
      else checked(await (enabled ? stream.unmuteAudio() : stream.muteAudio()));
      microphone = enabled; snapshot();
    },
    async camera(enabled) { checked(await (enabled ? stream.startVideo() : stream.stopVideo())); camera = enabled; refresh(); snapshot(); },
    async share(enabled) {
      if (enabled) {
        const element = stream.isStartShareScreenWithVideoElement() ? sendVideo : sendCanvas;
        hooks.share.append(element);
        try { checked(await stream.startShareScreen(element)); } catch (error) { element.remove(); throw error; }
      } else { checked(await stream.stopShareScreen()); sendVideo.remove(); sendCanvas.remove(); }
      sharing = enabled; snapshot();
    },
    async audioPriority(enabled) {
      if (enabled && camera) { checked(await stream.stopVideo()); camera = false; }
      priority = enabled; refresh(); await renderQueue; snapshot(); hooks.event('audio-priority', String(enabled));
    },
    async leave() {
      closed = true; await renderQueue;
      try { if (stream) {
        for (const id of rendered) await stream.detachVideo(id);
        if (sharing) await stream.stopShareScreen();
      } } finally {
        try { await client.leave(); } finally {
          ZoomVideo.destroyClient(); hooks.media.replaceChildren(); hooks.share.replaceChildren();
        }
      }
    },
  };
}
