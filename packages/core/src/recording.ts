// Design contract only: not a provider recording implementation or persistent store.
export type RecordingState = 'SCHEDULED' | 'RECORDING_REQUESTED' | 'RECORDING' | 'STOPPING' | 'PROCESSING' | 'UPLOADING' | 'READY' | 'FAILED';
const transitions: Record<RecordingState, readonly RecordingState[]> = {
  SCHEDULED: ['RECORDING_REQUESTED'], RECORDING_REQUESTED: ['RECORDING', 'STOPPING', 'PROCESSING', 'FAILED'],
  RECORDING: ['STOPPING', 'PROCESSING', 'FAILED'], STOPPING: ['PROCESSING', 'FAILED'],
  PROCESSING: ['UPLOADING', 'FAILED'], UPLOADING: ['READY', 'FAILED'], READY: [], FAILED: [],
};
export function transitionRecording(current: RecordingState, next: RecordingState, verifiedObject = false): RecordingState {
  if (current === next) return current;
  if (!transitions[current].includes(next)) throw new Error(`Invalid recording transition: ${current} -> ${next}`);
  if (next === 'READY' && !verifiedObject) throw new Error('Object integrity and metadata must be verified');
  return next;
}
export type Usage = { lessons: number; minutes: number; participants: number; outputs: number };
export function usageTotal(rows: Usage[]): { participantMinutes: number; recordingMinutes: number } {
  return rows.reduce((total, row) => {
    if (Object.values(row).some(value => !Number.isFinite(value) || value < 0)) throw new Error('Invalid usage');
    return { participantMinutes: total.participantMinutes + row.lessons * row.minutes * row.participants,
      recordingMinutes: total.recordingMinutes + row.lessons * row.minutes * row.outputs };
  }, { participantMinutes: 0, recordingMinutes: 0 });
}
