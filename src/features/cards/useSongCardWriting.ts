import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../api/errors';
import {
  PREVIEW_RECOMMENDATION_LIMIT,
  trimmedLength,
  validSelection,
  type SongCardActions,
  type SongCardInput,
  type SongCardRequest,
  type SongSelection,
} from './songTypes';
import {
  createSubmissionRecovery,
  submissionWasRejected,
} from './useSubmissionRecovery';
const useRecovery = createSubmissionRecovery<{
  body: SongCardRequest;
  key: string;
  selection: Exclude<SongSelection, null>;
}>();
export function useSongCardWriting(
  actions: SongCardActions,
  sourceNightId: string | undefined,
  onBack: () => void,
  onDone: () => void,
) {
  const [draft, setDraft] = useState(() => actions.readDraft());
  const [step, setStep] = useState<'write' | 'support' | 'complete'>('write');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const recovery = useRecovery(actions, sourceNightId);
  const active = useRef(true),
    request = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current?.abort();
      request.current = null;
    };
  }, []);
  const length = trimmedLength(draft.recommendation);
  const valid =
    !!draft.category_id &&
    validSelection(draft.selection) &&
    length > 0 &&
    length <= PREVIEW_RECOMMENDATION_LIMIT;
  const blocked =
    error?.code === 'WRITING_ENTRY_REQUIRED' ||
    error?.code === 'IDEMPOTENCY_CONFLICT';
  function update(value: Partial<SongCardInput>) {
    if (!active.current || request.current || step !== 'write') return;
    setDraft(actions.writeDraft({ ...draft, ...value }));
    setError(null);
  }
  const selection = draft.selection;
  const body: SongCardRequest | null = selection
    ? {
        kind: 'song',
        category_id: draft.category_id!,
        ...(sourceNightId === undefined
          ? {}
          : { source_night_id: sourceNightId }),
        content: {
          recommendation: draft.recommendation.trim(),
          ...(selection.mode === 'search'
            ? { track_id: selection.track.id }
            : {
                manual_track: {
                  title: selection.title.trim(),
                  artist: selection.artist.trim(),
                },
              }),
        },
      }
    : null;
  const recoveryChanged =
    recovery.value !== null &&
    JSON.stringify(body) !== JSON.stringify(recovery.value.body);
  async function submit(recover = false) {
    if (!active.current || request.current || step !== 'write') return;
    if (recover ? !recovery.value : !valid || blocked || recoveryChanged)
      return;
    let submission = recovery.value;
    if (!submission) {
      if (!body || !selection) return;
      submission = {
        body,
        key: draft.operationKey,
        selection:
          selection.mode === 'search'
            ? { mode: 'search', track: { ...selection.track } }
            : { ...selection },
      };
    }
    const original = submission.body;
    const expected = submission.selection;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError(null);
    recovery.remember(submission);
    try {
      const receipt = await actions.submit(
        original,
        submission.key,
        controller.signal,
      );
      if (
        !active.current ||
        controller.signal.aborted ||
        request.current !== controller
      )
        return;
      const track = receipt?.content?.track;
      if (
        !receipt?.id?.trim() ||
        receipt.kind !== 'song' ||
        receipt.category_id !== original.category_id ||
        receipt.moderation_status !== 'pending' ||
        receipt.content?.recommendation !== original.content.recommendation ||
        !track?.id?.trim() ||
        (expected.mode === 'search'
          ? track.id !== expected.track.id ||
            track.title !== expected.track.title ||
            track.artist !== expected.track.artist
          : track.title !== expected.title.trim() ||
            track.artist !== expected.artist.trim())
      )
        throw new ApiError('invalid-response');
      recovery.clear(submission);
      setStep('complete');
    } catch (e) {
      if (
        !active.current ||
        controller.signal.aborted ||
        request.current !== controller
      )
        return;
      const problem = e instanceof ApiError ? e : new ApiError('network');
      if (submissionWasRejected(problem)) recovery.clear(submission);
      setError(problem);
      if (problem.code === 'SUPPORT_RECOMMENDED') setStep('support');
    } finally {
      if (request.current === controller) {
        request.current = null;
        setPending(false);
      }
    }
  }
  function back() {
    if (request.current || !active.current) return;
    if (step === 'complete') {
      active.current = false;
      onDone();
    } else if (step === 'support') {
      setError(null);
      setStep('write');
    } else {
      active.current = false;
      onBack();
    }
  }
  return {
    draft,
    step,
    pending,
    error,
    valid,
    recoveryChanged,
    originalSubmission: recovery.value,
    recover: () => void submit(true),
    blocked,
    length,
    update,
    submit,
    back,
    returnToDraft: () => {
      setError(null);
      setStep('write');
    },
  };
}
