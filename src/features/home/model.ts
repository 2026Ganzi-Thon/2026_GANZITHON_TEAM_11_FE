import { ApiError } from '../../api/errors';
/** UI projection of server time and User.stats; not a new backend endpoint. */
export interface HomeSnapshot {
  server_time: string;
  timezone: 'Asia/Seoul';
  phase: 'day' | 'night';
  user: { id: string; stats: { night_count: number } };
}
export interface HomeClockActions {
  load(signal: AbortSignal): Promise<HomeSnapshot>;
}
const hour = 60 * 60 * 1000,
  day = 24 * hour;
export function homePhase(time: number): 'day' | 'night' {
  const part = time + 9 * hour - Math.floor((time + 9 * hour) / day) * day;
  return part < 4 * hour || part >= 21 * hour ? 'night' : 'day';
}
export function readHomeSnapshot(value: unknown): HomeSnapshot {
  const data = value as HomeSnapshot;
  const match =
    typeof data?.server_time === 'string'
      ? /^(\d{4}-\d{2}-\d{2})T(\d{2}):([0-5]\d):([0-5]\d)(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(
          data.server_time,
        )
      : null;
  const time = match ? Date.parse(data.server_time) : NaN;
  const date = match ? new Date(`${match[1]}T00:00:00Z`) : null;
  if (
    !match ||
    !Number.isFinite(time) ||
    !date ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== match[1] ||
    Number(match[2]) > 23 ||
    data.timezone !== 'Asia/Seoul' ||
    data.phase !== homePhase(time) ||
    typeof data.user?.id !== 'string' ||
    !data.user.id.trim() ||
    !Number.isSafeInteger(data.user?.stats?.night_count) ||
    data.user.stats.night_count < 0
  )
    throw new ApiError('invalid-response');
  return {
    server_time: data.server_time,
    timezone: 'Asia/Seoul',
    phase: data.phase,
    user: {
      id: data.user.id,
      stats: { night_count: data.user.stats.night_count },
    },
  };
}
export function untilHomeBoundary(time: number): number {
  const adjusted = time + 9 * hour,
    part = adjusted - Math.floor(adjusted / day) * day;
  return (
    (part < 4 * hour ? 4 * hour : part < 21 * hour ? 21 * hour : 28 * hour) -
    part
  );
}
export function fortuneDate(time: number): string {
  return new Date(time + 5 * hour).toISOString().slice(0, 10);
}
