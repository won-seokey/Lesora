import { Room, RoomEvent, Track, VideoPresets } from 'livekit-client';
import type { RemoteTrack, RemoteParticipant, RemoteTrackPublication } from 'livekit-client';
import type { Credentials, Hooks, RtcSession } from './types';
export function createLiveKit(hooks: Hooks): RtcSession {
  const room = new Room({ adaptiveStream: true, dynacast: true,
    videoCaptureDefaults: { resolution: { ...VideoPresets.h360.resolution, frameRate: 15 } } });
  let priority = false;
  let closing = false;
  const elements = new Map<string, HTMLMediaElement>();
  function snapshot() {
    hooks.snapshot({ participants: room.remoteParticipants.size + 1, connected: room.state === 'connected',
      microphone: room.localParticipant.isMicrophoneEnabled, camera: room.localParticipant.isCameraEnabled,
      sharing: room.localParticipant.isScreenShareEnabled });
  }
  function detach(id: string) { elements.get(id)?.remove(); elements.delete(id); }
  function attach(track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) {
    detach(publication.trackSid);
    const el = track.attach();
    el.title = `${participant.name ?? participant.identity} · ${publication.source}`;
    el.autoplay = true;
    if (el instanceof HTMLVideoElement) el.playsInline = true;
    (publication.source === Track.Source.ScreenShare ? hooks.share : hooks.media).append(el);
    elements.set(publication.trackSid, el);
    void el.play().catch(() => hooks.event('playback-blocked', '오디오 재생 허용 버튼을 눌러 주세요'));
  }
  function subscriptions() {
    // At most two remote cameras; screen share and audio never count against this budget.
    let cameras = 0;
    for (const participant of room.remoteParticipants.values()) {
      for (const publication of participant.trackPublications.values()) {
        const camera = publication.source === Track.Source.Camera;
        const wanted = !camera || (!priority && cameras++ < 2);
        publication.setSubscribed(wanted);
      }
    }
    snapshot();
  }
  room.on(RoomEvent.TrackSubscribed, attach);
  room.on(RoomEvent.TrackUnsubscribed, (track, pub) => { track.detach().forEach(el => el.remove()); detach(pub.trackSid); });
  room.on(RoomEvent.TrackPublished, subscriptions);
  room.on(RoomEvent.TrackUnpublished, subscriptions);
  room.on(RoomEvent.ParticipantConnected, () => { hooks.event('participant-connected'); subscriptions(); });
  room.on(RoomEvent.ParticipantDisconnected, () => { hooks.event('participant-disconnected'); subscriptions(); });
  room.on(RoomEvent.ConnectionStateChanged, state => { hooks.event('connection-state', state); snapshot(); });
  room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => hooks.event('connection-quality', `${participant.isLocal ? 'local' : 'remote'}:${quality}`));
  room.on(RoomEvent.Reconnecting, () => hooks.event('reconnecting'));
  room.on(RoomEvent.Reconnected, () => { hooks.event('reconnected'); subscriptions(); });
  room.on(RoomEvent.LocalTrackPublished, snapshot);
  room.on(RoomEvent.LocalTrackUnpublished, snapshot);
  room.on(RoomEvent.TrackMuted, snapshot);
  room.on(RoomEvent.TrackUnmuted, snapshot);
  room.on(RoomEvent.Disconnected, () => {
    snapshot();
    if (!closing) hooks.event('disconnected', '자동 복구 종료; 나가기 후 재입장');
  });
  return {
    async join(credentials: Credentials) {
      if (credentials.provider !== 'livekit') throw new Error('Provider mismatch');
      await room.connect(credentials.url, credentials.token, { autoSubscribe: false });
      await room.startAudio().catch(() => hooks.event('playback-blocked', '오디오 재생 허용 버튼을 눌러 주세요'));
      subscriptions();
    },
    async resumeAudio() { await room.startAudio(); },
    async microphone(enabled) { await room.localParticipant.setMicrophoneEnabled(enabled); snapshot(); },
    async camera(enabled) { await room.localParticipant.setCameraEnabled(enabled); snapshot(); },
    async share(enabled) { await room.localParticipant.setScreenShareEnabled(enabled, { audio: false }); snapshot(); },
    async audioPriority(enabled) {
      if (enabled) await room.localParticipant.setCameraEnabled(false);
      priority = enabled; subscriptions(); hooks.event('audio-priority', String(enabled));
    },
    async leave() {
      closing = true;
      await room.disconnect(); room.removeAllListeners();
      elements.forEach(el => el.remove()); elements.clear(); hooks.media.replaceChildren(); hooks.share.replaceChildren();
    },
  };
}
