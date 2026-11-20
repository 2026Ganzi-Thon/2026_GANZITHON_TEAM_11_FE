import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, BackHandler, ScrollView } from 'react-native';
import type { Bootstrap } from '../../api/contracts';
import { ApiError } from '../../api/errors';
import { SignupFlow } from '../signup/SignupFlow';
import { SignupReminderScreen } from '../signup/SignupReminderScreen';
import { DaySignupIntro } from '../signup/DaySignupIntro';
import { HomeFlow } from '../home/HomeFlow';
import { LiveNightFlow } from './LiveNightFlow';
import { previewZodiac } from '../birthDate/zodiac';
import { createLiveContext, type LiveContext } from './context';
import { NightScreen } from '../../ui/NightScreen';
import { Notice } from '../../ui/Notice';
import { Button } from '../../ui/Button';
import { ServiceMode } from './ServiceMode';

export function LiveApp({
  onExit,
  context: injected,
}: {
  onExit: () => void;
  context?: LiveContext;
}) {
  const [context] = useState(() => injected ?? createLiveContext());
  const [version, setVersion] = useState(0);
  useEffect(
    () => context.api.subscribe(() => setVersion((v) => v + 1)),
    [context],
  );
  return (
    <ServiceMode.Provider value>
      <LiveAccount key={version} context={context} onExit={onExit} />
    </ServiceMode.Provider>
  );
}
function LiveAccount({
  context,
  onExit,
}: {
  context: LiveContext;
  onExit: () => void;
}) {
  const [{ resources, reminder, onboarding, silence }] = useState(
    context.createAccount,
  );
  const [page, setPage] = useState<
    'loading' | 'error' | 'signup' | 'onboarding' | 'home' | 'night'
  >('loading');
  const [boot, setBoot] = useState<Bootstrap | null>(null),
    [attempt, retry] = useState(0);
  const [resume, setResume] =
    useState<Parameters<typeof SignupFlow>[0]['resume']>();
  const [message, setMessage] = useState('');
  const c = useSyncExternalStore(
    onboarding.subscribe,
    onboarding.getSnapshot,
    onboarding.getSnapshot,
  );
  const refresh = useCallback(() => {
    setPage('loading');
    retry((n) => n + 1);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    onboarding.start();
    void (async () => {
      if (!context.api.hasAuth() && !(await context.api.restore())) {
        if (!controller.signal.aborted) setPage('signup');
        return;
      }
      const b = await resources.bootstrap(controller.signal);
      if (controller.signal.aborted) return;
      setBoot(b);
      const registration = { id: b.user.id, email: b.user.email };
      if (
        b.next_screen === 'ONBOARDING_CONSENT' ||
        b.next_screen === 'ONBOARDING_BIRTH_DATE'
      ) {
        setResume({
          registration,
          stage: b.next_screen === 'ONBOARDING_CONSENT' ? 'consents' : 'birth',
        });
        setPage('signup');
      } else {
        await reminder.device.refresh();
        if (controller.signal.aborted) return;
        if (b.next_screen === 'DAY_INTRO' && b.user.birth_date) {
          onboarding.restoreIntro(
            registration,
            {
              birth_date: b.user.birth_date,
              edits_remaining: b.user.birth_date_edits_remaining,
              zodiac: previewZodiac(b.user.birth_date),
            },
            b.reminder.local_time,
          );
          setPage('onboarding');
        } else setPage('home');
      }
    })().catch((error) => {
      if (controller.signal.aborted) return;
      setMessage(
        error instanceof ApiError && error.status
          ? `서버 응답 ${error.status} · ${error.code ?? '요청 실패'}`
          : '네트워크와 서버 연결을 확인해 주세요.',
      );
      setPage('error');
    });
    return () => {
      controller.abort();
      onboarding.stop();
    };
  }, [context, resources, reminder, onboarding, attempt]);
  useEffect(() => {
    return onboarding.subscribe(() => {
      if (onboarding.getSnapshot().stage === 'home') refresh();
    });
  }, [onboarding, refresh]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && context.api.hasAuth())
        void reminder.device.refresh();
    });
    return () => sub.remove();
  }, [context, reminder]);
  useEffect(
    () => () => {
      onboarding.stop();
      void silence().catch(() => undefined);
    },
    [onboarding, silence],
  );
  useEffect(() => {
    if (page !== 'loading' && page !== 'error') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onExit();
      return true;
    });
    return () => sub.remove();
  }, [page, onExit]);
  useEffect(() => {
    if (page !== 'onboarding') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const state = onboarding.getSnapshot();
      if (state.busy) return true;
      if (state.stage === 'time') onboarding.back();
      else onExit();
      return true;
    });
    return () => sub.remove();
  }, [page, onboarding, onExit]);
  if (page === 'signup')
    return (
      <SignupFlow
        actions={resources.signup}
        resume={resume}
        onExit={onExit}
        onLoginComplete={refresh}
        onComplete={(registration, birth) => {
          onboarding.begin(registration, birth);
          setPage('onboarding');
        }}
      />
    );
  if (page === 'onboarding')
    return c.stage === 'intro' ? (
      <DaySignupIntro c={onboarding} />
    ) : (
      <SignupReminderScreen c={onboarding} />
    );
  if (page === 'home')
    return (
      <HomeFlow
        source={resources.home}
        onExit={onExit}
        onNight={() => {
          setPage('loading');
          const controller = new AbortController();
          void resources
            .bootstrap(controller.signal)
            .then((b) => {
              setBoot(b);
              setPage(b.phase === 'night' ? 'night' : 'home');
            })
            .catch(() => {
              setMessage('밤 기록을 불러오지 못했어요.');
              setPage('error');
            });
        }}
      />
    );
  if (page === 'night' && boot)
    return (
      <LiveNightFlow
        api={context.api}
        resources={resources}
        bootstrap={boot}
        onHome={refresh}
      />
    );
  return (
    <NightScreen>
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingTop: 80, gap: 20 }}
      >
        <Notice
          title={
            page === 'error'
              ? '서버에 연결하지 못했어요'
              : '계정과 기록을 확인하고 있어요'
          }
          description={
            page === 'error' ? message : '실제 서버에 저장된 기록을 불러와요.'
          }
          error={page === 'error'}
        />
        {page === 'error' && <Button label="다시 연결" onPress={refresh} />}
        <Button label="시작 화면으로" onPress={onExit} />
      </ScrollView>
    </NightScreen>
  );
}
