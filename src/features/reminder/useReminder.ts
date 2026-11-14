import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../api/errors';
import {
  formatLocalTime,
  parseLocalTime,
  sameReminder,
  validReminder,
  type TimeParts,
} from './time';
import type { Reminder, ReminderActions, ReminderPermission } from './types';
type Phase =
  'loading' | 'load-error' | 'edit' | 'saving' | 'uncertain' | 'saved';
export function useReminder(actions: ReminderActions, onBack: () => void) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState<TimeParts>({
    period: 1,
    hour: 11,
    minute: 0,
  });
  const [target, setTarget] = useState<Reminder | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0),
    [permissionAttempt, setPermissionAttempt] = useState(0);
  const [permission, setPermission] = useState<ReminderPermission | 'loading'>(
    'loading',
  );
  const request = useRef<AbortController | null>(null),
    permissionRequest = useRef<AbortController | null>(null);
  const closed = useRef(false);
  useEffect(() => {
    closed.current = false;
    const controller = new AbortController();
    request.current = controller;
    void Promise.resolve()
      .then(() => {
        if (!controller.signal.aborted) return actions.load(controller.signal);
      })
      .then((value) => {
        if (controller.signal.aborted || closed.current) return;
        if (!validReminder(value)) throw new ApiError('invalid-response');
        setEnabled(value.enabled);
        setTime(
          parseLocalTime(value.local_time) ?? {
            period: 1,
            hour: 11,
            minute: 0,
          },
        );
        setPhase('edit');
      })
      .catch(() => {
        if (!controller.signal.aborted && !closed.current)
          setPhase('load-error');
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
  useEffect(() => {
    const controller = new AbortController();
    permissionRequest.current = controller;
    void Promise.resolve()
      .then(() => {
        if (!controller.signal.aborted) {
          setPermission('loading');
          return actions.readPermission(controller.signal);
        }
      })
      .then((value) => {
        if (controller.signal.aborted || closed.current) return;
        setPermission(
          value &&
            ['granted', 'denied', 'undetermined', 'unknown'].includes(value)
            ? value
            : 'unknown',
        );
      })
      .catch(() => {
        if (!controller.signal.aborted && !closed.current)
          setPermission('unknown');
      })
      .finally(() => {
        if (permissionRequest.current === controller)
          permissionRequest.current = null;
      });
    return () => {
      controller.abort();
    };
  }, [actions, permissionAttempt]);
  async function save() {
    if (
      request.current ||
      closed.current ||
      !['edit', 'uncertain'].includes(phase)
    )
      return;
    const next =
      phase === 'uncertain'
        ? target
        : { enabled, local_time: enabled ? formatLocalTime(time) : null };
    if (!validReminder(next)) {
      setMessage('15분 단위의 올바른 시간을 선택해 주세요.');
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setTarget({ ...next });
    setMessage(null);
    setPhase('saving');
    try {
      const result = await actions.save({ ...next }, controller.signal);
      if (controller.signal.aborted || closed.current) return;
      if (!validReminder(result) || !sameReminder(result, next))
        throw new ApiError('invalid-response');
      setTarget({ ...result });
      setPhase('saved');
    } catch (error) {
      if (controller.signal.aborted || closed.current) return;
      if (error instanceof ApiError && error.status === 422) {
        setMessage(
          '설정을 저장하지 못했어요. 선택한 시간은 그대로예요. 다시 확인해 주세요.',
        );
        setPhase('edit');
      } else setPhase('uncertain');
    } finally {
      if (request.current === controller) request.current = null;
    }
  }
  return {
    phase,
    enabled,
    time,
    target,
    message,
    permission,
    save,
    setEnabled: (value: boolean) => {
      if (phase === 'edit' && !request.current && !closed.current) {
        setEnabled(value);
        setMessage(null);
      }
    },
    change: (part: keyof TimeParts, value: number) => {
      if (phase === 'edit' && enabled && !request.current && !closed.current) {
        const next = { ...time, [part]: value };
        if (formatLocalTime(next)) {
          setTime(next);
          setMessage(null);
        }
      }
    },
    retryLoad: () => {
      if (!request.current && !closed.current) {
        setPhase('loading');
        setAttempt((v) => v + 1);
      }
    },
    retryPermission: () => {
      if (!permissionRequest.current && !closed.current)
        setPermissionAttempt((v) => v + 1);
    },
    back: () => {
      if (closed.current || (phase === 'saving' && request.current)) return;
      closed.current = true;
      request.current?.abort();
      permissionRequest.current?.abort();
      onBack();
    },
  };
}
