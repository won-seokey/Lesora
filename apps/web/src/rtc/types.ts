export type Provider = 'livekit' | 'zoom';
export type Credentials =
  | { provider: 'livekit'; token: string; url: string; room: string; name: string }
  | { provider: 'zoom'; token: string; room: string; name: string };
export type LabEvent = { at: string; type: string; detail: string };
export type Snapshot = { participants: number; connected: boolean; microphone: boolean; camera: boolean; sharing: boolean };
export type Hooks = {
  media: HTMLElement; share: HTMLElement;
  event: (type: string, detail?: string) => void;
  snapshot: (value: Snapshot) => void;
};
export interface RtcSession {
  join(credentials: Credentials): Promise<void>;
  resumeAudio(): Promise<void>;
  microphone(enabled: boolean): Promise<void>;
  camera(enabled: boolean): Promise<void>;
  share(enabled: boolean): Promise<void>;
  audioPriority(enabled: boolean): Promise<void>;
  leave(): Promise<void>;
}
