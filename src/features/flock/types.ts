import type { Card } from '../../api/contracts';
import type { Sheep } from '../morning/types';

export type ReflectionAnswer =
  'same' | 'smaller' | 'much_better' | 'bigger' | 'new_worry' | 'cannot_recall';
/** Read-only projection of API v0.6 SheepDetail; persistence is not connected. */
export interface SheepDetail {
  sheep: Sheep;
  card: Card;
  position: number | null;
  sheep_count: number | null;
  night: {
    night_date: string;
    worry_text: string | null;
    category_id: string;
    reflection: { answer: ReflectionAnswer; message: string } | null;
  };
}
export type SheepDetailLoad = (
  sheepId: string,
  signal: AbortSignal,
) => Promise<SheepDetail>;
