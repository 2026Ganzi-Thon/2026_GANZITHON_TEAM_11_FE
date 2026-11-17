import type { BirthDateResult } from '../birthDate/types';
import type { HomeSource } from '../home/types';
import { readHomeSnapshot } from '../home/model';
import type { ReminderActions } from '../reminder/types';
import {
  formatLocalTime,
  parseLocalTime,
  sameReminder,
  type TimeParts,
} from '../reminder/time';
import type { ReminderDeviceConnection } from '../../notifications/connection';
import type { Registration } from './types';
export type OnboardingReminder = Pick<ReminderActions, 'load' | 'save'> & {
  device: ReminderDeviceConnection;
};
type Retry = 'allow' | 'skip' | 'device' | 'clock' | null;
interface State {
  stage: 'signup' | 'choice' | 'time' | 'intro' | 'home';
  home: HomeSource | null;
  localTime: string;
  draftTime: TimeParts;
  intent: 'allow' | 'skip';
  busy: boolean;
  progress: string;
  error: string;
  retry: Retry;
}
/** One memory-only account journey. Device and account work share the app's connection. */
export function createSignupOnboarding(
  reminder: OnboardingReminder,
  createHome: (
    registration: Registration,
    birth: BirthDateResult,
  ) => HomeSource,
) {
  const initial: State = {
    stage: 'signup',
    home: null,
    localTime: '23:00',
    draftTime: parseLocalTime('23:00')!,
    intent: 'skip',
    busy: false,
    progress: '',
    error: '',
    retry: null,
  };
  let state = { ...initial };
  let active = true,
    disposed = false,
    version = 0,
    pending: AbortController | null = null;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<State>) => {
    state = { ...state, ...patch };
    listeners.forEach((fn) => fn());
  };
  function run(
    retry: Retry,
    job: (signal: AbortSignal, current: () => boolean) => Promise<void>,
  ) {
    if (!active || state.busy || state.stage !== 'choice') return;
    const request = new AbortController(),
      token = ++version;
    pending = request;
    const current = () =>
      active && token === version && !request.signal.aborted;
    publish({ busy: true, error: '', retry, progress: '알림 확인 중' });
    void job(request.signal, current)
      .catch(() => {
        if (current())
          publish({
            error:
              retry === 'clock'
                ? '가입은 완료됐지만 현재 시간을 확인하지 못했어요. 시간 확인만 다시 시도해 주세요.'
                : '알림 설정 결과를 확인하지 못했어요. 같은 설정으로 다시 확인해 주세요.',
          });
      })
      .finally(() => {
        if (current()) {
          pending = null;
          publish({ busy: false, progress: '' });
        }
      });
  }
  async function destination(signal: AbortSignal, current: () => boolean) {
    publish({ retry: 'clock', progress: '시간 확인 중' });
    try {
      const snapshot = readHomeSnapshot(await state.home!.clock.load(signal));
      if (current())
        publish({
          stage: snapshot.phase === 'day' ? 'intro' : 'home',
          retry: null,
          error: '',
        });
    } catch {
      if (current())
        publish({
          error:
            '가입은 완료됐지만 현재 시간을 확인하지 못했어요. 시간 확인만 다시 시도해 주세요.',
        });
    }
  }
  async function verify(signal: AbortSignal, current: () => boolean) {
    if (!current()) return;
    const device = reminder.device.getSnapshot();
    const ready =
      device.phase === 'ready' &&
      (state.intent === 'skip'
        ? device.state?.state === 'off'
        : device.state?.state === 'scheduled' &&
          device.state.localTime === state.localTime);
    if (!ready) {
      const permission =
        device.phase === 'ready' &&
        device.state?.state === 'permission-required';
      publish({
        retry: permission ? 'allow' : 'device',
        error: permission
          ? '알림 시간은 저장했지만 기기 알림 권한이 꺼져 있어요. 권한을 켜거나 알림 없이 계속할 수 있어요.'
          : '계정 알림 설정은 저장했지만 기기 예약·취소를 확인하지 못했어요. 기기 알림을 다시 확인해 주세요.',
      });
      return;
    }
    await destination(signal, current);
  }
  function save(intent: State['intent']) {
    if (!active || state.busy || state.stage !== 'choice') return;
    publish({ intent });
    run(intent === 'allow' ? 'allow' : 'skip', async (signal, current) => {
      if (intent === 'allow') {
        publish({ progress: '기기 알림 권한 확인 중' });
        await reminder.device.requestPermission();
        if (!current()) return;
      }
      publish({
        progress: intent === 'allow' ? '알림 저장·예약 중' : '알림 끄는 중',
      });
      const target =
        intent === 'allow'
          ? { enabled: true, local_time: state.localTime }
          : { enabled: false, local_time: null };
      const result = await reminder.save(target, signal);
      if (!current()) return;
      if (!sameReminder(result, target))
        throw new Error('Invalid reminder receipt');
      await verify(signal, current);
    });
  }
  const c = {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    reminder,
    start: () => {
      if (!disposed) active = true;
    },
    stop: () => {
      active = false;
      ++version;
      pending?.abort();
      pending = null;
      if (state.busy)
        publish({
          busy: false,
          progress: '',
          error: '확인이 중단됐어요. 같은 설정으로 다시 확인해 주세요.',
        });
    },
    dispose: () => {
      c.stop();
      disposed = true;
      state = { ...initial };
      listeners.clear();
    },
    begin: (registration: Registration, birth: BirthDateResult) => {
      if (!active || state.stage !== 'signup') return;
      publish({ home: createHome(registration, birth), stage: 'choice' });
    },
    openTime: () => {
      if (!state.busy && state.stage === 'choice' && state.retry !== 'clock')
        publish({ stage: 'time', draftTime: parseLocalTime(state.localTime)! });
    },
    changeTime: (part: keyof TimeParts, value: number) => {
      if (state.stage === 'time' && !state.busy) {
        const next = { ...state.draftTime, [part]: value };
        if (formatLocalTime(next)) publish({ draftTime: next });
      }
    },
    confirmTime: () => {
      if (state.stage === 'time') {
        const value = formatLocalTime(state.draftTime);
        if (value)
          publish({
            localTime: value,
            stage: 'choice',
            error: '',
            retry: null,
          });
      }
    },
    back: () => {
      if (!state.busy && state.stage === 'time') publish({ stage: 'choice' });
    },
    allow: () => save('allow'),
    skip: () => save('skip'),
    retry: () => {
      if (state.retry === 'clock') run('clock', destination);
      else if (state.retry === 'device')
        run('device', async (signal, current) => {
          await reminder.device.refresh();
          if (current()) await verify(signal, current);
        });
      else save(state.retry === 'skip' ? 'skip' : 'allow');
    },
    openSettings: () =>
      run(state.retry, async (_signal, current) => {
        await reminder.device.openSettings();
        if (current())
          publish({
            error:
              '기기 설정에서 알림 권한을 켠 뒤 알림 허용을 다시 눌러 주세요.',
          });
      }),
    acknowledge: () => {
      if (!state.busy && state.stage === 'intro') publish({ stage: 'home' });
    },
  };
  return c;
}
export type SignupOnboarding = ReturnType<typeof createSignupOnboarding>;
