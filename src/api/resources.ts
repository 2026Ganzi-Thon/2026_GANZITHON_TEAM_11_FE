import type { Bootstrap, User } from './contracts';
import { ApiError } from './errors';
import { operationKey, type ApiSession } from './session';
import { createLiveCardWriting, createLiveMyCards } from './cardWriting';
import type { ConsentDocuments } from '../features/legal/model';
import { previewZodiac as zodiacForDate } from '../features/birthDate/zodiac';
import type { SignupActions } from '../features/signup/types';
import type {
  SettingsActions,
  SettingsData,
  WorryPage,
} from '../features/settings/types';
import type { ReminderActions } from '../features/reminder/types';
import type { HomeSource } from '../features/home/types';
import { readHomeSnapshot } from '../features/home/model';
import type { Morning, MorningActions, Sheep } from '../features/morning/types';
import type {
  Reflection,
  ReflectionRecord,
} from '../features/morning/reflection';
import type { SavedSong } from '../features/songs/types';
import type { SheepDetail } from '../features/flock/types';
import { createWorryDeletions } from '../features/worries/deletions';
import { kstDate } from '../features/birthDate/date';
import type { BirthDateResult } from '../features/birthDate/types';
import { readFortune } from '../features/fortune/types';

export const segment = encodeURIComponent;
type ServerMorning = Morning & ReflectionRecord & { saved_songs: SavedSong[] };
interface ServerDocument {
  type: 'terms' | 'privacy';
  title: string;
  version: string;
  body_url: string;
  required: boolean;
}
function user(value: User): User {
  if (
    !value?.id?.trim() ||
    !value.email?.trim() ||
    !Number.isSafeInteger(value.stats?.night_count)
  )
    throw new ApiError('invalid-response');
  return value;
}
export function createLiveResources(api: ApiSession) {
  let versions: { terms_version: string; privacy_version: string } | null =
    null;
  let loginWork: { input: string; key: string } | null = null;
  const bootstrap = async (signal: AbortSignal) => {
    const b = await api.request<Bootstrap>('/bootstrap', { signal });
    user(b.user);
    return { ...b, server_time: new Date(b.server_time).toISOString() };
  };
  const loadMe = async (signal: AbortSignal): Promise<SettingsData> => {
    const value = await api.request<SettingsData>('/me', { signal });
    user(value?.user);
    return value;
  };
  const documents = {
    async load(signal: AbortSignal): Promise<ConsentDocuments> {
      const list = await api.client.request<{ items: ServerDocument[] }>(
        '/legal-documents',
        { signal },
      );
      const terms = list?.items?.find((d) => d.type === 'terms'),
        privacy = list?.items?.find((d) => d.type === 'privacy');
      if (!terms?.version || !privacy?.version)
        throw new ApiError('invalid-response');
      versions = {
        terms_version: terms.version,
        privacy_version: privacy.version,
      };
      return {
        revision: JSON.stringify(versions),
        documents: [
          ...[terms, privacy].map((d) => {
            if (new URL(d.body_url).protocol !== 'https:')
              throw new ApiError('invalid-response');
            return {
              id: d.type,
              version: d.version,
              title: d.title,
              body: '서버에서 제공하는 원문을 열어 내용을 확인해 주세요.',
              body_url: d.body_url,
            };
          }),
          {
            id: 'processing',
            version: '1',
            title: '입력 정보 처리 안내',
            body: '입력한 정보는 계정과 연결되어 서버에 저장돼요. 자세한 내용은 개인정보 처리방침을 확인해 주세요.',
          },
          {
            id: 'notifications',
            version: '1',
            title: '양 셀 시간 알림',
            body: '선택한 시간의 기기 알림이에요. 거절해도 이용할 수 있고 설정에서 변경할 수 있어요.',
          },
        ],
      };
    },
  };
  const reminder: Pick<ReminderActions, 'load' | 'save'> = {
    load: async (signal) => (await bootstrap(signal)).reminder,
    save: (target, signal) =>
      api.request('/me/reminder', {
        method: 'PUT',
        body: { ...target },
        signal,
      }),
  };
  const birth = (date: string, signal: AbortSignal) =>
    api.request<BirthDateResult>('/me/birth-date', {
      method: 'PUT',
      body: { birth_date: date },
      signal,
    });
  const records = {
    remove: (id: string, signal: AbortSignal) =>
      api.request<void>(`/nights/${segment(id)}/worry`, {
        method: 'DELETE',
        signal,
      }),
    async check(id: string, signal: AbortSignal) {
      let cursor: string | null = null;
      do {
        const page: WorryPage = await api.request(
          `/me/worries?limit=100${cursor ? `&cursor=${segment(cursor)}` : ''}`,
          { signal },
        );
        if (page.items.some((w) => w.night_id === id)) return false;
        cursor = page.next_cursor;
      } while (cursor);
      return true;
    },
  };
  const deletions = createWorryDeletions(records, records);
  const cards = createLiveMyCards(api);
  const settings: SettingsActions = {
    documents,
    deletions,
    loadMe,
    worries: {
      load: async (query, signal) => {
        const page = await api.request<WorryPage>(
          `/me/worries${query.cursor ? `?cursor=${segment(query.cursor)}` : ''}`,
          { signal },
        );
        return {
          ...page,
          items: page.items.map((r) => ({
            ...r,
            reflection: r.reflection ?? null,
          })),
        };
      },
    },
    birthDate: {
      load: async (signal) => {
        const b = await bootstrap(signal);
        if (!b.user.birth_date) throw new ApiError('invalid-response');
        return {
          birth_date: b.user.birth_date,
          edits_remaining: b.user.birth_date_edits_remaining,
          zodiac: zodiacForDate(b.user.birth_date),
          today: kstDate(new Date(b.server_time)),
        };
      },
      save: birth,
    },
  };
  const signup: SignupActions = {
    get today() {
      return kstDate(new Date());
    },
    loadDocuments: documents.load,
    async register(key, credentials, signal) {
      if (!api.hasAuth())
        await api.authenticate('register', credentials, key, signal);
      const b = await bootstrap(signal);
      if (b.user.email.toLowerCase() !== credentials.email.toLowerCase())
        throw new ApiError('invalid-response');
      return { id: b.user.id, email: b.user.email };
    },
    async login(credentials, signal) {
      const input = JSON.stringify(credentials);
      if (loginWork?.input !== input)
        loginWork = { input, key: operationKey() };
      try {
        await api.authenticate('login', credentials, loginWork.key, signal);
        loginWork = null;
      } catch (error) {
        if (
          error instanceof ApiError &&
          [400, 401, 422].includes(error.status ?? 0)
        )
          loginWork = null;
        throw error;
      }
    },
    consent: async (_id, input, signal) => {
      if (!versions || input.revision !== JSON.stringify(versions))
        throw new ApiError('invalid-response');
      await api.request('/me/consents', {
        method: 'PUT',
        body: {
          ...versions,
          terms_accepted: input.choices.terms,
          privacy_accepted: input.choices.privacy,
        },
        signal,
      });
    },
    birth: (_id, date, signal) => birth(date, signal),
    passwordReset: {
      request: (email, signal) =>
        api.client.request('/auth/password-reset/request', {
          method: 'POST',
          body: { email },
          signal,
        }),
    },
  };
  const loadMorning = (signal: AbortSignal, id?: string) =>
    api.request<ServerMorning>(
      `/morning${id ? `?night_id=${segment(id)}` : ''}`,
      { signal },
    );
  const morning: MorningActions = {
    settings,
    worries: deletions,
    writing: createLiveCardWriting(api),
    loadMorning,
    adopt: (id, cardId, signal) =>
      api.request(`/nights/${segment(id)}/adoption`, {
        method: 'PUT',
        body: { card_id: cardId },
        signal,
      }),
    async loadFlock(signal) {
      const sheep: Sheep[] = [];
      let cursor: string | null = null;
      do {
        const page: { items: Sheep[]; next_cursor: string | null } =
          await api.request(
            `/sheep?limit=100${cursor ? `&cursor=${segment(cursor)}` : ''}`,
            { signal },
          );
        sheep.push(...page.items);
        cursor = page.next_cursor;
      } while (cursor);
      return sheep;
    },
    reflection: {
      load: async (id, signal) => {
        const m = await loadMorning(signal, id);
        return { night: m.night, reflection: m.reflection };
      },
      save: (id, answer, signal) =>
        api.request<Reflection>(`/nights/${segment(id)}/reflection`, {
          method: 'PUT',
          body: { answer },
          signal,
        }),
    },
    songs: {
      load: async (signal) => (await loadMorning(signal)).saved_songs,
      set: async (id, saved, signal) => {
        const b = await bootstrap(signal);
        if (!b.night_id) throw new ApiError('invalid-response');
        return (
          await api.request<{ saved: boolean }>(
            `/nights/${segment(b.night_id)}/songs/${segment(id)}`,
            { method: 'PUT', body: { saved }, signal },
          )
        ).saved;
      },
    },
    receivedYarn: {
      load: async (signal) =>
        (
          await api.request<{
            summary:
              | import('../features/yarnSummary/types').ReceivedYarnSummary
              | null;
          }>('/me/yarn-summary', { signal })
        ).summary,
      markSeen: (id, signal) =>
        api.request(`/me/yarn-summary/${segment(id)}/seen`, {
          method: 'PUT',
          signal,
        }),
    },
  };
  const home: HomeSource = {
    morning,
    settings,
    cards,
    clock: {
      load: async (signal) => readHomeSnapshot(await bootstrap(signal)),
    },
    fortune: {
      load: async (signal) =>
        readFortune(await api.request('/fortune/today', { signal })),
    },
    loadDetail: (id, signal) =>
      api.request<SheepDetail>(`/sheep/${segment(id)}`, { signal }),
  };
  return {
    bootstrap,
    signup,
    settings,
    home,
    cards,
    morning,
    reminder,
    documents,
    acknowledgeIntro: (signal: AbortSignal) =>
      api.request<void>('/me/day-intro', {
        method: 'PUT',
        body: { acknowledged: true },
        signal,
      }),
  };
}
export type LiveResources = ReturnType<typeof createLiveResources>;
