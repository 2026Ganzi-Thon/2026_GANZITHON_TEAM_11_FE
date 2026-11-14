import { useReducer } from 'react';
import type { ApiError } from '../../api/errors';

/** Memory-only recovery, separate from editable drafts and scoped to one source. */
export function createSubmissionRecovery<T>() {
  const owners = new WeakMap<object, Map<string | undefined, T>>();
  return function useSubmissionRecovery(
    owner: object,
    source: string | undefined,
  ) {
    const [, refresh] = useReducer((version: number) => version + 1, 0);
    return {
      value: owners.get(owner)?.get(source) ?? null,
      remember(value: T) {
        let pending = owners.get(owner);
        if (!pending) {
          pending = new Map();
          owners.set(owner, pending);
        }
        pending.set(source, value);
        refresh();
      },
      clear(value: T) {
        const pending = owners.get(owner);
        if (pending?.get(source) !== value) return;
        pending.delete(source);
        refresh();
      },
    };
  };
}

export function submissionWasRejected(error: ApiError) {
  return (
    error.kind === 'http' &&
    (error.status === 422 ||
      error.code === 'SAFETY_CHECK_UNAVAILABLE' ||
      error.code === 'WRITING_ENTRY_REQUIRED')
  );
}
