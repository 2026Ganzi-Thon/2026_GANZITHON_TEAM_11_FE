import { createMockSongCards } from './songCards';
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
export type DemoScenario =
  | 'success'
  | 'lost-responses'
  | 'slow-songs'
  | 'slow-yarn'
  | 'slow-fluff'
  | 'writing-retry'
  | 'writing-lost-response'
  | 'writing-refresh-retry';
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
export function createNightMorningDemo(scenario: DemoScenario = 'success') {
  const nightId = 'demo-night';
  const nightDate = '2026-11-12';
  let draft: WorryDraft | null = null;
  let count: number | null = null;
  let cards: Card[] | null = null;
  const yarn = createMockYarn(
    () => cards ?? [],
    scenario === 'slow-yarn' ? 'slow' : 'success',
  );
  let loader: FeedLoad | null = null;
  let position: FeedPosition = { position: 1, furthestPosition: 1 };
  let finished: ClosingResult | null = null;
  let morningOpen = false;
  const writingScenario =
    scenario === 'writing-lost-response'
      ? 'lost-response'
      : scenario === 'writing-retry'
        ? 'retry'
        : 'success';
  const canSubmit = () =>
    morningOpen
      ? finished?.writing_offer.state === 'deferred'
      : finished?.writing_offer.state === 'writing';
  const textCards = createMockTextCards(writingScenario, {
    sourceNightId: nightId,
    canSubmit,
    onSubmitted: () => {
      if (finished)
        finished = { ...finished, writing_offer: { state: 'fulfilled' } };
    },
  });
  const songCards = createMockSongCards(writingScenario, {
    sourceNightId: nightId,
    canSubmit,
    onSubmitted: () => {
      if (finished)
        finished = { ...finished, writing_offer: { state: 'fulfilled' } };
    },
  });
  const cardWriting = createMockCardWriting(textCards, songCards);
  let fingerprint: string | null = null;
  let closingViewed = false;
  const fluff = createMockFluff(
    {
      cards: () => cards ?? [],
      viewed: (id) =>
        (cards ?? [])
          .slice(0, position.furthestPosition)
          .some((c) => c.id === id),
      isOpen: () => !morningOpen,
    },
    scenario === 'slow-fluff' ? 'slow' : 'success',
  );
  let adopted: Sheep | null = null;
  let reflection: Reflection | null = null;
  const viewedAt = new Map<string, string>();
  let viewSequence = 0;
  const stamp = (card: Card) =>
    viewedAt.set(
      card.id,
      new Date(
        Date.parse(`${nightDate}T16:12:00Z`) + ++viewSequence * 1000,
      ).toISOString(),
    );
  const savedSongs = new Map<string, string>();
  const failed = new Set<string>();
  const baseClosing = createMockNightClosing();
  const failOnce = (key: string) => {
    if (scenario === 'lost-responses' && !failed.has(key)) {
      failed.add(key);
      throw new ApiError('network');
    }
  };
  const checkNight = (id: string) => {
    if (id !== nightId) conflict('NOT_FOUND', 404);
  };
  const candidates = (): MorningCandidate[] => {
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
      }));
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
  const reflectionActions: ReflectionActions = {
    load: (id, signal) =>
      delayed(signal, () => {
        checkNight(id);
        if (!morningOpen) conflict('MORNING_NOT_OPEN');
        return {
          night: {
            id: nightId,
            night_date: nightDate,
            category_id: draft!.category_id,
            worry_text: draft!.worry_text,
            worry_saved_at: draft!.worry_text ? `${nightDate}T16:12:00Z` : null,
            entrusted: false,
          },
          reflection,
        };
      }),
    save: (id, answer, signal) =>
      delayed(signal, () => {
        checkNight(id);
        if (!morningOpen || draft?.category_id === 'none' || !draft?.worry_text)
          conflict('REFLECTION_NOT_AVAILABLE');
        reflection = { answer, message: reflectionReplies[answer] };
        return reflection;
      }),
  };
  const loadSheep: SheepDetailLoad = (id, signal) =>
    delayed(signal, () => {
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
        sheep_count: count,
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
        if (!morningOpen) conflict('MORNING_NOT_OPEN');
        return [...savedSongs].flatMap(([id, saved_at]) => {
          const card = cards?.find((item) => item.id === id);
          return card?.kind === 'song' && card.available && card.content
            ? [{ card_id: id, track: card.content.track, saved_at }]
            : [];
        });
      }),
    set: (id, saved, signal) =>
      delayed(
        signal,
        () => {
          const index = cards?.findIndex((item) => item.id === id) ?? -1;
          const card = cards?.[index];
          if (!card || card.kind !== 'song') conflict('NOT_SONG_CARD', 422);
          if (index >= position.furthestPosition)
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
    writing: cardWriting,
    reflection: reflectionActions,
    songs,
    loadSheep,
    loadMorning: (signal, requestedNightId) =>
      delayed(signal, () => {
        if (!morningOpen) conflict('MORNING_NOT_OPEN');
        if (requestedNightId !== undefined) checkNight(requestedNightId);
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
          counted_sheep: finished!.summary.counted,
          candidate_cards: items,
          default_card_id: (warm[0] ?? eligible[0])?.card.id ?? null,
          adoption: adopted,
          writing_offer: { ...finished!.writing_offer },
        };
      }),
    adopt: (id, cardId, signal) =>
      delayed(signal, () => {
        checkNight(id);
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
          id: 'demo-sheep',
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
  const entry: NightEntryActions = {
    checkWorry: (value, signal) =>
      delayed(signal, () => {
        if (count !== null) conflict('SESSION_ALREADY_STARTED');
        if (validateWorry(value.category_id, value.worry_text ?? '', 200))
          conflict('INVALID_WORRY', 422);
        draft = {
          category_id: value.category_id,
          worry_text:
            value.category_id === 'none' ? null : value.worry_text!.trim(),
        };
      }),
    startCounting: (value, signal) =>
      delayed(signal, () => {
        if (!draft || !Number.isInteger(value) || value < 3 || value > 30)
          conflict('INVALID_SESSION', 422);
        if (count !== null) {
          if (count !== value) conflict('SESSION_ALREADY_STARTED');
          return;
        }
        count = value;
        loader = createMockNightFeed(value);
      }),
  };
  const loadFeed: FeedLoad = async (signal) => {
    if (!loader) conflict('SESSION_NOT_STARTED');
    if (cards) return delayed(signal, () => cards!);
    const loaded = await loader(signal);
    if (signal.aborted) throw new ApiError('aborted');
    cards = loaded.map((card) => ({
      ...card,
      category_id: card.category_id === null ? null : draft!.category_id,
    }));
    stamp(cards[0]);
    return cards;
  };
  const closing: ClosingActions = {
    finish: async (input, key, signal) => {
      if (
        !cards ||
        input.sheepCount !== count ||
        input.position !== position.position ||
        input.furthestPosition !== position.furthestPosition
      )
        conflict('INVALID_PROGRESS', 422);
      const next = JSON.stringify(input);
      if (fingerprint && next !== fingerprint)
        conflict('SESSION_ALREADY_FINISHED');
      if (finished) return delayed(signal, () => finished!);
      const result = await baseClosing.finish(input, key, signal);
      if (signal.aborted) throw new ApiError('aborted');
      result.summary = {
        ...result.summary,
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
      fingerprint = next;
      finished = result;
      failOnce('finish');
      return result;
    },
    markViewed: (id, _key, signal) =>
      delayed(signal, () => {
        if (!finished?.closing_card || finished.closing_card.id !== id)
          conflict('INVALID_CARD', 422);
        closingViewed = true;
        stamp(finished.closing_card);
      }),
    chooseWriting: (choice, _key, signal) =>
      delayed(signal, () => {
        if (!finished) conflict('SESSION_NOT_FINISHED');
        if (finished.writing_offer.state === 'fulfilled')
          conflict('OFFER_ALREADY_DECIDED');
        finished = {
          ...finished,
          writing_offer: { state: choice === 'now' ? 'writing' : 'deferred' },
        };
      }),
  };
  return {
    nightId,
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
        finished.writing_offer.state === 'offered' ||
        finished.writing_offer.state === 'writing'
      )
        finished = { ...finished, writing_offer: { state: 'deferred' } };
    },
  };
}
