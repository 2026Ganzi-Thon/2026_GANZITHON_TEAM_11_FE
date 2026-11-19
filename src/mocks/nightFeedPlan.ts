export type MockFeedSlot =
  | 'empathy'
  | 'light'
  | 'warm'
  | 'entrust_worry'
  | 'stop_offer'
  | 'ai_song'
  | 'user_song';

/** Preview interpretation of the position table in API v0.6 §13.
 * This does not implement server recommendation or content moderation. */
export function planMockNightFeed(
  count: number,
  hasWorry: boolean,
): MockFeedSlot[] {
  if (!Number.isInteger(count) || count < 3 || count > 30)
    throw new Error('Preview count must be an integer from 3 to 30.');
  const reserved = new Map<number, MockFeedSlot>([[count, 'warm']]);
  for (const position of [7, 13, 21, 28]) {
    if (position < count) reserved.set(position, 'warm');
  }
  if (hasWorry && count >= 7)
    reserved.set(Math.min(6, Math.ceil(count / 2)), 'entrust_worry');
  if (count >= 16) reserved.set(14, 'stop_offer');
  function placeSong(target: number, role: 'ai_song' | 'user_song') {
    for (let position = target; position <= count - 2; position++) {
      if (position > 1 && !reserved.has(position)) {
        reserved.set(position, role);
        return;
      }
    }
    for (
      let position = Math.min(target - 1, count - 2);
      position >= 2;
      position--
    ) {
      if (!reserved.has(position)) {
        reserved.set(position, role);
        return;
      }
    }
    throw new Error('No available preview song position');
  }
  if (count >= 5) {
    placeSong(
      count < 15 ? Math.ceil(count / 2) : Math.ceil(count * 0.4),
      hasWorry ? 'ai_song' : 'user_song',
    );
    if (count >= 15) placeSong(count - 3, 'user_song');
  }
  let ordinary = 0;
  return Array.from({ length: count }, (_, index) => {
    const fixed = reserved.get(index + 1);
    if (fixed) return fixed;
    if (!hasWorry) return 'light';
    return ordinary++ % 3 === 2 ? 'light' : 'empathy';
  });
}
