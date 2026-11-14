import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../api/errors';
import {
  PREVIEW_TEXT_CARD_LIMIT,
  textCardLength,
  type TextCardDraft,
} from '../cards/types';
import type {
  MyCardResubmitActions,
  RejectedTextCard,
  TextCardResubmitRequest,
} from './types';

export function useTextCardResubmit(
  item: RejectedTextCard,
  actions: MyCardResubmitActions,
  onClose: () => void,
) {
  const [draft, setDraft] = useState(() => actions.readDraft(item));
  const [step, setStep] = useState<'write' | 'support' | 'complete'>('write');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const request = useRef<AbortController | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current?.abort();
      request.current = null;
    };
  }, []);
  const length = textCardLength(draft.text);
  const blocked =
    item.moderation_status !== 'rejected' ||
    error?.status === 404 ||
    error?.code === 'CARD_NOT_REJECTED' ||
    error?.code === 'IDEMPOTENCY_CONFLICT';
  const valid =
    !!draft.category_id && length > 0 && length <= PREVIEW_TEXT_CARD_LIMIT;
  function update(value: Partial<Pick<TextCardDraft, 'category_id' | 'text'>>) {
    if (!active.current || request.current || step !== 'write' || blocked)
      return;
    setDraft(actions.writeDraft(item.id, { ...draft, ...value }));
    setError(null);
  }
  async function submit() {
    if (
      !active.current ||
      request.current ||
      !valid ||
      blocked ||
      step !== 'write'
    )
      return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError(null);
    const body: TextCardResubmitRequest = {
      kind: 'text',
      category_id: draft.category_id!,
      content: { text: draft.text.trim() },
    };
    try {
      const receipt = await actions.resubmit(
        item.id,
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
      if (
        receipt?.id !== item.id ||
        receipt.kind !== 'text' ||
        receipt.category_id !== body.category_id ||
        receipt.content?.text !== body.content.text ||
        receipt.moderation_status !== 'pending'
      )
        throw new ApiError('invalid-response');
      actions.clearDraft(item.id);
      setStep('complete');
    } catch (value) {
      if (
        !active.current ||
        controller.signal.aborted ||
        request.current !== controller
      )
        return;
      const problem =
        value instanceof ApiError ? value : new ApiError('network');
      setError(problem);
      if (problem.code === 'SUPPORT_RECOMMENDED') setStep('support');
    } finally {
      if (request.current === controller) {
        request.current = null;
        setPending(false);
      }
    }
  }
  return {
    draft,
    step,
    pending,
    error,
    blocked,
    valid,
    length,
    update,
    submit,
    close: () => {
      if (request.current || !active.current) return;
      active.current = false;
      onClose();
    },
    returnToDraft: () => {
      setError(null);
      setStep('write');
    },
  };
}
