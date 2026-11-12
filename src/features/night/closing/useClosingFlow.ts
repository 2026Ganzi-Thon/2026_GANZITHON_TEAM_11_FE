import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type {
  ClosingActions,
  ClosingRequest,
  ClosingResult,
  WritingChoice,
} from './types';
type Job =
  | { kind: 'finish' }
  | { kind: 'view'; cardId: string }
  | { kind: 'choice'; choice: WritingChoice };
type State = {
  step: 'pending' | 'error' | 'card' | 'summary' | 'offer' | 'writing' | 'rest';
  job: Job;
  result: ClosingResult | null;
};
export function useClosingFlow(
  input: ClosingRequest,
  actions: ClosingActions,
  onExit: () => void,
) {
  // The operation owns a snapshot even if a parent rerenders while retrying.
  const [request] = useState(() => ({ ...input }));
  const [adapter] = useState(() => actions);
  const [state, setState] = useState<State>({
    step: 'pending',
    job: { kind: 'finish' },
    result: null,
  });
  const operationId = useId();
  const active = useRef<AbortController | null>(null);
  const exited = useRef(false);
  const busy = useRef(true);
  useEffect(() => {
    if (state.step !== 'pending') return;
    const controller = new AbortController();
    active.current = controller;
    const job = state.job;
    const key = `${operationId}:${job.kind}${job.kind === 'choice' ? `:${job.choice}` : ''}`;
    void (async () => {
      try {
        let result: ClosingResult | null = null;
        if (job.kind === 'finish')
          result = await adapter.finish(request, key, controller.signal);
        else if (job.kind === 'view')
          await adapter.markViewed(job.cardId, key, controller.signal);
        else await adapter.chooseWriting(job.choice, key, controller.signal);
        if (controller.signal.aborted || exited.current) return;
        busy.current = false;
        setState((previous) => ({
          ...previous,
          result: result ?? previous.result,
          step:
            job.kind === 'finish'
              ? request.reason === 'leave'
                ? 'card'
                : 'summary'
              : job.kind === 'view'
                ? 'summary'
                : job.choice === 'now'
                  ? 'writing'
                  : 'rest',
        }));
      } catch {
        if (controller.signal.aborted || exited.current) return;
        busy.current = false;
        setState((previous) => ({ ...previous, step: 'error' }));
      }
    })();
    return () => controller.abort();
  }, [adapter, operationId, request, state.job, state.step]);
  const submit = (job: Job) => {
    if (busy.current || exited.current) return;
    busy.current = true;
    setState((previous) => ({ ...previous, step: 'pending', job }));
  };
  const next = () => {
    if (busy.current || exited.current) return;
    if (state.step === 'card') {
      const card = state.result?.closing_card;
      if (card?.available && card.content)
        submit({ kind: 'view', cardId: card.id });
      else setState((previous) => ({ ...previous, step: 'summary' }));
    } else if (state.step === 'summary') {
      setState((previous) => ({
        ...previous,
        step:
          previous.result?.writing_offer.state === 'offered' ? 'offer' : 'rest',
      }));
    }
  };
  const exit = useCallback(() => {
    if (exited.current) return;
    exited.current = true;
    active.current?.abort();
    onExit();
  }, [onExit]);
  return {
    state,
    request,
    next,
    exit,
    retry: () => submit(state.job),
    choose: (choice: WritingChoice) => submit({ kind: 'choice', choice }),
  };
}
