import { createMockWorryRecords, type MockWorryRecords } from './worryRecords';
import {
  createMockWorryDeletion,
  type WorryDeletionScenario,
} from './worryDeletion';
import type { ReflectionActions } from '../features/morning/reflection';
import {
  initialReflection,
  reflectionReplies,
  type ReflectionScenario,
} from './reflection';
import { ApiError } from '../api/errors';
import { createMockSheepDetail, type DetailScenario } from './sheepDetail';
import type { SheepDetailLoad } from '../features/flock/types';
import type {
  Morning,
  MorningActions,
  MorningCandidate,
  Sheep,
} from '../features/morning/types';
export type MorningScenario =
  | 'success'
  | 'load-retry'
  | 'save-lost'
  | 'flock-retry'
  | 'conflict'
  | 'unavailable'
  | 'no-candidates'
  | 'empty'
  | 'existing'
  | 'long';
function delayed<T>(signal: AbortSignal, action: () => T): Promise<T> {
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
    }, 600);
    signal.addEventListener('abort', abort, { once: true });
  });
}
function conflict(code: string, status = 409): never {
  throw new ApiError('http', { status, code });
}
/** Fixed response samples, not candidate ranking or a persistence implementation. */
export function createMockMorning(
  scenario: MorningScenario = 'success',
  detailScenario: DetailScenario = 'success',
  reflectionScenario: ReflectionScenario = 'success',
  deletionScenario?: WorryDeletionScenario,
  sharedRecords?: MockWorryRecords,
): MorningActions & {
  loadSheep: SheepDetailLoad;
  reflection: ReflectionActions;
} {
  const keys = [
    null,
    null,
    'health',
    'relationships',
    null,
    null,
    null,
    'study',
    'romance',
    'career',
  ];
  const candidates: MorningCandidate[] = keys.map((category, index) => ({
    card: {
      id: `preview-text-${index + 1}`,
      kind: 'text',
      available: true,
      category_id: category,
      tone: 'warm',
      author_type: 'seed',
      author_label: '먼저 지나간 양',
      viewer: { yarn_sent: false, fluff_saved: index === 0, song_saved: false },
      content: {
        text:
          index === 0
            ? '할 만큼 애쓴 하루였어. 잠깐 쉬어 가도 괜찮아.'
            : '작은 걸음도 네가 걸어온 길이야. 오늘은 조금 더 가볍게 시작해 봐.',
      },
    },
    can_adopt: true,
    fluff_saved: index === 0,
    position: index === 9 ? null : index + 1,
    sheep_count: 10,
    last_viewed_at: '2026-11-10T18:00:00Z',
  }));
  candidates[3].card = {
    ...candidates[3].card,
    id: 'preview-song',
    kind: 'song',
    tone: null,
    content: {
      track: {
        id: 'preview-track',
        title: '잠깐의 쉼 (예시)',
        artist: '예시 아티스트',
        cover_url: null,
        spotify_search_url: '',
      },
      recommendation: '시험 전날 잠깐 쉬면서 듣던 곡이야.',
    },
  };
  if (scenario === 'unavailable') {
    candidates[0].card.available = false;
    candidates[0].can_adopt = false;
    candidates[1].can_adopt = false;
  }
  if (scenario === 'long')
    candidates[3].card = {
      ...candidates[3].card,
      kind: 'text',
      content: {
        text: '오늘 하루를 천천히 돌아보면서 잠깐 쉬어 가도 괜찮아. '.repeat(
          12,
        ),
      },
    };
  const sheepFor = (cardId: string): Sheep => ({
    id: 'preview-adopted',
    night_id: 'preview-night',
    night_date: '2026-11-10',
    card_id: cardId,
    color_key:
      candidates.find((c) => c.card.id === cardId)?.card.category_id ?? null,
  });
  let adopted: Sheep | null =
    scenario === 'existing' ? sheepFor('preview-song') : null;
  const earlier: Sheep[] =
    scenario === 'empty'
      ? []
      : ['career', 'romance', 'health', null, 'relationships', 'study'].map(
          (key, index) => ({
            id: `preview-sheep-${index}`,
            night_id: `preview-earlier-${index}`,
            night_date: `2026-11-0${9 - index}`,
            card_id: `earlier-card-${index}`,
            color_key: key,
          }),
        );
  const visibleCandidates =
    scenario === 'empty' || scenario === 'no-candidates' ? [] : candidates;
  const failed = new Set<string>();
  const failOnce = (key: string) => {
    if (!failed.has(key)) {
      failed.add(key);
      throw new ApiError('network');
    }
  };
  const initialNight = {
    id: 'preview-night',
    night_date: '2026-11-10',
    category_id: reflectionScenario === 'no-worry' ? 'none' : 'career',
    worry_text:
      reflectionScenario === 'deleted-worry'
        ? null
        : reflectionScenario === 'long'
          ? '내일의 일을 생각하느라 잠이 오지 않아요. '.repeat(15)
          : '면접 결과가 내일 나오는데 계속 생각나서 잠이 안 와요.',
    worry_saved_at: '2026-11-10T16:12:00Z' as string | null,
    entrusted: true,
  };
  const records =
    sharedRecords ??
    createMockWorryRecords([
      { ...initialNight, reflection: initialReflection(reflectionScenario) },
      ...earlier.map((sheep) => ({
        ...initialNight,
        id: sheep.night_id,
        night_date: sheep.night_date,
        category_id: 'career',
        worry_text: '면접 결과가 내일 나오는데 계속 생각나서 잠이 안 와요.',
        reflection: null,
      })),
    ]);
  const night = records.get('preview-night')!;
  const worries = deletionScenario
    ? createMockWorryDeletion(records.erase, deletionScenario)
    : undefined;
  return {
    worries,
    reflection: {
      load: (nightId, signal) =>
        delayed(signal, () => {
          if (reflectionScenario === 'load-retry') failOnce('reflection-load');
          if (nightId !== night.id || scenario === 'empty')
            conflict('NOT_FOUND', 404);
          const { reflection, ...savedNight } = night;
          return { night: { ...savedNight }, reflection };
        }),
      save: (nightId, answer, signal) =>
        delayed(signal, () => {
          if (
            nightId !== night.id ||
            night.category_id === 'none' ||
            !night.worry_text ||
            reflectionScenario === 'unavailable'
          )
            conflict('REFLECTION_NOT_AVAILABLE');
          if (
            reflectionScenario === 'save-retry' ||
            reflectionScenario === 'edit-retry'
          )
            failOnce('reflection-save');
          const reflection = { answer, message: reflectionReplies[answer] };
          records.saveReflection(nightId, reflection);
          return reflection;
        }),
    },
    loadSheep: createMockSheepDetail((id) => {
      const sheep =
        adopted?.id === id ? adopted : earlier.find((item) => item.id === id);
      if (!sheep) return null;
      const candidate = candidates.find(
        (item) => item.card.id === sheep.card_id,
      );
      const card = candidate?.card ?? {
        ...candidates[0].card,
        id: sheep.card_id,
        category_id: sheep.color_key,
      };
      return {
        sheep,
        card,
        position: candidate ? candidate.position : 4,
        sheep_count: candidate ? candidate.sheep_count : 15,
        night: {
          night_date: sheep.night_date,
          category_id: records.get(sheep.night_id)!.category_id,
          worry_text: records.get(sheep.night_id)!.worry_text,
          reflection: records.get(sheep.night_id)!.reflection,
        },
      };
    }, detailScenario),
    loadMorning: (signal) =>
      delayed(signal, (): Morning => {
        if (scenario === 'load-retry') failOnce('load');
        return {
          night:
            scenario === 'empty'
              ? null
              : { id: 'preview-night', night_date: '2026-11-10' },
          counted_sheep: scenario === 'empty' ? null : 14,
          candidate_cards: visibleCandidates,
          default_card_id: visibleCandidates.length ? 'preview-song' : null,
          adoption: adopted,
        };
      }),
    adopt: (nightId, cardId, signal) =>
      delayed(signal, () => {
        if (nightId !== 'preview-night' || scenario === 'empty')
          conflict('INVALID_ADOPTION_CARD', 422);
        if (adopted) {
          if (adopted.card_id !== cardId)
            conflict('ADOPTION_ALREADY_FINALIZED');
          return adopted;
        }
        if (!visibleCandidates.length) conflict('NO_ADOPTION_CANDIDATE');
        const candidate = visibleCandidates.find((c) => c.card.id === cardId);
        if (!candidate) conflict('INVALID_ADOPTION_CARD', 422);
        if (
          !candidate.can_adopt ||
          !candidate.card.available ||
          !candidate.card.content
        )
          conflict('CARD_UNAVAILABLE');
        if (scenario === 'conflict') {
          adopted = sheepFor('preview-text-1');
          conflict('ADOPTION_ALREADY_FINALIZED');
        }
        adopted = sheepFor(cardId);
        if (scenario === 'save-lost') failOnce('save');
        return adopted;
      }),
    loadFlock: (signal) =>
      delayed(signal, () => {
        if (scenario === 'flock-retry') failOnce('flock');
        return adopted ? [adopted, ...earlier] : earlier;
      }),
  };
}
