import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../api/errors';
import {
  PREVIEW_TEXT_CARD_LIMIT,
  textCardLength,
  type TextCardActions,
  type TextCardDraft,
  type TextCardRequest,
} from './types';
type Step = 'category' | 'write' | 'support' | 'complete';
export function useTextCardWriting(
  actions: TextCardActions,
  sourceNightId: string | undefined,
  onBack: () => void,
  onDone: () => void,
  externalCategory = false,
) {
  const [draft, setDraft] = useState(() => actions.readDraft());
  const [step, setStep] = useState<Step>(() =>
    actions.readDraft().category_id ? 'write' : 'category',
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const active = useRef<AbortController | null>(null);
  const closed = useRef(false);
  useEffect(() => {
    closed.current = false;
    return () => {
      closed.current = true;
      active.current?.abort();
      active.current = null;
    };
  }, []);
  const cancel = useCallback(() => {
    active.current?.abort();
    active.current = null;
    setPending(false);
  }, []);
  const back = useCallback(() => {
    cancel();
    setError(null);
    if (step === 'complete') {
      onDone();
      return;
    }
    if (step === 'support') {
      setStep('write');
      return;
    }
    if (step === 'write') {
      if (externalCategory) {
        onBack();
        return;
      }
      setStep('category');
      return;
    }
    onBack();
  }, [cancel, step, onBack, onDone, externalCategory]);
  function update(value: Partial<Pick<TextCardDraft, 'category_id' | 'text'>>) {
    if (active.current) return;
    setDraft(actions.writeDraft({ ...draft, ...value }));
    setError(null);
  }
  const length = textCardLength(draft.text);
  const valid =
    !!draft.category_id && length > 0 && length <= PREVIEW_TEXT_CARD_LIMIT;
  async function submit() {
    if (active.current || !valid || closed.current || step !== 'write') return;
    const controller = new AbortController();
    active.current = controller;
    setPending(true);
    setError(null);
    const request: TextCardRequest = {
      kind: 'text',
      category_id: draft.category_id!,
      content: { text: draft.text.trim() },
      ...(sourceNightId === undefined
        ? {}
        : { source_night_id: sourceNightId }),
    };
    try {
      const receipt = await actions.submit(
        request,
        draft.operationKey,
        controller.signal,
      );
      if (
        closed.current ||
        controller.signal.aborted ||
        active.current !== controller
      )
        return;
      if (
        !receipt?.id ||
        receipt.kind !== 'text' ||
        receipt.category_id !== request.category_id ||
        receipt.content?.text !== request.content.text ||
        receipt.moderation_status !== 'pending'
      )
        throw new ApiError('invalid-response');
      setStep('complete');
    } catch (value) {
      if (
        closed.current ||
        controller.signal.aborted ||
        active.current !== controller
      )
        return;
      const problem =
        value instanceof ApiError ? value : new ApiError('network');
      setError(problem);
      if (problem.code === 'SUPPORT_RECOMMENDED') setStep('support');
    } finally {
      if (active.current === controller) {
        active.current = null;
        setPending(false);
      }
    }
  }
  return {
    draft,
    step,
    pending,
    error,
    length,
    valid,
    update,
    submit,
    back,
    next: () => {
      if (draft.category_id) setStep('write');
    },
    returnToDraft: () => {
      setError(null);
      setStep('write');
    },
  };
}
