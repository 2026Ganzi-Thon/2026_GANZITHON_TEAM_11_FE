import { ApiError } from '../api/errors';
import { createNightMorningNavigation } from '../features/demo/navigation';
import { createNightMorningDemo } from './nightMorningDemo';
export type EntrustPreview =
  'success' | 'slow' | 'retry' | 'lost' | 'long' | 'none';
export async function createEntrustPreview(
  preset: EntrustPreview,
  signal: AbortSignal,
) {
  const demo = createNightMorningDemo(
    preset === 'slow'
      ? 'entrust-slow'
      : preset === 'retry'
        ? 'entrust-retry'
        : preset === 'lost'
          ? 'entrust-lost-response'
          : 'success',
  );
  const worry =
    preset === 'none'
      ? null
      : preset === 'long'
        ? '해야 할 일이 자꾸 떠올라요. 오늘은 걱정을 잠시 내려놓고 쉬고 싶어요. '.repeat(
            4,
          )
        : '내일 회의가 걱정돼요. 오늘 밤은 잠깐 쉬고 싶어요.';
  await demo.entry.checkWorry(
    { category_id: worry === null ? 'none' : 'career', worry_text: worry },
    signal,
  );
  await demo.entry.startCounting(7, signal);
  await demo.loadFeed(signal);
  if (signal.aborted) throw new ApiError('aborted');
  demo.progress({ position: 4, furthestPosition: 4 });
  const navigation = createNightMorningNavigation();
  navigation.setPage('feed');
  return { demo, navigation };
}
