import type { WithdrawalActions } from '../withdrawal/types';
import type { WorryDeletions } from '../worries/deletions';
import type { ReminderActions } from '../reminder/types';
import type { BirthDateActions } from '../birthDate/types';
import type { User } from '../../api/contracts';
import type { Reflection } from '../morning/reflection';
/** Read projection; GET /me/worries field mapping awaits server integration. */
export interface WorryRecord {
  night_id: string;
  night_date: string;
  category_id: string;
  worry_text: string;
  reflection: Reflection | null;
}
export interface WorryPage {
  items: WorryRecord[];
  next_cursor: string | null;
}
export interface WorryListActions {
  load(query: { cursor?: string }, signal: AbortSignal): Promise<WorryPage>;
}
export interface SettingsData {
  user: User;
  reminder: { enabled: boolean; local_time: string | null };
}
export interface SettingsActions {
  withdrawal?: WithdrawalActions;
  birthDate?: BirthDateActions;
  reminder?: ReminderActions;
  deletions?: WorryDeletions;
  loadMe(signal: AbortSignal): Promise<SettingsData>;
  worries: WorryListActions;
}
