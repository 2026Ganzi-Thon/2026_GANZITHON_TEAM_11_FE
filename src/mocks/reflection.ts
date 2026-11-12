import type { Reflection } from '../features/morning/reflection';
import type { ReflectionAnswer } from '../features/flock/types';
export type ReflectionScenario =
  | 'success'
  | 'save-retry'
  | 'edit-retry'
  | 'load-retry'
  | 'no-worry'
  | 'deleted-worry'
  | 'existing'
  | 'long'
  | 'unavailable';
/** Fixed copy from the feature specification; the server supplies production replies. */
export const reflectionReplies: Record<ReflectionAnswer, string> = {
  same: '그럴 수 있어. 오늘 밤에 같은 고민 다시 들고 와도 돼.',
  smaller: '봐, 밤엔 커 보였던 거야.',
  much_better: '어젯밤의 너한테 알려 주고 싶다.',
  bigger: '말해 줘서 고마워. 오늘은 조금 일찍 와서 같이 세자.',
  new_worry: '그건 오늘 밤 양들한테 맡기자.',
  cannot_recall: '잊었다는 건 꽤 괜찮아졌다는 뜻일지도.',
};
export const initialReflection = (
  scenario: ReflectionScenario,
): Reflection | null =>
  scenario === 'existing' || scenario === 'edit-retry'
    ? { answer: 'smaller', message: reflectionReplies.smaller }
    : null;
