import type {
  CardChoice,
  CardWritingActions,
} from '../features/cards/CardWritingScreen';
import type { TextCardActions } from '../features/cards/types';
import type { SongCardActions } from '../features/cards/songTypes';
export function createMockCardWriting(
  text: TextCardActions,
  song: SongCardActions,
): CardWritingActions {
  let choice: CardChoice | null = null;
  return {
    text,
    song,
    readChoice: () => (choice ? { ...choice } : null),
    choose: (value) => {
      choice = { ...value };
    },
  };
}
