import { ApiError } from '../../api/errors';
import { createWorrySelectionController } from './selectionDeletion';
export interface RecordDeletionActions {
  remove(nightId: string, signal: AbortSignal): Promise<void>;
  check(nightId: string, signal: AbortSignal): Promise<boolean>;
}
export interface RecordDeletionPort extends RecordDeletionActions {
  isDeleted(nightId: string): boolean;
}
export interface RecordDeletions extends RecordDeletionPort {
  selection: ReturnType<typeof createWorrySelectionController>;
}
export function createRecordDeletions(
  actions: RecordDeletionActions,
  confirmed: (nightId: string) => void,
): RecordDeletions {
  const deleted = new Set<string>();
  const publish = (id: string) => {
    if (!deleted.has(id)) {
      deleted.add(id);
      confirmed(id);
    }
  };
  const valid = (id: string, signal: AbortSignal) => {
    if (signal.aborted) throw new ApiError('aborted');
    if (!id.trim()) throw new ApiError('configuration');
  };
  const port: RecordDeletionPort = {
    isDeleted: (id) => deleted.has(id),
    async remove(id, signal) {
      valid(id, signal);
      if (deleted.has(id)) return;
      const result = await actions.remove(id, signal);
      valid(id, signal);
      if (result !== undefined) throw new ApiError('invalid-response');
      publish(id);
    },
    async check(id, signal) {
      valid(id, signal);
      if (deleted.has(id)) return true;
      const result = await actions.check(id, signal);
      valid(id, signal);
      if (typeof result !== 'boolean') throw new ApiError('invalid-response');
      if (result) publish(id);
      return result;
    },
  };
  return Object.assign(port, {
    selection: createWorrySelectionController(port),
  });
}
