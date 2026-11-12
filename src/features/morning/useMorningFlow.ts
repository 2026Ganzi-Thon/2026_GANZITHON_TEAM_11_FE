import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { ApiError } from '../../api/errors';
import type { Morning, MorningActions, MorningCandidate, Sheep } from './types';

export const canAdopt = (candidate: MorningCandidate) =>
  candidate.can_adopt &&
  candidate.card.available &&
  candidate.card.content !== null;
type Failure = 'morning' | 'save' | 'refresh' | 'flock' | null;
const refreshCodes = new Set([
  'ADOPTION_ALREADY_FINALIZED',
  'CARD_UNAVAILABLE',
  'NO_ADOPTION_CANDIDATE',
  'INVALID_ADOPTION_CARD',
  'MORNING_NOT_OPEN',
]);

export function useMorningFlow(actions: MorningActions, onExit: () => void) {
  const [api] = useState(() => actions);
  const [morning, setMorning] = useState<Morning | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState<'adoption' | 'home'>('adoption');
  const [confirmed, setConfirmed] = useState<Sheep | null>(null);
  const [newId, setNewId] = useState<string | null>(null);
  const [flock, setFlock] = useState<Sheep[]>([]);
  const [busy, setBusy] = useState(true);
  const [failure, setFailure] = useState<Failure>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const closed = useRef(false);

  const run = useCallback(
    async (job: (signal: AbortSignal) => Promise<void>) => {
      if (active.current || closed.current) return;
      const controller = new AbortController();
      active.current = controller;
      setBusy(true);
      setFailure(null);
      try {
        await job(controller.signal);
      } finally {
        if (active.current === controller) active.current = null;
        if (!controller.signal.aborted) setBusy(false);
      }
    },
    [],
  );

  const readFlock = useCallback(
    async (signal: AbortSignal) => {
      try {
        const items = await api.loadFlock(signal);
        if (!signal.aborted) setFlock(items);
      } catch {
        if (!signal.aborted) setFailure('flock');
      }
    },
    [api],
  );

  const readMorning = useCallback(
    async (signal: AbortSignal, reconciling = false) => {
      try {
        const result = await api.loadMorning(signal);
        if (signal.aborted) return;
        setMorning(result);
        setSelectedId((previous) => {
          const eligible = result.candidate_cards.filter(canAdopt);
          if (reconciling && eligible.some((item) => item.card.id === previous))
            return previous;
          return eligible.some(
            (item) => item.card.id === result.default_card_id,
          )
            ? result.default_card_id
            : null;
        });
        if (result.adoption) {
          setConfirmed(result.adoption);
          setPage('home');
          await readFlock(signal);
        }
      } catch {
        if (!signal.aborted) setFailure(reconciling ? 'refresh' : 'morning');
      }
    },
    [api, readFlock],
  );

  useEffect(() => {
    closed.current = false;
    void run((signal) => readMorning(signal));
    return () => {
      closed.current = true;
      active.current?.abort();
      active.current = null;
    };
  }, [readMorning, run]);

  const exit = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    active.current?.abort();
    onExit();
  }, [onExit]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        exit();
        return true;
      },
    );
    return () => subscription.remove();
  }, [exit]);

  const selected =
    morning?.candidate_cards.find(
      (item) => item.card.id === selectedId && canAdopt(item),
    ) ?? null;
  const select = (id: string) => {
    if (active.current || closed.current || failure === 'refresh') return;
    if (
      morning?.candidate_cards.some(
        (item) => item.card.id === id && canAdopt(item),
      )
    ) {
      setSelectedId(id);
      setFailure(null);
    }
  };
  const adopt = () => {
    if (!morning?.night || !selected || confirmed || failure === 'refresh')
      return;
    const nightId = morning.night.id;
    const cardId = selected.card.id;
    void run(async (signal) => {
      try {
        const saved = await api.adopt(nightId, cardId, signal);
        if (signal.aborted) return;
        setConfirmed(saved);
        setNewId(saved.id);
        setPage('home');
        setNotice(null);
        await readFlock(signal);
      } catch (error) {
        if (signal.aborted) return;
        if (
          error instanceof ApiError &&
          error.kind === 'http' &&
          refreshCodes.has(error.code ?? '')
        ) {
          setNotice('양의 정보가 바뀌어 다시 확인했어요.');
          await readMorning(signal, true);
        } else setFailure('save');
      }
    });
  };
  const retryMorning = () => {
    void run((signal) => readMorning(signal, failure === 'refresh'));
  };
  const openFlock = () => {
    if (active.current || closed.current) return;
    setPage('home');
    void run(readFlock);
  };
  // Preserve server order; a confirmed write may precede its appearance in the list.
  const items = [
    ...(confirmed && !flock.some((item) => item.id === confirmed.id)
      ? [confirmed]
      : []),
    ...flock,
  ];
  const unique = items
    .filter(
      (item, index) =>
        items.findIndex((other) => other.id === item.id) === index,
    )
    .map((item) => (item.id === confirmed?.id ? confirmed : item));
  return {
    morning,
    selected,
    page,
    newId,
    items: unique,
    busy,
    failure,
    notice,
    select,
    adopt,
    exit,
    retryMorning,
    openFlock,
  };
}
