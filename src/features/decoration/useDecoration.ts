import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../api/errors';
import { clampPlacement, readDecoration, samePlacements } from './model';
import type {
  DecoratedSheep,
  DecorationActions,
  DecorationData,
  DecorationWrite,
  Placement,
} from './types';
type Phase =
  | 'loading'
  | 'load-error'
  | 'edit'
  | 'saving'
  | 'verify'
  | 'checking'
  | 'conflict'
  | 'day-only'
  | 'saved';
export function useDecoration(
  id: string,
  actions: DecorationActions,
  onSaved: (sheep: DecoratedSheep) => void,
  onBack: () => void,
) {
  const [data, setData] = useState<DecorationData | null>(null),
    [draft, setDraft] = useState<Placement[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [phase, setPhase] = useState<Phase>('loading'),
    [discard, setDiscard] = useState(false),
    [notice, setNotice] = useState('');
  const active = useRef<AbortController | null>(null),
    closed = useRef(false),
    sequence = useRef(0),
    write = useRef<DecorationWrite | null>(null),
    latest = useRef<DecorationData | null>(null);
  const begin = () => {
    if (active.current || closed.current) return null;
    const c = new AbortController();
    active.current = c;
    return c;
  };
  const current = (c: AbortController) =>
    !closed.current && !c.signal.aborted && active.current === c;
  const finish = (c: AbortController) => {
    if (active.current === c) active.current = null;
  };
  const accept = (value: DecorationData) => {
    setData(value);
    setDraft(value.sheep.placements);
    setSelected(null);
    setPhase('edit');
  };
  const initial = async () => {
    const c = begin();
    if (!c) return;
    try {
      const value = readDecoration(await actions.load(id, c.signal), id);
      if (current(c)) accept(value);
    } catch {
      if (current(c)) setPhase('load-error');
    } finally {
      finish(c);
    }
  };
  useEffect(() => {
    closed.current = false;
    void Promise.resolve().then(() => {
      if (!closed.current) void initial();
    });
    return () => {
      closed.current = true;
      active.current?.abort();
      active.current = null;
    }; // source identity is keyed by the screen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const complete = (sheep: DecoratedSheep) => {
    setPhase('saved');
    setData((d) => (d ? { ...d, sheep } : d));
    setDraft(sheep.placements);
    write.current = null;
    onSaved(sheep);
  };
  const save = async () => {
    if (
      phase !== 'edit' ||
      !data ||
      samePlacements(data.sheep.placements, draft)
    )
      return;
    const c = begin();
    if (!c) return;
    const input = {
      if_version: data.sheep.version,
      placements: draft.map((p) => ({ ...p })),
    };
    write.current = input;
    setNotice('');
    setPhase('saving');
    try {
      const value = readDecoration(
        {
          sheep: await actions.save(id, input, c.signal),
          stickers: data.stickers,
        },
        id,
      );
      if (!current(c)) return;
      if (
        value.sheep.version !== input.if_version + 1 ||
        value.sheep.night_id !== data.sheep.night_id ||
        value.sheep.card_id !== data.sheep.card_id ||
        !samePlacements(value.sheep.placements, input.placements)
      )
        throw new ApiError('invalid-response');
      complete(value.sheep);
    } catch (error) {
      if (current(c))
        setPhase(
          error instanceof ApiError && error.code === 'DAY_ONLY'
            ? 'day-only'
            : 'verify',
        );
    } finally {
      finish(c);
    }
  };
  const verify = async () => {
    if (!data || !write.current) return;
    const c = begin();
    if (!c) return;
    setPhase('checking');
    try {
      const value = readDecoration(await actions.load(id, c.signal), id);
      if (!current(c)) return;
      if (
        value.sheep.night_id !== data.sheep.night_id ||
        value.sheep.card_id !== data.sheep.card_id
      )
        throw new ApiError('invalid-response');
      if (
        value.sheep.version > write.current.if_version &&
        samePlacements(value.sheep.placements, write.current.placements)
      )
        complete(value.sheep);
      else if (
        value.sheep.version === write.current.if_version &&
        samePlacements(value.sheep.placements, data.sheep.placements)
      ) {
        setData(value);
        write.current = null;
        setPhase('edit');
        setNotice(
          '아직 저장되지 않았어요. 편집한 내용을 다시 저장할 수 있어요.',
        );
      } else {
        latest.current = value;
        setPhase('conflict');
      }
    } catch {
      if (current(c)) setPhase('verify');
    } finally {
      finish(c);
    }
  };
  const reload = () => {
    if (phase !== 'conflict' || !latest.current) return;
    accept(latest.current);
    write.current = null;
    latest.current = null;
  };
  const add = (stickerId: string, x = 0.5, y = 0.5) => {
    if (
      active.current ||
      closed.current ||
      phase !== 'edit' ||
      !data?.stickers.some((st) => st.id === stickerId)
    )
      return;
    const instance_id = `placement-${Date.now()}-${++sequence.current}`;
    setDraft((old) =>
      old.length >= 20
        ? old
        : [
            ...old,
            clampPlacement({
              instance_id,
              sticker_id: stickerId,
              x,
              y,
              rotation: 0,
              scale: 1,
            }),
          ],
    );
    setSelected(instance_id);
  };
  const change = (
    instanceId: string,
    patch: Partial<Pick<Placement, 'x' | 'y' | 'rotation' | 'scale'>>,
  ) => {
    if (active.current || closed.current || phase !== 'edit') return;
    setDraft((old) =>
      old.map((p) =>
        p.instance_id === instanceId ? clampPlacement({ ...p, ...patch }) : p,
      ),
    );
  };
  const remove = () => {
    if (active.current || closed.current || phase !== 'edit') return;
    setDraft((old) => old.filter((p) => p.instance_id !== selected));
    setSelected(null);
  };
  const dirty = !!data && !samePlacements(data.sheep.placements, draft);
  const back = () => {
    if (active.current && phase !== 'loading') return;
    if (dirty && phase !== 'saved') {
      setDiscard(true);
      return;
    }
    closed.current = true;
    active.current?.abort();
    onBack();
  };
  const leave = () => {
    closed.current = true;
    active.current?.abort();
    onBack();
  };
  return {
    data,
    draft,
    selected,
    setSelected,
    phase,
    dirty,
    notice,
    discard,
    setDiscard,
    add,
    change,
    remove,
    save,
    verify,
    reload,
    initial: () => {
      setPhase('loading');
      void initial();
    },
    back,
    leave,
  };
}
