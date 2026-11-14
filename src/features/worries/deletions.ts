import { ApiError } from '../../api/errors';
export interface WorryDeletionActions {
  remove(nightId: string, signal: AbortSignal): Promise<void>;
}
export interface WorryDeletions extends WorryDeletionActions {
  isDeleted(nightId: string): boolean;
  subscribe(listener: (nightId: string) => void): () => void;
}
/** Confirmed invalidation belongs to one data source; never share across accounts. */
export function createWorryDeletions(
  actions: WorryDeletionActions,
): WorryDeletions {
  const deleted = new Set<string>();
  const listeners = new Set<(nightId: string) => void>();
  return {
    async remove(nightId, signal) {
      if (signal.aborted) throw new ApiError('aborted');
      if (!nightId.trim()) throw new ApiError('configuration');
      const result = await actions.remove(nightId, signal);
      if (signal.aborted) throw new ApiError('aborted');
      if (result !== undefined) throw new ApiError('invalid-response');
      if (!deleted.has(nightId)) {
        deleted.add(nightId);
        listeners.forEach((listener) => listener(nightId));
      }
    },
    isDeleted: (nightId) => deleted.has(nightId),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
export function maskDeletedWorry<
  T extends { worry_text: string | null; worry_saved_at?: string | null },
>(night: T, nightId: string, source?: WorryDeletions): T {
  return source?.isDeleted(nightId)
    ? {
        ...night,
        worry_text: null,
        ...('worry_saved_at' in night ? { worry_saved_at: null } : {}),
      }
    : night;
}
