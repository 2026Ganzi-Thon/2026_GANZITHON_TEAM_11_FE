import type { ReflectionAnswer } from '../flock/types';
export type Reflection = { answer: ReflectionAnswer; message: string };
export interface ReflectionRecord {
  night: {
    id: string;
    night_date: string;
    category_id: string;
    worry_text: string | null;
    worry_saved_at: string | null;
    entrusted: boolean;
  } | null;
  reflection: Reflection | null;
}
export interface ReflectionActions {
  load(nightId: string, signal: AbortSignal): Promise<ReflectionRecord>;
  save(
    nightId: string,
    answer: ReflectionAnswer,
    signal: AbortSignal,
  ): Promise<Reflection>;
}
export const reflectionLabels: Record<ReflectionAnswer, string> = {
  same: '그대로예요',
  smaller: '작아졌어요',
  much_better: '생각보다 너무 괜찮아요',
  bigger: '더 커졌어요',
  new_worry: '다른 고민이 생겼어요',
  cannot_recall: '기억이 잘 안 나요',
};
