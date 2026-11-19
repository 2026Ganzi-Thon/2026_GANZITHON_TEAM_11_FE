import { ApiError } from '../api/errors';
import { parseDate } from '../features/birthDate/date';
import { createNightMorningNavigation } from '../features/demo/navigation';
import type { NightMorningNavigation } from '../features/demo/navigation';
import type { SheepDetailLoad } from '../features/flock/types';
import type { MorningActions } from '../features/morning/types';
import type { WorryListActions } from '../features/settings/types';
import { createMockMyCards } from './myCards';
import { createNightMorningDemo, type DemoScenario } from './nightMorningDemo';
import {
  createMockWorryDeletion,
  type WorryDeletionScenario,
} from './worryDeletion';
import type { MockWorryRecords } from './worryRecords';
export interface HistoryNight {
  demo: ReturnType<typeof createNightMorningDemo>;
  navigation: NightMorningNavigation;
  morning: MorningActions & { loadSheep: SheepDetailLoad };
}
function newestFirst(
  a: { night_date: string; id: string },
  b: { night_date: string; id: string },
) {
  return b.night_date.localeCompare(a.night_date) || b.id.localeCompare(a.id);
}
function missing(): never {
  throw new ApiError('http', { status: 404, code: 'NOT_FOUND' });
}
function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
async function read<T>(signal: AbortSignal, value: () => T): Promise<T> {
  await Promise.resolve();
  if (signal.aborted) throw new ApiError('aborted');
  return copy(value());
}
/** Memory fixture per night. The caller supplies the clock and reconciles expiry;
 * bootstrap, persistence and UI navigation are not implemented here. */
export function createMockNightHistory(
  options: {
    scenario?: DemoScenario;
    now?: () => number;
    deletionScenario?: WorryDeletionScenario;
    expiry?: boolean;
    expiryScenario?: 'success' | 'check-retry' | 'morning-retry';
  } = {},
) {
  const nights = new Map<string, HistoryNight>();
  const cards = createMockMyCards('empty', { now: options.now });
  const all = () => [...nights.values()];
  const byId = (id: string) =>
    all().find((n) => n.demo.nightId === id) ?? missing();
  const records: MockWorryRecords = {
    get: (id) =>
      all()
        .find((n) => n.demo.nightId === id)
        ?.demo.worryRecords.get(id),
    all: () => all().flatMap((n) => n.demo.worryRecords.all()),
    erase: (id) => byId(id).demo.worryRecords.erase(id),
    eraseRecord: (id) => byId(id).demo.worryRecords.eraseRecord(id),
    isRecordDeleted: (id) => byId(id).demo.worryRecords.isRecordDeleted(id),
    saveReflection: (id, value) =>
      byId(id).demo.worryRecords.saveReflection(id, value),
  };
  const deletions = createMockWorryDeletion(
    (id) => records.erase(id),
    options.deletionScenario ?? 'success',
    records,
  );
  const loadFlock: MorningActions['loadFlock'] = (signal) =>
    read(signal, () =>
      all()
        .flatMap((n) => {
          const sheep = n.demo.getRecord().adopted;
          return sheep ? [sheep] : [];
        })
        .sort(newestFirst),
    );
  const loadSheep: SheepDetailLoad = async (id, signal) => {
    if (signal.aborted) throw new ApiError('aborted');
    const night = all().find((n) => n.demo.getRecord().adopted?.id === id);
    if (!night) return read(signal, missing);
    const detail = await night.demo.morning.loadSheep(id, signal);
    if (signal.aborted) throw new ApiError('aborted');
    return copy(detail);
  };
  const worries: WorryListActions = {
    load: (query, signal) =>
      read(signal, () => {
        const items = records
          .all()
          .filter((r) => !!r.worry_text?.trim())
          .sort(newestFirst);
        const anchor =
          query.cursor === undefined ? undefined : records.get(query.cursor);
        if (query.cursor !== undefined && !anchor)
          throw new ApiError('configuration');
        const remaining = anchor
          ? items.filter((item) => newestFirst(item, anchor) > 0)
          : items;
        const page = remaining.slice(0, 20);
        return {
          items: page.map((r) => ({
            night_id: r.id,
            night_date: r.night_date,
            category_id: r.category_id,
            worry_text: r.worry_text!,
            reflection: r.reflection,
          })),
          next_cursor: page.length < remaining.length ? page.at(-1)!.id : null,
        };
      }),
  };
  return {
    cards,
    clearTransient() {
      cards.clearDrafts();
      for (const entry of all()) {
        entry.demo.clearWritingDrafts();
        entry.morning.writing = entry.demo.cardWriting;
        entry.navigation = createNightMorningNavigation();
      }
    },
    deletions,
    worries,
    loadFlock,
    loadSheep,
    getStats: () => ({
      night_count: all().filter((n) => n.demo.getSession() !== null).length,
      counted_sheep_total: all().reduce(
        (sum, n) => sum + n.demo.getTotalCount(),
        0,
      ),
      worry_record_count: records.all().filter((r) => !!r.worry_text?.trim())
        .length,
    }),
    getNightById: byId,
    expireDue: () => {
      for (const entry of all()) entry.demo.expireIfDue();
    },
    getNight: (date: string) => nights.get(date) ?? null,
    openNight: (date: string): HistoryNight => {
      if (!parseDate(date)) throw new ApiError('configuration');
      const existing = nights.get(date);
      if (existing) return existing;
      const demo = createNightMorningDemo(options.scenario, {
        nightId: `history-night-${date}`,
        nightDate: date,
        sheepId: `history-sheep-${date}`,
        expiry: options.expiry
          ? {
              now: options.now ?? Date.now,
              closesAt: new Date(
                Date.parse(`${date}T04:00:00+09:00`) + 86400000,
              ).toISOString(),
              checkRetry: options.expiryScenario === 'check-retry',
              morningRetry: options.expiryScenario === 'morning-retry',
            }
          : undefined,
        manageWorries: true,
        writingNamespace: `history-writing-${date}`,
        onSubmitted: cards.acceptSubmission,
      });
      const entry: HistoryNight = {
        demo,
        navigation: createNightMorningNavigation(),
        morning: { ...demo.morning, worries: deletions, loadFlock, loadSheep },
      };
      nights.set(date, entry);
      return entry;
    },
  };
}
