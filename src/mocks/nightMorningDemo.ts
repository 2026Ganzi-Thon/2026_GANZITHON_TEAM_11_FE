import {
  stopOfferPosition,
  type StopOfferItem,
} from '../features/night/stopOffer/model';
import type { TextCardSubmission } from '../features/cards/types';
import type { SongCardSubmission } from '../features/cards/songTypes';
import type { MockWorryRecords } from './worryRecords';
import { createMockWorryDeletion } from './worryDeletion';
import { createMockSongCards } from './songCards';
import { createMockReceivedYarn } from './receivedYarn';
import { createMockFortune } from './fortune';
import { createMockCardWriting } from './cardWriting';
import { createMockYarn } from './yarn';
import { createMockFluff } from './fluff';
import { createMockTextCards } from './textCards';
import type { SongActions } from '../features/songs/types';
import type { Card } from '../api/contracts';
import { ApiError } from '../api/errors';
import type { NightEntryActions, WorryDraft } from '../features/night/entry';
import { validateWorry } from '../features/night/entry';
import type { FeedLoad, FeedPosition } from '../features/night/feed/model';
import type {
  ClosingActions,
  ClosingResult,
} from '../features/night/closing/types';
import type {
  MorningActions,
  MorningCandidate,
  Sheep,
} from '../features/morning/types';
import type {
  Reflection,
  ReflectionActions,
} from '../features/morning/reflection';
import type { SheepDetailLoad } from '../features/flock/types';
import { createMockNightFeed } from './nightFeed';
import { createMockNightClosing } from './nightClosing';
import { reflectionReplies } from './reflection';
import type {
  EntrustActions,
  EntrustAction,
} from '../features/night/entrust/types';
import { fortuneDate, homePhase } from '../features/home/model';
import type {
  NightReturnActions,
  ReturnBootstrap,
} from '../features/night/nightReturn/model';
import type { NightExpiryActions } from '../features/night/expiry/types';
export type DemoScenario =
  | 'success'
  | 'return-create-lost'
  | 'lost-responses'
  | 'slow-songs'
  | 'slow-yarn'
  | 'slow-fluff'
  | 'writing-retry'
  | 'writing-lost-response'
  | 'writing-refresh-retry'
  | 'received-yarn'
  | 'fortune'
  | 'entrust-slow'
  | 'entrust-retry'
  | 'entrust-slow-retry'
  | 'entrust-lost-response'
  | 'stop-slow-finish'
  | 'stop-retry-finish'
  | 'stop-lost-finish'
  | 'worry-delete';
function delayed<T>(
  signal: AbortSignal,
  action: () => T,
  delayMs = 400,
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new ApiError('aborted'));
      return;
    }
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    };
    const abort = () => {
      cleanup();
      reject(new ApiError('aborted'));
    };
    const timer = setTimeout(() => {
      cleanup();
      try {
        resolve(action());
      } catch (error) {
        reject(error);
      }
    }, delayMs);
    signal.addEventListener('abort', abort, { once: true });
  });
}
function conflict(code: string, status = 409): never {
  throw new ApiError('http', { status, code });
}
/** One deterministic, memory-only night for development demonstrations. */
export function createNightMorningDemo(
  scenario: DemoScenario = 'success',
  options: {
    nightId?: string;
    nightDate?: string;
    sheepId?: string;
    expiry?: {
      now: () => number;
      closesAt: string;
      checkRetry?: boolean;
      morningRetry?: boolean;
    };
    manageWorries?: boolean;
    writingNamespace?: string;
    onSubmitted?: (receipt: TextCardSubmission | SongCardSubmission) => void;
  } = {},
) {
  const nightId = options.nightId ?? 'demo-night';
  const nightDate = options.nightDate ?? '2026-11-12';
  let draft: WorryDraft | null = null;
  let count: number | null = null;
  let cards: Card[] | null = null;
  let entrust: EntrustActions | undefined;
  let stopOffer: StopOfferItem | undefined;
  let entrustAction: EntrustAction | null = null;
  const isPause = (index: number) =>
    index + 1 === entrust?.item.position || index + 1 === stopOffer?.position;
  const yarn = createMockYarn(
    () => (cards ?? []).filter((_card, index) => !isPause(index)),
    scenario === 'slow-yarn' ? 'slow' : 'success',
  );
  let loader: FeedLoad | null = null;
  let position: FeedPosition = { position: 1, furthestPosition: 1 };
  let finished: ClosingResult | null = null;
  let progressRecorded = false;
  let morningOpen = false;
  let expired = false;
  const closesAt = options.expiry
    ? Date.parse(options.expiry.closesAt)
    : Infinity;
  function expireIfDue(instant = options.expiry?.now() ?? 0) {
    if (!options.expiry || instant < closesAt) return false;
    if (!morningOpen) {
      if (!finished) {
        expired = count !== null;
        const seen = progressRecorded ? position.furthestPosition : 0;
        finished = {
          summary: {
            counted: seen,
            entrusted_count: entrustAction === 'entrusted' ? 1 : 0,
            fluff_count: (cards ?? [])
              .slice(0, seen)
              .filter((c) => c.available && c.content && c.viewer.fluff_saved)
              .length,
          },
          closing_card: null,
          writing_offer: { state: 'deferred' },
        };
      }
      morningOpen = true;
      if (
        writingOffer?.state === 'offered' ||
        writingOffer?.state === 'writing'
      )
        writingOffer = { state: 'deferred' };
      if (
        finished.writing_offer.state === 'offered' ||
        finished.writing_offer.state === 'writing'
      )
        finished = { ...finished, writing_offer: { state: 'deferred' } };
    }
    return true;
  }
  function guardNight(code = 'SESSION_CLOSED') {
    if (options.expiry && (expireIfDue() || morningOpen)) conflict(code);
  }
  function nightResponse<T>(signal: AbortSignal, action: () => T) {
    return delayed(signal, () => {
      guardNight();
      return action();
    });
  }
  const writingScenario =
    scenario === 'writing-lost-response'
      ? 'lost-response'
      : scenario === 'writing-retry'
        ? 'retry'
        : 'success';
  const canSubmit = () => {
    expireIfDue();
    return morningOpen
      ? (writingOffer ?? finished?.writing_offer)?.state === 'deferred'
      : writingOffer?.state === 'writing';
  };
  const onSubmitted = (receipt: TextCardSubmission | SongCardSubmission) => {
    options.onSubmitted?.(receipt);
    writingOffer = { state: 'fulfilled' };
    if (finished)
      finished = { ...finished, writing_offer: { state: 'fulfilled' } };
  };
  const writingOptions = {
    sourceNightId: nightId,
    canSubmit,
    onSubmitted,
    namespace: options.writingNamespace,
  };
  const textCards = createMockTextCards(writingScenario, writingOptions);
  const songCards = createMockSongCards(writingScenario, writingOptions);
  const cardWriting = createMockCardWriting(textCards, songCards);
  let fingerprint: string | null = null;
  let closingViewed = false;
  let closingConfirmed = false;
  let sessionIndex = 1;
  let finishedAt: string | null = null;
  let writingOffer: ClosingResult['writing_offer'] | null = null;
  const archived: {
    counted: number;
    candidates: MorningCandidate[];
    entrusted: boolean;
  }[] = [];
  const instant = () =>
    options.expiry?.now() ?? Date.parse(`${nightDate}T22:00:00+09:00`);
  const totalCount = () =>
    archived.reduce((sum, item) => sum + item.counted, 0) +
    (finished?.summary.counted ??
      (progressRecorded ? position.furthestPosition : 0));
  const allCards = () => [
    ...archived.flatMap((item) => item.candidates.map((x) => x.card)),
    ...(cards ?? []),
  ];

  const fluff = createMockFluff(
    {
      cards: () => (cards ?? []).filter((_card, index) => !isPause(index)),
      viewed: (id) =>
        (cards ?? [])
          .slice(0, position.furthestPosition)
          .some((c) => c.id === id),
      isOpen: () => !expireIfDue() && !morningOpen,
    },
    scenario === 'slow-fluff' ? 'slow' : 'success',
  );
  let adopted: Sheep | null = null;
  let reflection: Reflection | null = null;
  const viewedAt = new Map<string, string>();
  let viewSequence = 0;
  const stamp = (card: Card) =>
    viewedAt.set(card.id, new Date(instant() + ++viewSequence).toISOString());
  const deletedRecords = new Set<string>();
  const readRecord = () =>
    draft
      ? {
          id: nightId,
          night_date: nightDate,
          category_id: draft.category_id,
          worry_text: draft.worry_text,
          worry_saved_at: draft.worry_text ? `${nightDate}T16:12:00Z` : null,
          entrusted:
            entrustAction === 'entrusted' ||
            archived.some((item) => item.entrusted),
          reflection: reflection ? { ...reflection } : null,
        }
      : undefined;
  const records: MockWorryRecords = {
    get: (id) => (id === nightId ? readRecord() : undefined),
    all: () => {
      const record = readRecord();
      return record ? [record] : [];
    },
    erase: (id) => {
      if (id !== nightId || !draft) conflict('NOT_FOUND', 404);
      draft = { ...draft!, worry_text: null };
    },
    eraseRecord: (id) => {
      records.erase(id);
      reflection = null;
      deletedRecords.add(id);
    },
    isRecordDeleted: (id) => deletedRecords.has(id),
    saveReflection: (id, value) => {
      if (id !== nightId || !draft || deletedRecords.has(id))
        conflict('REFLECTION_NOT_AVAILABLE');
      reflection = { ...value };
    },
  };
  const savedSongs = new Map<string, string>();
  const failed = new Set<string>();
  const expiry: NightExpiryActions | undefined = options.expiry
    ? {
        load: (signal) =>
          delayed(signal, () => {
            const instant = options.expiry!.now();
            const closed = expireIfDue(instant);
            if (options.expiry!.checkRetry && !failed.has('expiry-check')) {
              failed.add('expiry-check');
              throw new ApiError('network');
            }
            return {
              server_time: new Date(instant).toISOString(),
              closes_at: new Date(closesAt).toISOString(),
              closed,
            };
          }),
      }
    : undefined;
  let baseClosing = createMockNightClosing();
  const failOnce = (key: string) => {
    if (
      (scenario === 'lost-responses' ||
        (scenario === 'stop-lost-finish' && key === 'finish')) &&
      !failed.has(key)
    ) {
      failed.add(key);
      throw new ApiError('network');
    }
  };
  const checkNight = (id: string) => {
    if (id !== nightId) conflict('NOT_FOUND', 404);
  };
  const sessionCandidates = (): MorningCandidate[] => {
    const items = (cards ?? [])
      .slice(0, finished?.summary.counted ?? 0)
      .map((card, index) => ({
        card,
        can_adopt: card.available && !!card.content,
        fluff_saved:
          card.available && !!card.content && card.viewer.fluff_saved,
        position: (index + 1) as number | null,
        sheep_count: count!,
        last_viewed_at: viewedAt.get(card.id) ?? `${nightDate}T16:12:00Z`,
      }))
      .filter(
        (item) =>
          item.position !== entrust?.item.position &&
          item.position !== stopOffer?.position,
      );
    if (closingViewed && finished?.closing_card)
      items.push({
        card: finished.closing_card,
        can_adopt:
          finished.closing_card.available && !!finished.closing_card.content,
        fluff_saved: false,
        position: null,
        sheep_count: count!,
        last_viewed_at:
          viewedAt.get(finished.closing_card.id) ?? `${nightDate}T16:13:00Z`,
      });
    return [...new Map(items.map((item) => [item.card.id, item])).values()];
  };
  const candidates = () => [
    ...archived.flatMap((item) => item.candidates),
    ...sessionCandidates(),
  ];
  const reflectionActions: ReflectionActions = {
    load: (id, signal) =>
      delayed(signal, () => {
        checkNight(id);
        expireIfDue();
        if (!morningOpen) conflict('MORNING_NOT_OPEN');
        if (!draft) return { night: null, reflection: null };
        return {
          night: {
            id: nightId,
            night_date: nightDate,
            category_id: draft!.category_id,
            worry_text: draft!.worry_text,
            worry_saved_at: draft!.worry_text ? `${nightDate}T16:12:00Z` : null,
            entrusted:
              entrustAction === 'entrusted' ||
              archived.some((item) => item.entrusted),
          },
          reflection,
        };
      }),
    save: (id, answer, signal) =>
      delayed(signal, () => {
        checkNight(id);
        expireIfDue();
        if (!morningOpen || draft?.category_id === 'none' || !draft?.worry_text)
          conflict('REFLECTION_NOT_AVAILABLE');
        reflection = { answer, message: reflectionReplies[answer] };
        return reflection;
      }),
  };
  const loadSheep: SheepDetailLoad = (id, signal) =>
    delayed(signal, () => {
      expireIfDue();
      if (!morningOpen || !adopted || adopted.id !== id)
        conflict('NOT_FOUND', 404);
      const sheep = adopted;
      const candidate = candidates().find(
        (item) => item.card.id === sheep.card_id,
      )!;
      return {
        sheep: adopted,
        card: candidate.card,
        position: candidate.position,
        sheep_count: candidate.sheep_count,
        night: {
          night_date: nightDate,
          category_id: draft!.category_id,
          worry_text: draft!.worry_text,
          reflection,
        },
      };
    });
  const songs: SongActions = {
    load: (signal) =>
      delayed(signal, () => {
        expireIfDue();
        if (!morningOpen) conflict('MORNING_NOT_OPEN');
        return [...savedSongs].flatMap(([id, saved_at]) => {
          const card = allCards().find((item) => item.id === id);
          return card?.kind === 'song' && card.available && card.content
            ? [{ card_id: id, track: card.content.track, saved_at }]
            : [];
        });
      }),
    set: (id, saved, signal) =>
      delayed(
        signal,
        () => {
          expireIfDue();
          if (saved) guardNight('NIGHT_CLOSED');
          const index = cards?.findIndex((item) => item.id === id) ?? -1;
          const card = allCards().find((item) => item.id === id);
          if (!card || card.kind !== 'song') conflict('NOT_SONG_CARD', 422);
          if (index >= position.furthestPosition || (index < 0 && !morningOpen))
            conflict('CARD_NOT_VIEWED', 422);
          if (!card.available || !card.content) conflict('CARD_UNAVAILABLE');
          if (saved && morningOpen) conflict('NIGHT_CLOSED');
          if (saved) savedSongs.set(id, `${nightDate}T16:12:00Z`);
          else savedSongs.delete(id);
          card.viewer.song_saved = saved;
          return saved;
        },
        scenario === 'slow-songs' ? 5000 : 400,
      ),
  };
  const morning: MorningActions & {
    reflection: ReflectionActions;
    songs: SongActions;
    loadSheep: SheepDetailLoad;
  } = {
    worries:
      scenario === 'worry-delete' || options.manageWorries
        ? createMockWorryDeletion(
            (id) => {
              checkNight(id);
              if (!morningOpen || !draft) conflict('NOT_FOUND', 404);
              records.erase(id);
            },
            'success',
            options.manageWorries ? records : undefined,
          )
        : undefined,
    writing: cardWriting,
    fortune: scenario === 'fortune' ? createMockFortune() : undefined,
    receivedYarn:
      scenario === 'received-yarn' ? createMockReceivedYarn() : undefined,
    reflection: reflectionActions,
    songs,
    loadSheep,
    loadMorning: (signal, requestedNightId) =>
      delayed(signal, () => {
        expireIfDue();
        if (!morningOpen) conflict('MORNING_NOT_OPEN');
        if (requestedNightId !== undefined) checkNight(requestedNightId);
        if (options.expiry?.morningRetry && !failed.has('expiry-morning')) {
          failed.add('expiry-morning');
          throw new ApiError('network');
        }
        if (!draft || count === null)
          return {
            night: null,
            counted_sheep: null,
            candidate_cards: [],
            default_card_id: null,
            adoption: null,
          };
        if (
          scenario === 'writing-refresh-retry' &&
          finished?.writing_offer.state === 'fulfilled' &&
          !failed.has('writing-refresh')
        ) {
          failed.add('writing-refresh');
          throw new ApiError('network');
        }
        const recent = candidates().sort(
          (a, b) =>
            b.last_viewed_at.localeCompare(a.last_viewed_at) ||
            (a.card.id < b.card.id ? -1 : a.card.id > b.card.id ? 1 : 0),
        );
        const items = [...recent].sort(
          (a, b) => Number(b.fluff_saved) - Number(a.fluff_saved),
        );
        const warm = recent.filter(
          (item) => item.can_adopt && item.card.tone === 'warm',
        );
        const eligible = recent.filter((item) => item.can_adopt);
        return {
          night: { id: nightId, night_date: nightDate },
          counted_sheep: totalCount(),
          candidate_cards: items,
          default_card_id: (warm[0] ?? eligible[0])?.card.id ?? null,
          adoption: adopted,
          writing_offer: { ...(writingOffer ?? finished!.writing_offer) },
        };
      }),
    adopt: (id, cardId, signal) =>
      delayed(signal, () => {
        checkNight(id);
        expireIfDue();
        if (!morningOpen) conflict('MORNING_NOT_OPEN');
        if (adopted) {
          if (adopted.card_id !== cardId)
            conflict('ADOPTION_ALREADY_FINALIZED');
          return adopted;
        }
        const item = candidates().find(
          (item) => item.card.id === cardId && item.can_adopt,
        );
        if (!item) conflict('INVALID_ADOPTION_CARD', 422);
        adopted = {
          id: options.sheepId ?? 'demo-sheep',
          night_id: nightId,
          night_date: nightDate,
          card_id: cardId,
          color_key: item.card.category_id,
        };
        failOnce('adopt');
        return adopted;
      }),
    loadFlock: (signal) => delayed(signal, () => (adopted ? [adopted] : [])),
  };
  function beginSession(value: number) {
    if (!draft || !Number.isInteger(value) || value < 3 || value > 30)
      conflict('INVALID_SESSION', 422);
    if (count !== null) {
      if (count !== value) conflict('SESSION_ALREADY_STARTED');
      return;
    }
    count = value;
    const stopPosition = stopOfferPosition(value);
    stopOffer =
      stopPosition === null
        ? undefined
        : { id: `${nightId}-stop-offer`, position: stopPosition };
    if (value >= 7 && draft!.category_id !== 'none' && draft!.worry_text) {
      const item = {
        id: `${nightId}-entrust`,
        position: Math.min(6, Math.ceil(value / 2)),
        get worry_text() {
          return draft?.worry_text ?? '';
        },
      };
      const read = () => ({ item_id: item.id, action: entrustAction });
      entrust = {
        item,
        load: (signal) => delayed(signal, read),
        save: (action, signal) =>
          delayed(
            signal,
            () => {
              guardNight('NIGHT_CLOSED');
              if (morningOpen || finished) conflict('NIGHT_CLOSED');
              if (
                !progressRecorded ||
                position.furthestPosition < item.position
              )
                conflict('PAUSE_NOT_VIEWED', 422);
              if (action !== 'entrusted' && action !== 'skipped')
                conflict('VALIDATION_ERROR', 422);
              if (entrustAction !== null) {
                if (entrustAction !== action) conflict('PAUSE_ALREADY_DECIDED');
                return read();
              }
              if (action === 'entrusted' && !draft?.worry_text)
                conflict('WORRY_NOT_AVAILABLE');
              if (
                (scenario === 'entrust-retry' ||
                  scenario === 'entrust-slow-retry') &&
                !failed.has('entrust')
              ) {
                failed.add('entrust');
                throw new ApiError('network');
              }
              entrustAction = action;
              if (
                scenario === 'entrust-lost-response' &&
                !failed.has('entrust')
              ) {
                failed.add('entrust');
                throw new ApiError('network');
              }
              return read();
            },
            scenario === 'entrust-slow' ||
              (scenario === 'entrust-slow-retry' && failed.has('entrust'))
              ? 5000
              : 400,
          ),
      };
    }
    loader = createMockNightFeed(value);
  }
  const entry: NightEntryActions = {
    checkWorry: (value, signal) =>
      nightResponse(signal, () => {
        if (count !== null) conflict('SESSION_ALREADY_STARTED');
        if (validateWorry(value.category_id, value.worry_text ?? '', 200))
          conflict('INVALID_WORRY', 422);
        draft = {
          category_id: value.category_id,
          worry_text:
            value.category_id === 'none' ? null : value.worry_text!.trim(),
        };
        return { id: nightId, status: 'ready' as const, support: null };
      }),
    continueSupport: (id, signal) =>
      nightResponse(signal, () => {
        if (id !== nightId) conflict('NIGHT_NOT_FOUND', 404);
        conflict('SUPPORT_NOT_REQUIRED');
      }),
    startCounting: (value, signal) =>
      nightResponse(signal, () => {
        beginSession(value);
      }),
  };
  const loadFeed: FeedLoad = async (signal) => {
    guardNight();
    if (!loader) conflict('SESSION_NOT_STARTED');
    if (cards) return nightResponse(signal, () => cards!);
    const loaded = await loader(signal);
    if (signal.aborted) throw new ApiError('aborted');
    guardNight();
    cards = loaded.map((card, index) => ({
      ...card,
      id:
        sessionIndex === 1
          ? card.id
          : `${nightId}-session-${sessionIndex}-${card.id}`,
      category_id: card.category_id === null ? null : draft!.category_id,
      ...(isPause(index) ? { available: false, content: null } : {}),
    }));
    stamp(cards[0]);
    return cards;
  };
  const closing: ClosingActions = {
    finish: async (input, key, signal) => {
      if (
        !cards ||
        (input.reason === 'stop_pause' &&
          input.position !== stopOffer?.position) ||
        input.sheepCount !== count ||
        input.position !== position.position ||
        input.furthestPosition !== position.furthestPosition
      )
        conflict('INVALID_PROGRESS', 422);
      const next = JSON.stringify(input);
      if (fingerprint && next !== fingerprint)
        conflict('SESSION_ALREADY_FINISHED');
      if (finished && fingerprint)
        return delayed(signal, () => {
          expireIfDue();
          return finished!;
        });
      guardNight();
      if (scenario === 'stop-retry-finish' && !failed.has('stop-finish')) {
        await delayed(signal, () => {
          failed.add('stop-finish');
          throw new ApiError('network');
        });
      }
      if (scenario === 'stop-slow-finish' || scenario === 'stop-retry-finish') {
        await delayed(signal, () => guardNight(), 5000);
      }
      const result = await baseClosing.finish(input, key, signal);
      if (signal.aborted) throw new ApiError('aborted');
      guardNight();
      result.summary = {
        ...result.summary,
        entrusted_count: entrustAction === 'entrusted' ? 1 : 0,
        fluff_count: new Set(
          cards
            .slice(0, input.furthestPosition)
            .filter(
              (card) =>
                card.available && card.content && card.viewer.fluff_saved,
            )
            .map((card) => card.id),
        ).size,
      };
      if (result.closing_card && sessionIndex > 1) {
        result.closing_card = {
          ...result.closing_card,
          id: `${nightId}-session-${sessionIndex}-closing`,
          content: {
            text: `오늘 밤 ${sessionIndex}번째로 만난 양이 말해요.\n조금씩 쉬어 가도 괜찮아요.`,
          },
          kind: 'text',
        };
      }
      writingOffer ??= { ...result.writing_offer };
      result.writing_offer = { ...writingOffer };
      fingerprint = next;
      finishedAt = new Date(instant()).toISOString();
      finished = result;
      failOnce('finish');
      return result;
    },
    markViewed: (id, _key, signal) =>
      nightResponse(signal, () => {
        if (!finished?.closing_card || finished.closing_card.id !== id)
          conflict('INVALID_CARD', 422);
        closingViewed = true;
        stamp(finished.closing_card);
      }),
    chooseWriting: (choice, _key, signal) =>
      nightResponse(signal, () => {
        if (!finished) conflict('SESSION_NOT_FINISHED');
        if (finished.writing_offer.state === 'fulfilled')
          conflict('OFFER_ALREADY_DECIDED');
        writingOffer = { state: choice === 'now' ? 'writing' : 'deferred' };
        finished = { ...finished, writing_offer: { ...writingOffer } };
      }),
  };
  const returning: NightReturnActions & {
    create: (value: number, signal: AbortSignal) => Promise<void>;
  } = {
    load: (signal) =>
      delayed(signal, (): ReturnBootstrap => {
        expireIfDue();
        const time = instant();
        const phase = homePhase(time);
        const next_screen =
          phase === 'day' || morningOpen
            ? 'MORNING_ADOPTION'
            : count === null
              ? draft
                ? 'NIGHT_SHEEP_COUNT'
                : 'NIGHT_WORRY'
              : !finished
                ? 'NIGHT_FEED'
                : !closingConfirmed
                  ? 'NIGHT_CLOSING'
                  : 'NIGHT_RETURN';
        return {
          server_time: new Date(time).toISOString(),
          timezone: 'Asia/Seoul',
          phase,
          night_date: fortuneDate(time),
          next_screen,
          night_id: draft ? nightId : null,
          active_session_id:
            count !== null && !finished
              ? `${nightId}-session-${sessionIndex}`
              : null,
          last_session:
            finished && finishedAt
              ? {
                  counted: totalCount(),
                  status:
                    JSON.parse(fingerprint!).reason === 'completed'
                      ? 'completed'
                      : 'stopped',
                  finished_at: finishedAt,
                  entrusted_count: Number(
                    entrustAction === 'entrusted' ||
                      archived.some((item) => item.entrusted),
                  ),
                  fluff_count: candidates().filter((item) => item.fluff_saved)
                    .length,
                  yarn_sent_count: candidates().filter(
                    (item) => item.card.viewer.yarn_sent,
                  ).length,
                  closing_card: closingConfirmed ? null : finished.closing_card,
                }
              : null,
        };
      }),
    create: (value, signal) =>
      nightResponse(signal, () => {
        if (!Number.isInteger(value) || value < 3 || value > 30)
          conflict('INVALID_SHEEP_COUNT', 422);
        if (!finished) conflict('ACTIVE_SESSION_EXISTS');
        if (!closingConfirmed) conflict('CLOSING_NOT_CONFIRMED');
        archived.push({
          counted: finished.summary.counted,
          candidates: sessionCandidates(),
          entrusted: entrustAction === 'entrusted',
        });
        count = null;
        cards = null;
        loader = null;
        finished = null;
        fingerprint = null;
        finishedAt = null;
        closingViewed = false;
        closingConfirmed = false;
        progressRecorded = false;
        position = { position: 1, furthestPosition: 1 };
        entrust = undefined;
        entrustAction = null;
        stopOffer = undefined;
        baseClosing = createMockNightClosing();
        sessionIndex++;
        beginSession(value);
        if (scenario === 'return-create-lost' && !failed.has('return-create')) {
          failed.add('return-create');
          throw new ApiError('network');
        }
      }),
  };
  return {
    nightId,
    returning,
    getTotalCount: totalCount,
    getClosingRequest: () =>
      fingerprint
        ? (JSON.parse(
            fingerprint,
          ) as import('../features/night/closing/types').ClosingRequest)
        : null,
    confirmClosing: () => {
      if (expireIfDue() || morningOpen) return false;
      if (
        !finished ||
        (finished.closing_card?.available &&
          finished.closing_card.content &&
          !closingViewed) ||
        finished.writing_offer.state === 'offered' ||
        finished.writing_offer.state === 'writing'
      )
        conflict('CLOSING_NOT_CONFIRMED');
      closingConfirmed = true;
      return true;
    },
    get stopOffer() {
      return stopOffer;
    },
    get entrust() {
      return entrust;
    },
    expiry,
    expireIfDue,
    worryRecords: records,
    getSession: () =>
      count === null
        ? null
        : {
            sheepCount: count,
            position:
              progressRecorded || (finished?.summary.counted ?? 0) > 0
                ? position.position
                : 0,
            furthestPosition: progressRecorded
              ? position.furthestPosition
              : (finished?.summary.counted ?? 0),
          },
    getRecord: () => ({
      night: readRecord() ?? null,
      finished: !!finished,
      previousSessions: archived.length,
      counted: finished?.summary.counted ?? 0,
      morningOpen,
      expired,
      adopted: adopted ? { ...adopted } : null,
    }),
    fluff,
    yarn,
    textCards,
    songCards,
    cardWriting,
    songs,
    entry,
    loadFeed,
    closing,
    morning,
    getProgress: () => ({ ...position }),
    progress: (next: FeedPosition) => {
      if (expireIfDue()) return;
      if (!count || finished) return;
      if (
        !Number.isInteger(next.position) ||
        !Number.isInteger(next.furthestPosition) ||
        next.position < 1 ||
        next.position > next.furthestPosition ||
        next.furthestPosition > count
      )
        throw new Error('Invalid demo progress');
      for (let i = position.furthestPosition; i < next.furthestPosition; i++)
        if (cards?.[i]) stamp(cards[i]);
      if (cards?.[next.position - 1]) stamp(cards[next.position - 1]);
      progressRecorded = true;
      position = {
        position: next.position,
        furthestPosition: Math.max(
          position.furthestPosition,
          next.furthestPosition,
        ),
      };
    },
    advanceMorning: () => {
      if (!finished) throw new Error('Finish the demo night first');
      morningOpen = true;
      if (
        writingOffer?.state === 'offered' ||
        writingOffer?.state === 'writing'
      )
        writingOffer = { state: 'deferred' };

      if (
        finished.writing_offer.state === 'offered' ||
        finished.writing_offer.state === 'writing'
      )
        finished = { ...finished, writing_offer: { state: 'deferred' } };
    },
  };
}
