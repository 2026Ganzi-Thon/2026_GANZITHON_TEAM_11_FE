import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../api/errors';
import {
  birthDateError,
  formatDate,
  parseDate,
  withDatePart,
  type DateParts,
} from './date';
import {
  checkSnapshot,
  validBirthDateResult,
  type BirthDateActions,
  type BirthDateSnapshot,
  type BirthDateResult,
} from './types';
export type BirthDatePhase =
  | 'loading'
  | 'load-error'
  | 'edit'
  | 'confirm'
  | 'saving'
  | 'uncertain'
  | 'conflict'
  | 'conflict-error'
  | 'conflict-result'
  | 'saved';
export function useBirthDate(actions: BirthDateActions, onBack: () => void) {
  const [phase, setPhase] = useState<BirthDatePhase>('loading');
  const [snapshot, setSnapshot] = useState<BirthDateSnapshot | null>(null);
  const [draft, setDraft] = useState<DateParts | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [result, setResult] = useState<BirthDateResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [revision, setRevision] = useState(0),
    [attempt, setAttempt] = useState(0);
  const request = useRef<AbortController | null>(null),
    closed = useRef(false);
  useEffect(() => {
    closed.current = false;
    const controller = new AbortController();
    request.current = controller;
    void Promise.resolve()
      .then(() => {
        if (controller.signal.aborted) return;
        return actions.load(controller.signal);
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        if (!data) throw new ApiError('invalid-response');
        checkSnapshot(data);
        setSnapshot(data);
        setDraft(parseDate(data.birth_date));
        setPhase('edit');
      })
      .catch(() => {
        if (!controller.signal.aborted) setPhase('load-error');
      })
      .finally(() => {
        if (request.current === controller) request.current = null;
      });
    return () => {
      closed.current = true;
      controller.abort();
      request.current?.abort();
      request.current = null;
    };
  }, [actions, attempt]);
  async function reconcile() {
    if (request.current || closed.current) return;
    const controller = new AbortController();
    request.current = controller;
    setPhase('conflict');
    try {
      const latest = await actions.load(controller.signal);
      if (controller.signal.aborted) return;
      checkSnapshot(latest);
      setSnapshot(latest);
      if (latest.birth_date === target && latest.edits_remaining === 0) {
        setResult(latest);
        setPhase('saved');
      } else if (latest.edits_remaining === 0) setPhase('conflict-result');
      else {
        setMessage(
          '최신 변경 상태를 확인했어요. 선택한 날짜를 다시 확인해 주세요.',
        );
        setPhase('edit');
      }
    } catch {
      if (!controller.signal.aborted) setPhase('conflict-error');
    } finally {
      if (request.current === controller) request.current = null;
    }
  }
  async function save() {
    if (
      request.current ||
      closed.current ||
      !target ||
      !snapshot ||
      !['confirm', 'uncertain'].includes(phase)
    )
      return;
    const controller = new AbortController();
    request.current = controller;
    setPhase('saving');
    setMessage(null);
    try {
      const saved = await actions.save(target, controller.signal);
      if (controller.signal.aborted) return;
      const expected =
        target === snapshot.birth_date
          ? snapshot.edits_remaining
          : snapshot.edits_remaining - 1;
      if (
        !validBirthDateResult(saved) ||
        saved.birth_date !== target ||
        saved.edits_remaining !== expected
      )
        throw new ApiError('invalid-response');
      setResult(saved);
      setPhase('saved');
    } catch (error) {
      if (controller.signal.aborted) return;
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        error.code === 'BIRTH_DATE_EDIT_LIMIT'
      ) {
        if (request.current === controller) request.current = null;
        await reconcile();
      } else if (error instanceof ApiError && error.status === 422) {
        setMessage(
          error.code === 'AGE_NOT_ALLOWED'
            ? '선택한 생년월일로는 이용할 수 없어요. 날짜를 다시 확인해 주세요.'
            : '생년월일을 확인해 주세요. 선택한 날짜는 그대로예요.',
        );
        setPhase('edit');
      } else setPhase('uncertain');
    } finally {
      if (request.current === controller) request.current = null;
    }
  }
  return {
    phase,
    snapshot,
    draft,
    target,
    result,
    message,
    revision,
    change: (part: keyof DateParts, value: number) => {
      if (
        phase === 'edit' &&
        draft &&
        snapshot?.edits_remaining &&
        !request.current &&
        !closed.current
      ) {
        setDraft(withDatePart(draft, part, value));
        setMessage(null);
      }
    },
    confirm: () => {
      if (
        !draft ||
        !snapshot ||
        !snapshot.edits_remaining ||
        request.current ||
        closed.current
      )
        return;
      setRevision((v) => v + 1);
      const error = birthDateError(draft, snapshot.today);
      if (error) {
        setMessage(
          error === 'future'
            ? '미래의 날짜는 선택할 수 없어요.'
            : '실제로 존재하는 날짜를 선택해 주세요.',
        );
        return;
      }
      const value = formatDate(draft);
      if (value === snapshot.birth_date) return;
      setTarget(value);
      setMessage(null);
      setPhase('confirm');
    },
    edit: () => {
      if (!request.current && !closed.current && phase === 'confirm')
        setPhase('edit');
    },
    retryLoad: () => {
      if (!request.current && !closed.current) {
        setPhase('loading');
        setAttempt((v) => v + 1);
      }
    },
    save,
    reconcile,
    back: () => {
      if (phase === 'saving' && request.current) return;
      if (closed.current) return;
      closed.current = true;
      request.current?.abort();
      onBack();
    },
  };
}
