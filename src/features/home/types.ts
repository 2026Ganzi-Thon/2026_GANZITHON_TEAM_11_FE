import type { FortuneActions } from '../fortune/types';
import type { MorningActions } from '../morning/types';
import type { SettingsActions } from '../settings/types';
import type { MyCardsWritingSource } from '../myCards/types';
import type { HomeClockActions } from './model';
import type { SheepDetailLoad } from '../flock/types';
export interface HomeSource {
  clock: HomeClockActions;
  morning: MorningActions;
  fortune: FortuneActions;
  settings?: SettingsActions;
  cards?: MyCardsWritingSource;
  loadDetail?: SheepDetailLoad;
}
