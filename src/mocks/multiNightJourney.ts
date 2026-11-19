import { createMockReceivedYarnInbox } from './receivedYarnInbox';
import type { ReceivedYarnScenario } from './receivedYarn';
import { createMockDecoration } from './decoration';
import { ApiError } from '../api/errors';
import {
  fortuneDate,
  homePhase,
  type HomeSnapshot,
} from '../features/home/model';
import type { HomeSource } from '../features/home/types';
import type { Morning, MorningActions } from '../features/morning/types';
import type { Registration } from '../features/signup/types';
import { createMockBirthDate } from './birthDate';
import { createMockHome } from './firstNightHome';
import { createMockNightHistory } from './nightHistory';
import type { SettingsMorningOptions } from './settingsMorning';
import type { DemoScenario } from './nightMorningDemo';
const previousDate = (date: string) =>
  new Date(Date.parse(`${date}T00:00:00Z`) - 86400000)
    .toISOString()
    .slice(0, 10);
/** Same memory-only account across dated nights. Time movement is a preview control. */
export function createMockMultiNightJourney(
  options: SettingsMorningOptions & {
    identity: Registration;
    clock: { now: () => number; advanceMorning: (nightDate: string) => void };
    expiryScenario?: 'success' | 'check-retry' | 'morning-retry';
    nightScenario?: DemoScenario;
    receivedYarnScenario?: ReceivedYarnScenario;
  },
) {
  const now = options.clock.now,
    history = createMockNightHistory({
      now,
      expiry: true,
      expiryScenario: options.expiryScenario,
      scenario: options.nightScenario,
    });
  const inbox = createMockReceivedYarnInbox({
    ownerId: options.identity.id,
    now,
    cards: history.cards,
    scenario: options.receivedYarnScenario,
  });
  let receiptBatch = 0;
  let activeDate = fortuneDate(now()),
    active = history.openNight(activeDate);
  const advanced = new Set<string>();
  const original = createMockHome('night', {
    ...options,
    now,
    birthDate:
      options.birthDate ??
      createMockBirthDate('success', () => new Date(now())),
  });
  const settings = {
    ...original.settings!,
    worries: history.worries,
    deletions: history.deletions,
    loadMe: async (signal: AbortSignal) => {
      const value = await original.settings!.loadMe(signal);
      history.expireDue();
      return { ...value, user: { ...value.user, stats: history.getStats() } };
    },
  };
  const decoration = createMockDecoration(history.loadSheep, { now });
  const common: MorningActions = {
    get receivedYarn() {
      return inbox.forDate(fortuneDate(now()), homePhase(now()) === 'day');
    },
    decoration,
    loadFlock: async (signal) =>
      (await history.loadFlock(signal)).map(decoration.decorate),
    worries: history.deletions,
    settings,
    fortune: original.fortune,
    adopt: async (id, card, signal) =>
      history.getNightById(id).morning.adopt(id, card, signal),
    reflection: {
      load: async (id, signal) =>
        history.getNightById(id).morning.reflection!.load(id, signal),
      save: async (id, answer, signal) =>
        history.getNightById(id).morning.reflection!.save(id, answer, signal),
    },
    loadMorning: async (signal, id) => {
      if (id !== undefined)
        return history.getNightById(id).morning.loadMorning(signal, id);
      return resolveMorning(await original.clock.load(signal)).loadMorning(
        signal,
      );
    },
  };
  const sources = new Map<string, MorningActions>();
  const empty = async (signal: AbortSignal): Promise<Morning> => {
    await original.clock.load(signal);
    return {
      night: null,
      counted_sheep: null,
      candidate_cards: [],
      default_card_id: null,
      adoption: null,
    };
  };
  function resolveMorning(snapshot: HomeSnapshot): MorningActions {
    history.expireDue();
    const date = fortuneDate(Date.parse(snapshot.server_time));
    const entry =
      snapshot.phase === 'day' ? history.getNight(previousDate(date)) : null;
    const available = entry?.demo.getRecord().morningOpen ? entry : null;
    const key = `${snapshot.phase}:${date}:${available?.demo.nightId ?? 'empty'}`;
    const cached = sources.get(key);
    if (cached) return cached;
    const result: MorningActions = {
      ...common,
      receivedYarn: inbox.forDate(date, snapshot.phase === 'day'),
      writing: available?.morning.writing,
      songs: available?.morning.songs,
      loadMorning: async (signal, id) => {
        if (id !== undefined && id !== available?.demo.nightId)
          throw new ApiError('http', { status: 404, code: 'NOT_FOUND' });
        return available
          ? available.morning.loadMorning(signal, id)
          : empty(signal);
      },
    };
    sources.set(key, result);
    return result;
  }
  const home: HomeSource = {
    ...original,
    settings,
    cards: history.cards,
    loadDetail: async (id, signal) => {
      const value = await history.loadSheep(id, signal);
      return { ...value, sheep: decoration.decorate(value.sheep) };
    },
    resolveMorning,
    morning: common,
    clock: {
      load: async (signal) => {
        const value = await original.clock.load(signal);
        history.expireDue();
        return {
          ...value,
          user: {
            ...value.user,
            stats: { night_count: history.getStats().night_count },
          },
        };
      },
    },
  };
  return {
    home,
    history,
    clearTransient() {
      history.clearTransient();
      sources.clear();
    },
    previewReceiveYarn(amount: 1 | 3 = 3) {
      const ids = [
        `${options.identity.id}-published-a`,
        `${options.identity.id}-published-b`,
      ];
      history.cards.seedPublishedText(
        ids[0],
        '결과를 기다리는 밤이 길게 느껴져도, 오늘 하루 버틴 자신을 다독여 주세요.',
      );
      history.cards.seedPublishedText(
        ids[1],
        '잠깐 쉬어도 괜찮아요. 내일의 속도는 내일 정해도 돼요.',
      );
      const batch = ++receiptBatch,
        receivedAt = now();
      for (let i = 0; i < amount; i++)
        inbox.receive({
          id: `${options.identity.id}-receipt-${batch}-${i}`,
          cardId: ids[i === 2 ? 1 : 0],
          senderKey: `incoming-${batch}-${i === 2 ? 0 : i}`,
          receivedAt,
        });
    },
    get night() {
      return active.demo;
    },
    get navigation() {
      return active.navigation;
    },
    enterNight: () => {
      history.expireDue();
      if (homePhase(now()) !== 'night') return false;
      activeDate = fortuneDate(now());
      active = history.openNight(activeDate);
      return true;
    },
    advanceMorning: () => {
      if (advanced.has(activeDate)) return;
      active.demo.advanceMorning();
      options.clock.advanceMorning(activeDate);
      advanced.add(activeDate);
    },
  };
}
