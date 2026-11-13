import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../api/errors';
import {
  PREVIEW_RECOMMENDATION_LIMIT,
  trimmedLength,
  validSelection,
  type SongCardActions,
  type SongCardInput,
  type SongCardRequest,
} from './songTypes';
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
  async function submit() {
    if (
      !active.current ||
      request.current ||
      !valid ||
      blocked ||
      step !== 'write' ||
      !draft.selection
    )
      return;
    const selection = draft.selection;
    const body: SongCardRequest = {
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
    };
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError(null);
    try {
      const receipt = await actions.submit(
        body,
        draft.operationKey,
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
        receipt.category_id !== body.category_id ||
        receipt.moderation_status !== 'pending' ||
        receipt.content?.recommendation !== body.content.recommendation ||
        !track?.id?.trim() ||
        (selection.mode === 'search'
          ? track.id !== selection.track.id ||
            track.title !== selection.track.title ||
            track.artist !== selection.track.artist
          : track.title !== selection.title.trim() ||
            track.artist !== selection.artist.trim())
      )
        throw new ApiError('invalid-response');
      setStep('complete');
    } catch (e) {
      if (
        !active.current ||
        controller.signal.aborted ||
        request.current !== controller
      )
        return;
      const problem = e instanceof ApiError ? e : new ApiError('network');
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
