import { useEffect, useRef, useState } from 'react';
import { AppState, Keyboard } from 'react-native';
import { ApiError } from '../../../api/errors';
import {
  assertResetAccepted,
  emailIssue,
  normalizeEmail,
  retryDeadline,
  type PasswordResetActions,
} from './model';

export function usePasswordReset(
  actions: PasswordResetActions,
  initialEmail: string,
  onLogin: (email: string) => void,
) {
  const [email, setEmail] = useState(initialEmail),
    [confirmedEmail, setConfirmedEmail] = useState('');
  const [page, setPage] = useState<'request' | 'sent'>('request'),
    [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState<string>(),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [deadline, setDeadline] = useState(0),
    [clock, setClock] = useState(Date.now);
  const active = useRef<AbortController | null>(null),
    exited = useRef(false);
  const remaining = Math.max(0, Math.ceil((deadline - clock) / 1000));
  const stop = () => {
    active.current?.abort();
    active.current = null;
  };
  useEffect(() => {
    exited.current = false;
    return () => {
      exited.current = true;
      active.current?.abort();
      active.current = null;
    };
  }, []);
  useEffect(() => {
    if (!deadline) return;
    const refresh = () => {
      const now = Date.now();
      setClock(now);
      if (now >= deadline) setDeadline(0);
    };
    const timer = setInterval(refresh, 1000);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, [deadline]);
  const login = () => {
    if (exited.current) return;
    exited.current = true;
    stop();
    Keyboard.dismiss();
    onLogin(email);
  };
  const back = () => {
    if (page === 'request') {
      login();
      return;
    }
    stop();
    setPending(false);
    setPage('request');
    setError('');
    setFieldError(undefined);
    setNotice('');
  };
  const send = async () => {
    if (active.current || exited.current || Date.now() < deadline) return;
    setError('');
    setNotice('');
    const issue = emailIssue(email);
    setFieldError(issue);
    if (issue) return;
    const controller = new AbortController();
    active.current = controller;
    setPending(true);
    Keyboard.dismiss();
    const snapshot = normalizeEmail(email);
    try {
      const receipt = await actions.request(snapshot, controller.signal);
      if (
        controller.signal.aborted ||
        active.current !== controller ||
        exited.current
      )
        return;
      assertResetAccepted(receipt);
      setConfirmedEmail(snapshot);
      setPage('sent');
      if (page === 'sent') setNotice('재설정 메일을 다시 요청했어요.');
    } catch (value) {
      if (
        controller.signal.aborted ||
        active.current !== controller ||
        exited.current
      )
        return;
      if (
        value instanceof ApiError &&
        value.kind === 'http' &&
        value.status === 429
      ) {
        const now = Date.now();
        setClock(now);
        setDeadline(retryDeadline(value.retryAfter, now) ?? 0);
        setError('요청이 많아요. 잠시 후 다시 시도해 주세요.');
      } else if (
        value instanceof ApiError &&
        value.kind === 'http' &&
        value.status === 422
      ) {
        setPage('request');
        setFieldError('이메일 주소를 확인해 주세요.');
      } else
        setError(
          page === 'sent'
            ? '다시 요청을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.'
            : '요청을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',
        );
    } finally {
      if (active.current === controller) {
        active.current = null;
        if (!exited.current) setPending(false);
      }
    }
  };
  const edit = (value: string) => {
    if (active.current || exited.current) return;
    setEmail(value);
    setFieldError(undefined);
    setError('');
    setNotice('');
  };
  return {
    page,
    email,
    confirmedEmail,
    pending,
    fieldError,
    error,
    notice,
    remaining,
    send,
    edit,
    back,
    login,
  };
}
